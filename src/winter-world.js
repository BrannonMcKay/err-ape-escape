import * as THREE from '../vendor/three.module.js';
import {FootprintTrail} from './footprints.js';
import {terrainAt} from './terrain.js';

export function winterMaterials(maze){
  const theme=maze.presentation.theme;
  function material(kind){
    const m=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.92});
    m.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,{uWinterSize:{value:new THREE.Vector2(maze.width*maze.cellSize,maze.height*maze.cellSize)},uBalls:{value:theme.snowballs.map(a=>new THREE.Vector4(...a))},uSnow:{value:new THREE.Color(theme.colors.snow)},uIce:{value:new THREE.Color(theme.colors.ice)},uStone:{value:new THREE.Color(theme.colors.stone)}});
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWinter;').replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
        vec4 winterPosition=vec4(transformed,1.0);
        #ifdef USE_INSTANCING
          winterPosition=instanceMatrix*winterPosition;
        #endif
        vWinter=(modelMatrix*winterPosition).xyz;`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
        varying vec3 vWinter;uniform vec2 uWinterSize;uniform vec4 uBalls[3];uniform vec3 uSnow,uIce,uStone;
        float winterHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float winterNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(winterHash(i),winterHash(i+vec2(1,0)),f.x),mix(winterHash(i+vec2(0,1)),winterHash(i+vec2(1,1)),f.x),f.y);}
      `).replace('#include <color_fragment>',`#include <color_fragment>
        vec2 region=vWinter.xz/uWinterSize+0.5;
        float nearestBall=10.0;
        for(int i=0;i<3;i++)nearestBall=min(nearestBall,length((region-uBalls[i].xy)/uBalls[i].zw));
        float winterIce=1.0-smoothstep(0.18,0.79,nearestBall);
        float grain=winterHash(floor(vWinter.xz*95.0));
        float frost=winterNoise(vWinter.xz*1.8);
        vec3 surface;
        ${kind==='ground'?`
          float crack=pow(1.0-abs(sin(vWinter.x*1.7+vWinter.z*.65+frost*3.0)),28.0)*.16;
          vec3 ice=mix(uIce,uSnow,.10+frost*.16+crack);
          surface=mix(uSnow*(.94+grain*.07),ice,winterIce);
        `:kind==='top'?`
          surface=uSnow*(.93+frost*.1);
        `:`
          vec3 n=abs(normalize(cross(dFdx(vWinter),dFdy(vWinter))));
          vec2 uv=vec2(n.x>.5?vWinter.z:vWinter.x,vWinter.y);
          float row=floor(uv.y/.42);vec2 bricks=vec2(uv.x/.8+mod(row,2.0)*.5,uv.y/.42);
          vec2 edge=abs(fract(bricks)-.5);float mortar=smoothstep(.43,.48,max(edge.x,edge.y));
          surface=mix(uStone*(.74+winterHash(floor(bricks))*.35),uSnow*.73,mortar);
          surface=mix(surface,uSnow,smoothstep(.69,.89,frost)*.48);
        `}
        if(region.x>.493&&region.y<.327)surface=vec3(0.88,0.29,0.055)*(.8+frost*.3);
        diffuseColor.rgb*=surface;
      `);
      if(kind==='ground')shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(.94,.25,winterIce);');
    };
    m.customProgramCacheKey=()=>`snowman-${kind}-v1`;return m;
  }
  return {wall:material('wall'),top:material('top'),ground:material('ground')};
}

const point=(maze,x,y)=>new THREE.Vector3((x/maze.sourceStep-maze.width/2)*maze.cellSize,0,(y/maze.sourceStep-maze.height/2)*maze.cellSize);
function slab(scene,maze,points,height,color,base=0){
  const shape=new THREE.Shape();points.forEach(([x,y],i)=>{const p=point(maze,x,y);if(i)shape.lineTo(p.x,-p.z);else shape.moveTo(p.x,-p.z);});shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:true,bevelSize:.12,bevelThickness:.12,bevelSegments:2,steps:1});
  const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color,roughness:.9}));mesh.rotation.x=-Math.PI/2;mesh.position.y=base;mesh.castShadow=mesh.receiveShadow=true;scene.add(mesh);return mesh;
}
function treeBatches(scene,positions,cutaway=m=>m){
  // One surface per bough: overlapping snow/foliage cones shimmer at a distance.
  const pine=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1});
  pine.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying float vBoughHeight;').replace('#include <begin_vertex>','#include <begin_vertex>\nvBoughHeight=position.y;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying float vBoughHeight;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=mix(vec3(.032,.09,.073),vec3(.83,.94,.98),smoothstep(-.46,-.29,vBoughHeight));');};pine.customProgramCacheKey=()=> 'single-surface-snowy-pine-v1';cutaway(pine);
  const cone=new THREE.ConeGeometry(1,1,8,1,true),m=new THREE.Matrix4(),q=new THREE.Quaternion();
  for(let tier=0;tier<3;tier++){
    const batch=new THREE.InstancedMesh(cone,pine,positions.length);
    positions.forEach((p,i)=>{const radius=p.size*(.6-tier*.13),height=p.size*(.82-tier*.08);m.compose(new THREE.Vector3(p.x,p.y+p.size*(.5+tier*.48),p.z),q,new THREE.Vector3(radius,height,radius));batch.setMatrixAt(i,m);});
    // Fine self-shadow edges were another source of overview shimmer.
    batch.castShadow=batch.receiveShadow=false;scene.add(batch);
  }
}
export function buildWinterDecor(world){
  const {maze,scene}=world,positions=[];
  // The original tilted hat and carrot retain their footprint in the drawing.
  slab(scene,maze,[[91,52],[98,39],[114,27],[122,33],[136,76],[109,94]],2.1,0x765039);
  slab(scene,maze,[[104,83],[136,71],[139,82],[109,99]],2.22,0x342b29);
  slab(scene,maze,[[76,114],[106,101],[121,87],[150,75],[170,65],[176,81],[124,102],[80,124]],1.25,0x644632);
  slab(scene,maze,[[94,49],[112,30],[116,32],[98,54]],.2,0xeaf4f6,2.25);
  slab(scene,maze,[[182,112],[229,100],[184,124]],1.55,0xe47726);
  for(let i=0;i<4;i++)slab(scene,maze,[[186+i*7,112-i*1.5],[188+i*7,111.5-i*1.5],[189+i*7,117-i*2],[187+i*7,118-i*2]],.04,0xa65320,1.72);
  for(let y=3;y<maze.height-3;y+=4)for(let x=3;x<maze.width-3;x+=4){
    if(maze.rows[y][x]!=='#'||!maze.presentation.theme.treeRegions.some(([rx,ry,w,h])=>x>=rx&&x<rx+w&&y>=ry&&y<ry+h))continue;
    const p=maze.point(y*maze.width+x),height=world.wallStyles[y*maze.width+x]===1?.95:2.85;
    positions.push({...p,y:height-.2,size:.8+((x*7+y*13)%10)/25});
  }
  treeBatches(scene,positions,m=>world.cutawayMaterial(m));
  const forest=[];
  for(let i=0;i<85;i++){const a=i*2.39996,r=106+(i*13)%28;forest.push({x:Math.cos(a)*r,z:Math.sin(a)*r,y:-8,size:7+(i*7)%6});}
  treeBatches(scene,forest);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(1100,1100),new THREE.MeshStandardMaterial({color:0xb6d1de,roughness:.9}));floor.rotation.x=-Math.PI/2;floor.position.y=-9;scene.add(floor);
  buildWinterSigns(scene,maze);
}

function buildWinterSigns(scene,maze){
  const startCanvas=document.createElement('canvas');startCanvas.width=512;startCanvas.height=192;const s=startCanvas.getContext('2d');s.font='900 112px Segoe Print, sans-serif';s.textAlign='center';s.textBaseline='middle';s.lineWidth=8;s.strokeStyle='#edf8ff';s.strokeText('START',256,90);s.fillStyle='#173b61';s.fillText('START',256,90);
  const startMap=new THREE.CanvasTexture(startCanvas);startMap.colorSpace=THREE.SRGBColorSpace;const start=new THREE.Mesh(new THREE.PlaneGeometry(5,1.875),new THREE.MeshBasicMaterial({map:startMap,transparent:true,depthWrite:false}));const p=maze.point(maze.startIndex);start.position.set(p.x,.014,p.z+.45);start.rotation.x=-Math.PI/2;scene.add(start);
  const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=768;const c=canvas.getContext('2d');
  c.fillStyle='#f4f0df';c.fillRect(0,0,1536,768);c.strokeStyle='#395955';c.lineWidth=25;c.strokeRect(18,18,1500,732);
  c.fillStyle='#547977';c.font='bold 32px Segoe UI, sans-serif';c.fillText('A MESSAGE FROM YOUR LOCAL MENACE',490,122);
  c.strokeStyle='#292435';c.lineWidth=17;c.lineCap='round';c.lineJoin='round';
  c.beginPath();c.moveTo(254,330);c.lineTo(254,509);c.lineTo(159,669);c.moveTo(254,509);c.lineTo(356,670);c.moveTo(254,390);c.lineTo(128,462);c.lineTo(85,388);c.moveTo(254,390);c.lineTo(360,435);c.lineTo(420,349);c.stroke();
  c.fillStyle='#fffdf4';c.beginPath();c.arc(254,233,112,0,Math.PI*2);c.fill();c.stroke();
  c.beginPath();c.moveTo(192,187);c.lineTo(223,205);c.moveTo(278,205);c.lineTo(315,181);c.stroke();
  c.fillStyle='#292435';for(const x of [212,291]){c.beginPath();c.ellipse(x,223,9,14,0,0,Math.PI*2);c.fill();}
  c.lineWidth=7;c.beginPath();c.moveTo(184,252);c.quadraticCurveTo(250,277,324,252);c.quadraticCurveTo(267,345,184,252);c.stroke();
  c.fillStyle='#243d43';c.font='900 108px Segoe Print, Comic Sans MS, sans-serif';c.textAlign='center';
  ["I'm gonna",'get you,','ho ho ho!'].forEach((line,i)=>c.fillText(line,970,305+i*146));
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;
  const panel=new THREE.MeshBasicMaterial({map}),frame=new THREE.MeshStandardMaterial({color:0x3a5048,roughness:.9});
  let nearest=0,best=Infinity;for(let i=0;i<maze.walk.length;i++){if(maze.rows[Math.floor(i/maze.width)][i%maze.width]!=='#')continue;const d=Math.hypot(i%maze.width-139,Math.floor(i/maze.width)-248);if(d<best){best=d;nearest=i;}}
  const position=maze.point(nearest),g=new THREE.Group();g.position.set(position.x,0,position.z);scene.add(g);
  const post=new THREE.Mesh(new THREE.CylinderGeometry(.18,.25,4,8),frame);post.position.y=2;g.add(post);
  const backing=new THREE.Mesh(new THREE.BoxGeometry(10.4,5.3,.3),frame);backing.position.y=6.5;g.add(backing);
  for(const side of [-1,1]){const sign=new THREE.Mesh(new THREE.PlaneGeometry(10,5),panel);sign.position.set(0,6.5,side*.16);sign.rotation.y=side<0?Math.PI:0;g.add(sign);}
  const snowCap=new THREE.Mesh(new THREE.BoxGeometry(10.65,.22,.62),new THREE.MeshStandardMaterial({color:0xf0f7fa}));snowCap.position.y=9.24;g.add(snowCap);
}

function stampTexture(cat=false){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const c=canvas.getContext('2d');c.fillStyle='#fff';
  if(cat){
    c.beginPath();c.ellipse(32,40,15,12,0,0,Math.PI*2);c.fill();
    for(const [x,y,a] of [[14,28,-.3],[25,17,-.1],[39,17,.1],[50,28,.3]]){c.beginPath();c.ellipse(x,y,6,8,a,0,Math.PI*2);c.fill();}
  }else{
    c.beginPath();c.roundRect(17,5,30,39,13);c.fill();c.beginPath();c.roundRect(20,48,24,12,4);c.fill();
    c.globalCompositeOperation='destination-out';for(let y=12;y<43;y+=8)c.fillRect(17,y,30,2);
  }
  return new THREE.CanvasTexture(canvas);
}
export class WinterWeather {
  constructor(scene,maze){
    this.maze=maze;this.trail=new FootprintTrail({lifetime:maze.presentation.theme.footprintSeconds});
    this.prints=['boots','paws'].map((name,index)=>{
      const geo=new THREE.PlaneGeometry(1,1);geo.rotateX(-Math.PI/2);const fade=new THREE.InstancedBufferAttribute(new Float32Array(this.trail.capacity),1);fade.setUsage(THREE.DynamicDrawUsage);geo.setAttribute('aPrintFade',fade);
      const mat=new THREE.MeshBasicMaterial({map:stampTexture(!!index),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
      mat.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float aPrintFade;varying float vPrintFade;').replace('#include <begin_vertex>','#include <begin_vertex>\nvPrintFade=aPrintFade;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying float vPrintFade;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=vPrintFade;');};mat.customProgramCacheKey=()=> 'snow-prints-v1';
      const mesh=new THREE.InstancedMesh(geo,mat,this.trail.capacity);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.count=0;mesh.frustumCulled=false;scene.add(mesh);return {mesh,fade};
    });
    const geometry=new THREE.BufferGeometry(),positions=new Float32Array(900*3);for(let i=0;i<900;i++){positions[i*3]=(Math.random()-.5)*160;positions[i*3+1]=Math.random()*32;positions[i*3+2]=(Math.random()-.5)*175;}geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
    const canvas=document.createElement('canvas');canvas.width=canvas.height=32;const c=canvas.getContext('2d'),gradient=c.createRadialGradient(16,16,1,16,16,15);gradient.addColorStop(0,'#fff');gradient.addColorStop(.45,'#ffffffee');gradient.addColorStop(1,'#ffffff00');c.fillStyle=gradient;c.fillRect(0,0,32,32);
    this.snow=new THREE.Points(geometry,new THREE.PointsMaterial({color:0xffffff,map:new THREE.CanvasTexture(canvas),size:.14,transparent:true,opacity:.85,depthWrite:false}));this.snow.frustumCulled=false;scene.add(this.snow);this.elapsed=0;
  }
  clear(){this.trail.clear();for(const p of this.prints)p.mesh.count=0;}
  update(round,dt,view,reducedMotion=false){
    if(view==='paused')return;
    this.elapsed+=dt;
    if(view==='playing')this.trail.update(dt,[{id:'player',kind:'player',...round.player},{id:'hunter',kind:'hunter',...round.hunter},...round.cats.map(c=>({...c,id:`cat-${c.id}`,kind:'cat',active:c.state==='ground'}))],(x,z)=>this.maze.open(x,z));
    else this.trail.update(dt,[]);
    const counts=[0,0],matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0),size=new THREE.Vector3(),color=new THREE.Color();
    for(const m of this.trail.marks){const slot=m.kind==='cat'?1:0,b=this.prints[slot],i=counts[slot]++,ice=terrainAt(this.maze,m.x,m.z).ice;
      q.setFromAxisAngle(up,m.angle);size.set((m.kind==='cat'?.18:m.kind==='hunter'?.21:.16)*m.scale,1,(m.kind==='cat'?.21:m.kind==='hunter'?.42:.31)*m.scale);
      matrix.compose(new THREE.Vector3(m.x,-.035,m.z),q,size);b.mesh.setMatrixAt(i,matrix);b.mesh.setColorAt(i,color.set(ice>.5?0xc6e5f5:0x4f7698));b.fade.setX(i,.48*Math.pow(1-m.age/this.trail.lifetime,1.5));
    }
    this.prints.forEach((b,i)=>{b.mesh.count=counts[i];b.mesh.instanceMatrix.needsUpdate=true;if(b.mesh.instanceColor)b.mesh.instanceColor.needsUpdate=true;b.fade.needsUpdate=true;});
    const overhead=['home','preview'].includes(view),cx=overhead?0:round.player.x,cz=overhead?0:round.player.z,range=overhead?185:48,positions=this.snow.geometry.attributes.position;
    const wrap=(v,c,r)=>((v-c+r/2)%r+r)%r-r/2+c;
    for(let i=0;i<positions.count;i++){
      const x=wrap(positions.getX(i)+Math.sin(this.elapsed*.4+i)*dt*.3,cx,range),z=wrap(positions.getZ(i)+dt*.25,cz,range),y=positions.getY(i)-dt*(reducedMotion?.35:.9+(i%9)*.12);
      positions.setXYZ(i,x,y<0?28:y,z);
    }
    this.snow.material.size=overhead?.48:.14;this.snow.material.opacity=overhead?.35:.85;this.snow.geometry.setDrawRange(0,overhead?300:900);positions.needsUpdate=true;
  }
}
