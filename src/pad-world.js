import * as THREE from '../vendor/three.module.js';
import {FootprintTrail} from './footprints.js';
import {padTimeline} from './leaky-pad.js';
import {BLOOD_RED,bloodMask,bloodTopShader,sourceArt,startArrow,loadPadFont,lighthouseGraffiti} from './pad-art.js';

const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.85,...extra});
const point=(maze,[x,y])=>new THREE.Vector3((x/maze.sourceStep-maze.width/2)*maze.cellSize,0,(y/maze.sourceStep-maze.height/2)*maze.cellSize);
function add(parent,geometry,mat,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);m.receiveShadow=true;parent.add(m);return m;}
export function padMaterials(maze){
  const top=material(0x338b91),wall=material(0xe8e8db),ground=material(0xfffcf2),mask=bloodMask();
  bloodTopShader(top,maze,mask);
  const c=document.createElement('canvas');c.width=1536;c.height=2048;const ctx=c.getContext('2d');
  const drawLettering=()=>{
    ctx.clearRect(0,0,c.width,c.height);ctx.save();ctx.scale(c.width/1062,c.height/1314);ctx.textAlign='center';ctx.fillStyle='#e66a99';ctx.font='112px Creepster, Impact, sans-serif';
    ctx.translate(535,625);ctx.rotate(-.18);['Your','Best','Clothes'].forEach((line,i)=>ctx.fillText(line,0,i*125,490));ctx.restore();
  };drawLettering();
  const lettering=new THREE.CanvasTexture(c);lettering.colorSpace=THREE.SRGBColorSpace;lettering.anisotropy=8;
  let letteringDisposed=false;lettering.addEventListener('dispose',()=>{letteringDisposed=true;});
  loadPadFont().then(()=>{if(!letteringDisposed){drawLettering();lettering.needsUpdate=true;}}).catch(()=>{});
  ground.userData.disposableTextures=[lettering,mask];
  ground.onBeforeCompile=s=>{
    s.uniforms.padLettering={value:lettering};s.uniforms.padSize={value:new THREE.Vector2(maze.width*maze.cellSize,maze.height*maze.cellSize)};
    s.uniforms.bloodInk={value:mask};s.uniforms.bloodColor={value:new THREE.Color(BLOOD_RED)};
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 padWorld;').replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
      vec4 p=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
        p=instanceMatrix*p;
      #endif
      padWorld=(modelMatrix*p).xyz;`);
    s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 padWorld;uniform sampler2D padLettering;uniform vec2 padSize;uniform sampler2D bloodInk;uniform vec3 bloodColor;').replace('#include <color_fragment>',`#include <color_fragment>
      float weave=(sin(padWorld.x*155.0)*sin(padWorld.z*158.0))*.035;
      diffuseColor.rgb*=.95+weave;
      vec2 uv=vec2(padWorld.x/padSize.x+.5,.5-padWorld.z/padSize.y);
      diffuseColor.rgb=mix(diffuseColor.rgb,bloodColor*(.95+weave),texture2D(bloodInk,uv).a);
      vec4 words=texture2D(padLettering,uv);diffuseColor.rgb=mix(diffuseColor.rgb,words.rgb,words.a);`);
  };
  ground.customProgramCacheKey=()=> 'pad-linen-v2';return {top,wall,ground};
}
function glowTexture(){
  const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(32,32,1,32,32,32);
  g.addColorStop(0,'#ffffffff');g.addColorStop(.2,'#ffffffaa');g.addColorStop(1,'#ffffff00');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);
}
export class PadWorld{
  constructor(world){
    this.world=world;this.maze=world.maze;this.scene=world.scene;const {scene,maze}=this;
    this.water=material(0x278d91,{transparent:true,opacity:.46,roughness:.42,metalness:.12,depthWrite:false,emissive:0x19040b,emissiveIntensity:.2});
    this.waterTime={value:0};
    this.water.onBeforeCompile=s=>{
      s.uniforms.waterTime=this.waterTime;
      s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nuniform float waterTime;varying vec2 waterXZ;').replace('#include <begin_vertex>',`#include <begin_vertex>
        waterXZ=position.xy;transformed.z+=sin(position.x*.19+waterTime*.55)*.16+cos(position.y*.13+waterTime*.4)*.12;`);
      s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform float waterTime;varying vec2 waterXZ;').replace('#include <color_fragment>',`#include <color_fragment>
        float ripples=sin(waterXZ.x*.8+sin(waterXZ.y*.3+waterTime)+waterTime*.8);diffuseColor.rgb*=.97+.03*ripples;`);
    };this.water.customProgramCacheKey=()=> 'pad-ocean-v1';
    const ocean=add(scene,new THREE.PlaneGeometry(1100,1100,150,150),this.water,0,-1.8,0);ocean.rotation.x=-Math.PI/2;
    this.seabed=material(0x196a70);const bed=add(scene,new THREE.PlaneGeometry(1100,1100),this.seabed,0,-5,0);bed.rotation.x=-Math.PI/2;
    this.originalArt=sourceArt(scene,maze);this.startArrow=startArrow(scene,maze);
    this.sun=add(scene,new THREE.SphereGeometry(8,32,24),new THREE.MeshBasicMaterial({color:0xffdbb0}),-95,65,-180);
    // Exterior flourishes remain decorative; the filled drops use the source-space art layer.
    for(const coords of [
      [[752,513],[758,503],[775,500],[790,510],[792,527],[780,538],[755,537]],
      [[798,647],[796,671],[804,688],[820,688],[831,677],[827,660],[815,655],[810,663],[817,672]],
      [[882,1124],[899,1160],[890,1179],[868,1181],[854,1162],[865,1140],[881,1142],[884,1152],[875,1157]],
      [[891,1182],[913,1169],[919,1150],[910,1127],[910,1107],[925,1094],[946,1094],[967,1105],[970,1123],[958,1132],[944,1129],[933,1115],[942,1110]]
    ]){const curve=new THREE.CatmullRomCurve3(coords.map(xy=>{const p=point(maze,xy);p.y=.28;return p;}));add(scene,new THREE.TubeGeometry(curve,coords.length*6,.25,6,false),world.padMaterials.top);}
    this.skyColors={skyTop:{value:new THREE.Color()},skyHorizon:{value:new THREE.Color()}};
    add(scene,new THREE.SphereGeometry(480,32,16),new THREE.ShaderMaterial({uniforms:this.skyColors,side:THREE.BackSide,depthWrite:false,
      vertexShader:'varying vec3 direction;void main(){direction=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:'uniform vec3 skyTop;uniform vec3 skyHorizon;varying vec3 direction;void main(){float t=smoothstep(0.0,.6,normalize(direction).y);gl_FragColor=vec4(mix(skyHorizon,skyTop,t),1.0);\n#include <colorspace_fragment>\n}'}));
    const steel=material(0x354a55,{metalness:.55}),ivory=material(0xf1e8d5),stripe=material(0x547d83);
    const location=point(maze,maze.presentation.lighthouse),tower=new THREE.Group();tower.position.copy(location);scene.add(tower);this.tower=tower;
    add(tower,new THREE.CylinderGeometry(3.3,4.2,2,32),ivory,0,-.8);
    const shaft=add(tower,new THREE.CylinderGeometry(1.1,1.9,16,32),ivory,0,8);shaft.castShadow=true;
    for(const y of [3.5,7.5,11.5])add(tower,new THREE.CylinderGeometry(1.9-y*.05,2-y*.05,1.3,32),stripe,0,y);
    const entrance=maze.point(maze.startIndex);this.graffiti=lighthouseGraffiti(tower,Math.atan2(entrance.x-location.x,entrance.z-location.z));
    add(tower,new THREE.CylinderGeometry(2.35,2.1,.32,32),steel,0,16.25);
    for(let i=0;i<10;i++){const a=i*Math.PI/5;add(tower,new THREE.CylinderGeometry(.045,.045,1.1,6),steel,Math.sin(a)*2.15,16.95,Math.cos(a)*2.15);}
    const rail=add(tower,new THREE.TorusGeometry(2.15,.06,6,32),steel,0,17.5);rail.rotation.x=Math.PI/2;
    add(tower,new THREE.CylinderGeometry(1.25,1.25,2.4,24),material(0xbfe9ff,{transparent:true,opacity:.22,depthWrite:false}),0,17.6);
    add(tower,new THREE.ConeGeometry(1.8,1.25,32),steel,0,19.35);
    this.bulbMaterial=new THREE.MeshBasicMaterial({color:0x509dff});
    add(tower,new THREE.SphereGeometry(.5,16,12),this.bulbMaterial,0,17.6);
    this.beacon=new THREE.SpotLight(0x509dff,18000,360,.11,.55,1.25);this.beacon.position.set(location.x,17.6,location.z);this.beacon.castShadow=true;
    this.beacon.shadow.mapSize.set(2048,2048);this.beacon.shadow.bias=-.0001;this.beacon.shadow.normalBias=.18;this.beacon.shadow.camera.near=.5;
    scene.add(this.beacon,this.beacon.target);
    const beamGeo=new THREE.ConeGeometry(1,1,48,1,true);beamGeo.translate(0,-.5,0);
    this.beam=add(scene,beamGeo,new THREE.MeshBasicMaterial({color:0x69b8ff,transparent:true,opacity:.065,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
    this.beam.position.copy(this.beacon.position);
    const glow=glowTexture();this.lamps=[];
    for(const xy of maze.presentation.lamps){
      const p=point(maze,xy),g=new THREE.Group();g.position.copy(p);scene.add(g);
      add(g,new THREE.CylinderGeometry(.28,.38,.25,12),steel,0,.8);
      add(g,new THREE.CylinderGeometry(.055,.08,2.4,8),steel,0,1.9);
      add(g,new THREE.ConeGeometry(.48,.28,12),steel,0,3.4);
      add(g,new THREE.SphereGeometry(.19,12,8),this.bulbMaterial,0,3.04);
      const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:glow,color:0x509dff,transparent:true,opacity:.7,depthWrite:false}));halo.position.set(0,3.05,0);halo.scale.set(1.4,1.4,1.4);g.add(halo);
      const light=new THREE.PointLight(0x509dff,24,9,1.7);light.position.set(p.x,2.8,p.z);scene.add(light);
      this.lamps.push({halo,light});
    }
    // Persistent boot stamps are instanced so dozens of pursuers remain inexpensive.
    this.trail=new FootprintTrail({lifetime:10000,capacity:18000});
    const stamp=document.createElement('canvas');stamp.width=stamp.height=64;const ctx=stamp.getContext('2d');ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(32,23,14,20,0,0,Math.PI*2);ctx.fill();ctx.fillRect(21,47,22,12);
    const geo=new THREE.PlaneGeometry(.105,.19);geo.rotateX(-Math.PI/2);
    this.prints=new THREE.InstancedMesh(geo,new THREE.MeshStandardMaterial({color:0xa71935,map:new THREE.CanvasTexture(stamp),transparent:true,alphaTest:.1,depthWrite:false,roughness:.95}),this.trail.capacity);
    this.prints.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.prints.count=0;this.prints.frustumCulled=false;scene.add(this.prints);
    this.splashes=[];
  }
  clear(){this.trail.clear();this.prints.count=0;for(const s of this.splashes){s.root.removeFromParent();s.material.dispose();s.geo.dispose();}this.splashes=[];}
  splash(h){
    const root=new THREE.Group();root.position.set(h.x,-1.7,h.z);this.scene.add(root);
    const mat=new THREE.MeshBasicMaterial({color:0xbc3c50,transparent:true}),geo=new THREE.SphereGeometry(.15,6,4);
    for(let i=0;i<22;i++){const d=add(root,geo,mat);const a=i*2.4;d.userData.velocity=new THREE.Vector3(Math.sin(a)*(1+i%4),3+i%5,Math.cos(a)*(1+i%4));}
    this.splashes.push({root,material:mat,geo,age:0});
  }
  update(round,dt,view){
    const t=round.elapsed||0,timeline=padTimeline(t),paused=view==='paused';
    this.waterTime.value=t;
    this.water.opacity=.46+.36*timeline.oceanRed;
    this.water.color.set(0x2caaa6).lerp(new THREE.Color(0x470816),timeline.oceanRed);
    this.seabed.color.copy(this.water.color).multiplyScalar(.48);
    this.world.padMaterials.top.color.set(0x358f92).lerp(new THREE.Color(0x690d27),timeline.oceanRed);
    const sunset=timeline.sunset,sky=new THREE.Color(0x9cced0),dusk=new THREE.Color(0xb78a9d),night=new THREE.Color(0x0b0b1b);
    sky.lerp(dusk,Math.min(1,sunset*1.6)).lerp(night,Math.max(0,(sunset-.25)/.75));
    this.scene.background.copy(sky);this.scene.fog.color.copy(sky);this.scene.fog.density=['home','preview'].includes(view)?.0013:.003;
    this.skyColors.skyTop.value.copy(sky);this.skyColors.skyHorizon.value.set(0xf0cebd).lerp(new THREE.Color(0x251725),sunset);
    this.world.ambient.intensity=.16+2.3*(1-sunset)**2;this.world.light.intensity=.02+3*(1-sunset)**1.8;
    this.world.light.color.set(0xffe1b6).lerp(new THREE.Color(0xc66572),sunset);
    this.sun.position.y=65*(1-sunset)-8;this.sun.material.color.set(0xffdbb0).lerp(new THREE.Color(0xa93c51),sunset);
    this.sun.visible=sunset<1;
    const lightColor=timeline.redLights?0xff324f:0x509dff;this.beacon.color.set(lightColor);this.bulbMaterial.color.set(lightColor);this.beam.material.color.set(lightColor);
    for(const marker of this.world.markers||[]){if(marker.persistentBeacon)continue;marker.ring.material.color.set(lightColor);marker.beam.material.color.set(lightColor);}
    for(const l of this.lamps){l.light.color.set(lightColor);l.halo.material.color.set(lightColor);}
    if(['home','preview'].includes(view))this.previewTime=(this.previewTime||0)+dt;
    const start=point(this.maze,[213,275]),origin=this.beacon.position,base=Math.atan2(start.x-origin.x,start.z-origin.z),a=base+timeline.beamAngle+(t===0&&['home','preview'].includes(view)?(this.previewTime||0)*Math.PI/4:0);
    let near=Infinity,far=0;const ux=Math.sin(a),uz=Math.cos(a);
    for(let d=5;d<240;d+=2){const i=this.maze.index(origin.x+ux*d,origin.z+uz*d);if(i>=0&&this.maze.rows[Math.floor(i/this.maze.width)][i%this.maze.width]!==' '){near=Math.min(near,d);far=d;}}
    const reach=far?near+(far-near)*.55:155;
    const direction=new THREE.Vector3(ux*reach,-17.6,uz*reach),length=direction.length();direction.normalize();this.beacon.target.position.copy(origin).addScaledVector(direction,length);
    this.beacon.intensity=Math.min(18000,120*length**1.25);this.beam.scale.set(length*.11,length,length*.11);
    this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),direction);
    if(view==='playing')this.trail.update(dt,round.miniatures.filter(h=>h.state==='chasing').map(h=>({...h,kind:'hunter'})),(x,z)=>this.maze.open(x,z));
    const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0);
    for(let i=0;i<this.trail.marks.length;i++){const m=this.trail.marks[i];q.setFromAxisAngle(up,m.angle);matrix.compose(new THREE.Vector3(m.x,-.045,m.z),q,new THREE.Vector3(1,1,1));this.prints.setMatrixAt(i,matrix);}
    this.prints.count=this.trail.marks.length;this.prints.instanceMatrix.needsUpdate=true;
    if(!paused)for(const s of this.splashes){s.age+=dt;for(const d of s.root.children){d.position.addScaledVector(d.userData.velocity,dt);d.userData.velocity.y-=dt*9;}s.material.opacity=Math.max(0,1-s.age/1.5);}
    this.splashes=this.splashes.filter(s=>{if(s.age<1.5)return true;s.root.removeFromParent();s.geo.dispose();s.material.dispose();return false;});
  }
}
