import * as THREE from '../vendor/three.module.js';

export const CITY_GROUND_Y=-15;
const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.94,...extra});

// The same materials/geometries are shared across the entire scrapyard.
// Each car's doors, bent bonnet, tyres and roof are batched instead of adding
// hundreds of individual draw calls to the playable maze.
export function buildWasteland(world,groundMaterial){
  const {scene,maze}=world;
  world.wastelandMaterial=groundMaterial;
  let seed=3187;const random=()=>((seed=seed*16807%2147483647)/2147483647);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(1400,1400),groundMaterial);
  ground.rotation.x=-Math.PI/2;ground.position.y=CITY_GROUND_Y;ground.receiveShadow=true;ground.name='Continuous concrete wasteland';scene.add(ground);
  const buckets={};
  function bucket(name,geometry,material){buckets[name]={geometry,material,items:[]};}
  bucket('paint',new THREE.BoxGeometry(),mat(0xffffff,{metalness:.18}));
  bucket('charcoal',new THREE.BoxGeometry(),mat(0x282729,{metalness:.18}));
  bucket('trim',new THREE.BoxGeometry(),mat(0x7b7368,{metalness:.5}));
  bucket('tyres',new THREE.CylinderGeometry(.43,.43,.28,12),mat(0x28262a));
  bucket('hubs',new THREE.CylinderGeometry(.21,.21,.29,10),mat(0x6d6459,{metalness:.55}));
  bucket('debris',new THREE.DodecahedronGeometry(.65),mat(0xffffff));
  bucket('concrete',new THREE.BoxGeometry(),mat(0x897e70));
  bucket('slabs',new THREE.BoxGeometry(),mat(0x9c9181));
  const v=new THREE.Vector3(),q=new THREE.Quaternion(),e=new THREE.Euler(),scale=new THREE.Vector3(),local=new THREE.Matrix4();
  function part(name,root,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0,color=null){
    q.setFromEuler(e.set(rx,ry,rz));local.compose(v.set(x,y,z),q,scale.set(sx,sy,sz));
    buckets[name].items.push({matrix:root.clone().multiply(local),color});
  }
  const identity=new THREE.Matrix4();
  const outside=(x,z,margin=4)=>{
    for(const dx of [-margin,0,margin])for(const dz of [-margin,0,margin]){
      const i=maze.index(x+dx,z+dz);
      if(i>=0&&maze.rows[Math.floor(i/maze.width)][i%maze.width]!==' ')return false;
    }
    return true;
  };
  const wrecks=[];
  // A band of cars close to the exposed maze edges makes the height legible
  // immediately, with a second band among the more distant broken streets.
  for(let attempt=0;attempt<2400&&wrecks.length<92;attempt++){
    const x=(random()-.5)*310,z=(random()-.5)*285;
    if(!outside(x,z)||wrecks.some(p=>Math.hypot(x-p.x,z-p.z)<6))continue;
    if(Math.abs(x)>92&&Math.abs(z)>76&&random()>.35)continue;
    wrecks.push({x,z});
    const yaw=random()*Math.PI*2,overturned=random()<.16,roll=overturned?Math.PI:(random()-.5)*.14;
    const root=new THREE.Matrix4().compose(new THREE.Vector3(x,CITY_GROUND_Y+(overturned?1.65:.04),z),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,yaw,roll)),new THREE.Vector3(1,1,1));
    const paint=[0x735843,0x58716c,0x787b80,0x974d3c,0xb19b68,0x536374][wrecks.length%6];
    part('charcoal',root,0,.35,0,1.86,.32,4.1);
    part('paint',root,0,.61,0,2,.45,3.9,0,0,0,paint);
    part('charcoal',root,0,1.03,-.1,1.67,.77,1.83);
    // A dented roof and narrow pillars outline the dark, broken window openings.
    part('paint',root,.05,1.48,-.17,1.69,.12,1.67,.04,0,.08,paint);
    for(const side of [-1,1]){
      for(const end of [-1,1])part('trim',root,side*.82,1.10,end*.83-.1,.075,.70,.075,-end*.17);
      part('paint',root,side*.99,.75,-.13,.085,.47,1.82,0,0,0,paint);
      part('trim',root,side*1.015,1.05,-.12,.055,.065,1.85);
      for(const end of [-1,1]){
        if(!overturned&&side===1&&end===-1&&wrecks.length%4===0)continue;
        part('tyres',root,side*1.01,.44,end*1.30,1,1,1,0,0,Math.PI/2);
        part('hubs',root,side*1.03,.44,end*1.30,1,1,1,0,0,Math.PI/2);
      }
      part('trim',root,side*.62,.59,2.01,.31,.16,.07);
    }
    const open=wrecks.length%3===0;
    part('paint',root,0,open?1.02:.83,1.36,1.9,.10,1.30,open?-.52:.07,0,.06,paint);
    part('paint',root,0,.81,-1.53,1.91,.12,.88,.10,0,-.04,paint);
    part('trim',root,.16,.38,2.13,1.82,.12,.13,0,.12,-.08);
    if(wrecks.length%4===0){
      part('paint',root,1.65,.76,.03,.09,.67,1.35,0,-.65,.09,paint);
      part('tyres',identity,x+2.5,CITY_GROUND_Y+.15,z-1.2,1,1,1);
    }
    // Rust holes and crumpled fragments break up the flat painted panels.
    part('charcoal',root,-.31,.853,1.6,.5,.012,.24,0,.17,0);
    for(let j=0;j<4;j++)part('debris',identity,x+(random()-.5)*7,CITY_GROUND_Y+.14,z+(random()-.5)*6,.25+random()*.45,.2,.25+random()*.45,random(),random()*6,random(),0x80776a);
  }
  // Broken floor slabs beneath the city, without the former parallel road grid.
  for(let i=0;i<340;i++){
    const x=(random()-.5)*390,z=(random()-.5)*360;if(!outside(x,z,2))continue;
    const large=i%5===0;
    part('slabs',identity,x,CITY_GROUND_Y+.14,z,large?3.5:.8,.25,large?2.4:.7,.02,random()*6,.02);
  }
  // Grounded columns and exposed floor remnants give the high maze a ruined
  // building underneath it. The props all remain below the playable surface.
  for(let x=-76;x<77;x+=7)for(let z=-59;z<62;z+=7){
    const i=maze.index(x,z);if(i<0||maze.rows[Math.floor(i/maze.width)][i%maze.width]===' ')continue;
    const lowAt=radius=>Math.min(...[-radius,radius].flatMap(dx=>[-radius,radius].map(dz=>maze.heightAt(x+dx,z+dz))));
    const ceiling=lowAt(.4)-3.1,height=ceiling-CITY_GROUND_Y;
    if(height<1)continue;
    part('concrete',identity,x,CITY_GROUND_Y+height/2,z,.78,height,.78);
    part('slabs',identity,x,CITY_GROUND_Y+.22,z,1.9,.44,1.9);
    const slabCeiling=lowAt(2.8)-3.4;
    for(let level=CITY_GROUND_Y+5;level<Math.min(ceiling-1,slabCeiling);level+=5){
      part('slabs',identity,x,level,z,5.5,.28,5.5);
      if((i%5)===0&&level+2<slabCeiling)part('concrete',identity,x-2.2,level+1,z,.30,2,2.7);
    }
  }
  for(const [name,b] of Object.entries(buckets)){
    const mesh=new THREE.InstancedMesh(b.geometry,b.material,b.items.length);
    b.items.forEach((p,i)=>{mesh.setMatrixAt(i,p.matrix);if(p.color!==null)mesh.setColorAt(i,new THREE.Color(p.color));});
    mesh.castShadow=true;mesh.receiveShadow=true;mesh.name=`Wasteland ${name}`;scene.add(mesh);
  }
}

function timberTexture(end=false){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=end?512:1024;
  const c=canvas.getContext('2d'),size=canvas.width;let seed=71;const rand=()=>((seed=seed*16807%2147483647)/2147483647);
  c.fillStyle=end?'#c4955d':'#a87540';c.fillRect(0,0,size,size);
  if(end){
    const cx=size*.46,cy=size*.52;
    for(let ring=7;ring<390;ring+=4+rand()*6){
      c.beginPath();for(let j=0;j<=180;j++){const a=j/180*Math.PI*2,r=ring*(1+.018*Math.sin(a*7)+.025*Math.sin(a*3));const x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r*.92;j?c.lineTo(x,y):c.moveTo(x,y);}
      c.strokeStyle=`rgba(72,37,17,${.16+rand()*.2})`;c.lineWidth=1+rand()*2;c.stroke();
    }
    for(let j=0;j<5;j++){const a=rand()*6.28;c.beginPath();c.moveTo(cx+Math.cos(a)*70,cy+Math.sin(a)*70);c.lineTo(cx+Math.cos(a+.05)*170,cy+Math.sin(a+.05)*170);c.lineTo(cx+Math.cos(a)*310,cy+Math.sin(a)*310);c.strokeStyle='#6d462c88';c.lineWidth=2;c.stroke();}
  }else{
    for(let i=0;i<1100;i++){
      const x=rand()*size,phase=rand()*6.28,amp=1+rand()*5;c.beginPath();
      for(let y=0;y<=size;y+=16){const xx=x+Math.sin(y*.006+phase)*amp+Math.sin(y*.019+phase)*amp*.3;y?c.lineTo(xx,y):c.moveTo(xx,y);}
      c.lineWidth=.4+rand()*1.8;c.strokeStyle=rand()>.35?`rgba(55,27,10,${.06+rand()*.21})`:`rgba(247,211,148,${.06+rand()*.22})`;c.stroke();
    }
    for(const [x,y] of [[270,260],[724,729]])for(let r=3;r<42;r+=3){c.beginPath();c.ellipse(x,y,r,r*2.5,.07,0,Math.PI*2);c.lineWidth=1.3;c.strokeStyle='#63402077';c.stroke();}
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;return texture;
}

export function buildTimberHandle(world){
  const {maze}=world,prop=maze.presentation.solidProps.find(p=>p.id==='hammer-handle');
  const [a,b,c,d]=prop.polygon,scale=maze.cellSize/maze.sourceStep;
  const start=new THREE.Vector3(((a[0]+d[0])/2/maze.sourceStep-maze.width/2)*maze.cellSize,0,((a[1]+d[1])/2/maze.sourceStep-maze.height/2)*maze.cellSize);
  const end=new THREE.Vector3(((b[0]+c[0])/2/maze.sourceStep-maze.width/2)*maze.cellSize,0,((b[1]+c[1])/2/maze.sourceStep-maze.height/2)*maze.cellSize);
  const axis=end.clone().sub(start),length=axis.length(),radiusStart=Math.hypot(a[0]-d[0],a[1]-d[1])*scale*.48,radiusEnd=Math.hypot(b[0]-c[0],b[1]-c[1])*scale*.48;
  const geo=new THREE.CylinderGeometry(radiusEnd,radiusStart,length,48,12),positions=geo.attributes.position;
  const rotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),axis.normalize()),center=start.clone().add(end).multiplyScalar(.5),v=new THREE.Vector3();
  for(let i=0;i<positions.count;i++){
    const t=positions.getY(i)/length+.5,radius=radiusStart+(radiusEnd-radiusStart)*t;
    v.fromBufferAttribute(positions,i).applyQuaternion(rotation).add(center);
    v.y+=maze.heightAt(v.x,v.z)+radius;positions.setXYZ(i,v.x,v.y,v.z);
  }
  geo.computeVertexNormals();
  const sides=world.cutawayMaterial(mat(0xffffff,{map:timberTexture(),roughness:.84})),ends=world.cutawayMaterial(mat(0xffffff,{map:timberTexture(true),roughness:.9}));
  const handle=new THREE.Mesh(geo,[sides,ends,ends]);handle.name='Solid timber hammer handle';handle.castShadow=handle.receiveShadow=true;world.scene.add(handle);
}
