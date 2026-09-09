import * as THREE from '../vendor/three.module.js';
import {buildWasteland,buildTimberHandle,CITY_GROUND_Y} from './city-wasteland.js';
import {rubbleBatches} from './city-detail.js';

const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.94,...extra});
const noise=`
  float cityHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float cityNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(cityHash(i),cityHash(i+vec2(1,0)),f.x),mix(cityHash(i+vec2(0,1)),cityHash(i+vec2(1,1)),f.x),f.y);}
  float cityCrack(vec2 p){vec2 cell=floor(p),f=fract(p);float first=10.0,second=10.0;
    for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){vec2 o=vec2(float(x),float(y));vec2 site=o+vec2(cityHash(cell+o),cityHash(cell+o+43.7));float d=length(site-f);if(d<first){second=first;first=d;}else second=min(second,d);}
    return 1.0-smoothstep(.009,.025,second-first);
  }
`;
function textured(kind,color=0xffffff){
  const m=material(color,{metalness:kind==='steel'?.55:0,roughness:kind==='steel'?.53:.96});
  m.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vCity;').replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
      vec4 city=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
        city=instanceMatrix*city;
      #endif
      vCity=(modelMatrix*city).xyz;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\nvarying vec3 vCity;\n${noise}`).replace('#include <color_fragment>',`#include <color_fragment>
      vec3 pn=abs(normalize(cross(dFdx(vCity),dFdy(vCity))));
      vec2 uv=pn.y>.5?vCity.xz:pn.x>.5?vCity.zy:vCity.xy;
      ${kind==='ground'?'uv=vCity.xz;':''}
      float n=cityNoise(uv*2.0),grain=cityHash(floor(uv*75.0));
      ${kind==='ground'?`
        vec2 grid=uv/.82,id=floor(grid),tile=fract(grid);float seed=cityHash(id);
        float edge=min(min(tile.x,1.0-tile.x),min(tile.y,1.0-tile.y));
        float grout=1.0-smoothstep(.018,.035,edge);
        float missing=step(.59,cityNoise(id*.17)+seed*.23);
        float chipped=(1.0-smoothstep(.055,.15,length(tile-vec2(step(.5,seed),step(.5,cityHash(id+17.0))))))*step(.35,seed);
        vec3 concrete=mix(vec3(.32,.33,.32),vec3(.46,.44,.40),cityNoise(uv*.6));
        vec3 ceramic=mix(vec3(.66,.65,.59),vec3(.43,.51,.50),step(.82,seed));
        ceramic*=.86+seed*.15;
        vec3 surface=mix(ceramic,concrete,max(missing,max(grout,chipped)));
        float crack=cityCrack(uv*1.15)*smoothstep(.40,.63,cityNoise(uv*.8));
        surface*=1.0-crack*.56;
        float dust=smoothstep(.63,.82,cityNoise(uv*.35));
        surface=mix(surface,vec3(.46,.37,.28),dust*.35);
        diffuseColor.rgb*=surface*(.87+grain*.13+n*.10);
      `:kind==='facade'?`
        vec2 cell=fract(uv/vec2(2.2,3.4));float frame=step(.17,cell.x)*step(cell.x,.83)*step(.16,cell.y)*step(cell.y,.77);
        float broken=step(.23,cityHash(floor(uv/vec2(2.2,3.4))));
        vec3 glass=mix(vec3(.055,.08,.10),vec3(.20,.28,.29),n);
        diffuseColor.rgb=mix(diffuseColor.rgb*(.7+n*.3),glass,frame*broken);
        diffuseColor.rgb*=.86+grain*.12;
      `:kind==='wood'?`
        float lines=sin(uv.x*18.0+sin(uv.y*.8)*3.0);diffuseColor.rgb*=.7+n*.25+lines*.1;
      `:kind==='steel'?`
        float rust=smoothstep(.58,.8,cityNoise(uv*.8));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.36,.14,.065),rust*.65);diffuseColor.rgb*=.78+n*.22+grain*.08;
      `:`
        vec2 bricks=uv*vec2(2.6,4.2);bricks.x+=mod(floor(bricks.y),2.0)*.5;
        vec2 edge=fract(bricks);float mortar=step(.08,edge.x)*step(.12,edge.y);
        float stain=cityNoise(uv*.7);diffuseColor.rgb*=mix(.39,.82+n*.24,mortar)*(.72+stain*.3)+grain*.07;
      `}
    `);
  };m.customProgramCacheKey=()=>`city-${kind}-v1`;return m;
}
export function cityMaterials(){
  return {ground:textured('ground'),wall:textured('brick',0xa39483),top:textured('brick',0x59615d)};
}
export function cityPropMaterial(prop){return textured(prop.id==='hammer-head'?'steel':prop.id==='hammer-handle'?'wood':'facade',prop.color);}

function box(parent,mat,x,y,z,w,h,d){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
function sourcePoint(maze,x,y){return {x:(x/maze.sourceStep-maze.width/2)*maze.cellSize,z:(y/maze.sourceStep-maze.height/2)*maze.cellSize};}
function signTexture(lines,{background='#e1bc74',foreground='#33292c',border=true,spray=false}={}){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;const c=canvas.getContext('2d');
  if(background){c.fillStyle=background;c.fillRect(0,0,1024,512);}
  if(border){c.strokeStyle=foreground;c.lineWidth=13;c.strokeRect(18,18,988,476);}
  c.textAlign='center';c.textBaseline='middle';c.fillStyle=foreground;c.font=`900 ${spray?260:lines.length===1?150:105}px 'Segoe Print','Comic Sans MS',sans-serif`;
  if(spray){c.shadowColor=foreground;c.shadowBlur=7;c.translate(512,256);c.rotate(-.05);c.translate(-512,-256);}
  lines.forEach((line,i)=>c.fillText(line,512,256+(i-(lines.length-1)/2)*145,950));
  if(spray){
    c.shadowBlur=0;c.globalCompositeOperation='destination-out';let seed=12;
    for(let i=0;i<1400;i++){seed=seed*16807%2147483647;const x=seed%1024;seed=seed*16807%2147483647;c.fillStyle='#0005';c.fillRect(x,seed%512,1+seed%3,1+seed%2);}
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;return texture;
}
function groundSign(world,px,py,width,height,lines,angle=0,lift=.06,style={}){
  const maze=world.maze,p=sourcePoint(maze,px,py),geo=new THREE.PlaneGeometry(width,height,Math.ceil(width/.36),Math.ceil(height/.36));geo.rotateX(-Math.PI/2);geo.rotateY(angle);
  const positions=geo.attributes.position;
  for(let i=0;i<positions.count;i++){const x=positions.getX(i)+p.x,z=positions.getZ(i)+p.z;positions.setXYZ(i,x,maze.heightAt(x,z)+lift,z);}geo.computeVertexNormals();
  const sign=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:signTexture(lines,style),transparent:true,roughness:.8,polygonOffset:true,polygonOffsetFactor:-2}));sign.receiveShadow=true;world.scene.add(sign);return sign;
}
function cityMural(world){
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=1024;const c=canvas.getContext('2d');
  c.lineJoin=c.lineCap='round';c.textAlign='center';c.textBaseline='middle';c.font="900 260px 'Segoe Print','Comic Sans MS',sans-serif";
  c.save();c.translate(650,500);c.rotate(-.045);c.shadowColor='#ef9cbe';c.shadowBlur=12;
  for(const [text,y,paint] of [['POUND',-150,'#f2b6cc'],['TOWN',135,'#f4d694']]){
    c.strokeStyle='#2f2936';c.lineWidth=24;c.strokeText(text,0,y,1050);c.fillStyle=paint;c.fillText(text,0,y,1050);
  }c.restore();
  // Intentionally wonky felt-tip cat: pointy ears, uneven eyes and a curly tail.
  function line(points,color='#efdec1',width=17){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle='#332d37';c.lineWidth=width+13;c.stroke();c.strokeStyle=color;c.lineWidth=width;c.stroke();}
  c.shadowBlur=7;c.shadowColor='#efdec1';
  line([[1450,650],[1405,734],[1418,839],[1540,871],[1677,847],[1731,760],[1679,650]]);
  line([[1400,410],[1372,207],[1517,330],[1612,321],[1758,181],[1740,446],[1770,519],[1743,624],[1630,694],[1484,680],[1387,593],[1375,492],[1400,410]]);
  line([[1435,371],[1418,291],[1476,349]],'#ef9cbe',10);line([[1652,341],[1718,263],[1702,365]],'#ef9cbe',10);
  for(const [x,y,r] of [[1480,473,38],[1653,466,46]]){c.beginPath();c.ellipse(x,y,r,r*.84,-.08,0,Math.PI*2);c.fillStyle='#f4d694';c.fill();line([[x+2,y-21],[x-1,y+19]],'#302b34',11);}
  line([[1550,546],[1606,539],[1580,570],[1550,546]],'#ed94b1',12);
  line([[1580,570],[1556,603],[1527,597]],'#efdec1',9);line([[1580,570],[1607,605],[1636,590]],'#efdec1',9);
  for(const d of [-1,0,1]){line([[1490,552+d*15],[1280,530+d*66]],'#efdec1',8);line([[1660,545+d*18],[1870,520+d*60]],'#efdec1',8);}
  line([[1706,786],[1811,797],[1872,744],[1901,659],[1873,614],[1833,643],[1844,685]],'#efdec1',20);
  line([[1474,740],[1470,850]],'#efdec1',12);line([[1624,739],[1631,853]],'#efdec1',12);
  line([[306,827],[894,810],[1072,824]],'#ef9cbe',13);
  // A few drips make it feel sprayed directly onto the wall.
  for(const [x,y,h] of [[273,684,108],[515,717,52],[1010,682,75],[1420,617,34]])line([[x,y],[x+2,y+h]],'#e9acba',7);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
  const p=sourcePoint(world.maze,1189,840.3),geo=new THREE.PlaneGeometry(17.5,8.4,8,1),positions=geo.attributes.position;
  for(let i=0;i<positions.count;i++){const x=p.x+positions.getX(i),z=p.z;positions.setXYZ(i,x,world.maze.heightAt(x,z)+5.1+positions.getY(i),z);}geo.computeVertexNormals();
  const material=world.cutawayMaterial(new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3}));
  const mural=new THREE.Mesh(geo,material);mural.name='Pound Town cat graffiti · south wall';world.scene.add(mural);
}
function batch(scene,geometry,mat,items){
  const mesh=new THREE.InstancedMesh(geometry,mat,items.length),m=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler();
  items.forEach((p,i)=>{q.setFromEuler(e.set(p.rx||0,p.ry||0,p.rz||0));m.compose(new THREE.Vector3(p.x,p.y,p.z),q,new THREE.Vector3(p.sx||1,p.sy||1,p.sz||1));mesh.setMatrixAt(i,m);if(p.color)mesh.setColorAt(i,new THREE.Color(p.color));});mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh;
}

export function buildCityDecor(world){
  const {scene,maze}=world;
  let seed=871;const random=()=>((seed=seed*16807%2147483647)/2147483647);
  // A warm dusk dome with a low sun and layered silhouettes of broken towers.
  const sky=new THREE.Mesh(new THREE.SphereGeometry(550,40,24),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,
    vertexShader:'varying vec3 vSky;void main(){vSky=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`varying vec3 vSky;void main(){float h=normalize(vSky).y;vec3 c=mix(vec3(.94,.51,.31),vec3(.25,.23,.38),smoothstep(-.02,.55,h));c=mix(vec3(.43,.31,.35),c,smoothstep(-.2,.03,h));gl_FragColor=vec4(c,1.0);#include <colorspace_fragment>}`.replace(';#include',';\n#include')}));scene.add(sky);
  const sun=new THREE.Mesh(new THREE.SphereGeometry(20,32,20),new THREE.MeshBasicMaterial({color:0xffcf7d,fog:false}));sun.position.set(-153,33,-230);scene.add(sun);
  world.light.color.set(0xffc084);world.light.position.set(-100,95,-95);world.light.intensity=2.1;scene.fog.color.set(0xc69383);
  scene.children.filter(o=>o.isHemisphereLight).forEach(o=>o.intensity=1.5);world.renderer.toneMappingExposure=1.12;
  buildWasteland(world,textured('ground'));
  buildTimberHandle(world);
  cityMural(world);
  for(let layer=0;layer<2;layer++){
    const ruins=[],ledges=[],r=layer?220:148;
    for(let i=0;i<40;i++){
      const a=i/40*Math.PI*2+.05*random(),x=Math.cos(a)*r,z=Math.sin(a)*r,w=7+random()*12,d=8+random()*11,h=15+random()*49;
      const col=layer?0x7a6572:0x645458;
      ruins.push({x,y:h/2+CITY_GROUND_Y,z,sx:w,sy:h,sz:d,color:col});
      // Uneven roofline, exposed core and missing corners.
      for(let k=0;k<3;k++)ruins.push({x:x+(k-1)*w*.28,y:h+CITY_GROUND_Y+random()*7,z:z+d*.15,sx:w*.27,sy:2+random()*9,sz:d*.5,color:col});
      for(let f=0;f<h/5;f++)ledges.push({x,y:f*5+CITY_GROUND_Y+1,z,sx:w+.3,sy:.15,sz:d+.3});
    }
    batch(scene,new THREE.BoxGeometry(),textured('facade',layer?0x806d7a:0x786569),ruins).castShadow=false;
    batch(scene,new THREE.BoxGeometry(),material(layer?0x6f5d6b:0x483f49),ledges).castShadow=false;
  }
  const chunks=[],bricks=[],rebar=[],plants=[],flowers=[],tiles=[];
  for(let i=0;i<maze.walk.length;i++){
    const row=Math.floor(i/maze.width),col=i%maze.width,p=maze.point(i),y=maze.heightAt(p.x,p.z);
    if(maze.rows[row][col]==='#'&&world.wallStyles[i]===1&&i%3===0){
      const sy=.2+random()*.48;
      chunks.push({...p,y:y+.85+sy*.24,sx:.28+random()*.16,sy,sz:.24+random()*.18,rx:random()*.7,ry:random()*6,rz:random()*.5,color:random()>.65?0x925643:0x636b65});
      if(i%15===0)bricks.push({...p,y:y+.3,sx:.36,sy:.3,sz:.27,ry:random()*.7,color:0x9f604b});
    }
    if(world.wallStyles[i]===2&&i%14===0)rebar.push({...p,y:y+7.9,sx:.023,sy:.7+random()*.8,sz:.023,rz:(random()-.5)*.5});
    if(maze.walk[i]&&i%173===0)tiles.push({...p,y:y+.045,sx:.12+random()*.18,sy:1,sz:.12+random()*.20,ry:random()*6,rz:(random()-.5)*.12,color:random()>.3?0xd0cbb9:0x829996});
    if(maze.walk[i]&&i%47===0){
      // Keep plants near the edges of corridors. They do not obstruct navigation.
      const edge=[i-1,i+1,i-maze.width,i+maze.width].some(n=>!maze.walk[n]);
      if(!edge&&random()>.08)continue;
      for(let k=0;k<3;k++)plants.push({x:p.x+(random()-.5)*.12,y:y+.1,z:p.z+(random()-.5)*.12,sx:.10,sy:.2+random()*.16,sz:.1,ry:random()*6,rz:(random()-.5)*.45,color:random()>.5?0x718145:0x9c9a54});
      if(i%5===0)flowers.push({...p,y:y+.30,sx:.10,sy:.045,sz:.10,color:[0xe5b977,0xc8accc,0xd9d8ae][i%3]});
    }
  }
  world.rubbleChunks=[
    ...rubbleBatches(scene,new THREE.DodecahedronGeometry(.7,0),world.cutawayMaterial(material(0xffffff)),chunks),
    ...rubbleBatches(scene,new THREE.BoxGeometry(),world.cutawayMaterial(material(0xffffff)),bricks),
  ];
  batch(scene,new THREE.BoxGeometry(),world.cutawayMaterial(material(0x4c3d35,{metalness:.5})),rebar);
  batch(scene,new THREE.ConeGeometry(.6,1,4),material(0xffffff,{side:THREE.DoubleSide}),plants).castShadow=false;
  batch(scene,new THREE.IcosahedronGeometry(1,0),material(0xffffff),flowers).castShadow=false;
  batch(scene,new THREE.CylinderGeometry(1,1,.025,3),material(0xffffff),tiles).castShadow=false;

  // The hammer lies in the original silhouette; its square-section head rises
  // fourteen metres. Its lettering stays on the upper face, readable from above.
  groundSign(world,849,550,11.8,8.0,['POUND!'],.58,14.49,{background:'#d6bc89',foreground:'#3a302e'});
  groundSign(world,(maze.start[0]+1.5)*maze.sourceStep,(maze.start[1]+2.5)*maze.sourceStep,2.35,1.4,['START'],0,.015,{background:null,border:false,foreground:'#f7ddb0',spray:true});
  // Several facade bands and open lift shafts make the toppled towers read as
  // buildings on their sides, not upright slabs. Positions stay inside solids.
  const ribs=[],frames=[];
  for(const [sx,sy,count,spacing,width,lift] of [[1186,350,10,45,17.3,16.87],[1015,730,3,35,18,7.88]]){
    for(let j=0;j<count;j++){
      const p=sourcePoint(maze,sx,sy+j*spacing);
      ribs.push({...p,y:maze.heightAt(p.x,p.z)+lift,sx:width,sy:.14,sz:.18});
    }
  }
  batch(scene,new THREE.BoxGeometry(),world.cutawayMaterial(material(0x70665e)),ribs);
  const p=sourcePoint(maze,1187,775),h=maze.heightAt(p.x,p.z)+16.94;
  for(const side of [-1,1])frames.push({x:p.x+side*3.2,y:h,z:p.z,sx:.2,sy:.22,sz:4.2});
  frames.push({...p,y:h,sx:6.4,sy:.22,sz:.2});batch(scene,new THREE.BoxGeometry(),material(0x50483e),frames);

  // A small upright road sign announces the descent from inside the entrance.
  const start=maze.point(maze.startIndex),board=new THREE.Group();board.position.set(start.x-2,maze.heightAt(start.x-2,start.z-3),start.z-3);scene.add(board);
  box(board,material(0x685b4b),0,2,0,.14,4,.14);
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(4.1,2.05),new THREE.MeshStandardMaterial({map:signTexture(['COME ON DOWN','POUND TOWN']),side:THREE.DoubleSide,roughness:.8}));sign.position.y=3.3;sign.rotation.z=-.07;board.add(sign);
  // Courtyard breach: rubble shoulders and a bright, broken lintel above the gap.
  const breach=sourcePoint(maze,782,307);groundSign(world,782,307,4.4,1.2,['MIND THE GIANT'],Math.PI/2,.04,{background:'#c5a04e',foreground:'#382a28'});
  for(const side of [-1,1])box(scene,world.cutawayMaterial(material(0x6a5c50)),breach.x,maze.heightAt(breach.x,breach.z+side*1.45)+1.8,breach.z+side*1.45,.22,3.6,.22);
}
