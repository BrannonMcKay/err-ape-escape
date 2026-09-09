import * as THREE from '../vendor/three.module.js';
import {huntersIn} from './core.js';
import {padMaterials,PadWorld} from './pad-world.js';
import {PadPowerWorld} from './pad-power-world.js';
import {padPower} from './leaky-pad.js';
import {cityMaterials,cityPropMaterial,buildCityDecor} from './city-world.js';
import {terrainBoxes} from './terrain-geometry.js';
import {updateRubbleShadows} from './city-detail.js';
import {createWallStyles,opaqueAt,GRAFFITI_STYLE,GRAFFITI_WALL_HEIGHT} from './presentation.js';
import {idlePerformance} from './runner-animation.js';
import {mountainMaterials} from './terrain-material.js';
import {terrainAt} from './terrain.js';
import {winterMaterials,buildWinterDecor,WinterWeather} from './winter-world.js';
import {STICKMAN_TUNING,isStickmanEnraged,stickmanSpeedMultiplier} from './stickman-tuning.js';

const color = { ink:0x292435, stone:0x8c819a, top:0xbaa8b2, path:0xd9c3b5, mint:0xd4ef93, pink:0xdd719d };
const mat=(c,extra={})=>new THREE.MeshStandardMaterial({color:c,roughness:.88,...extra});
function rock(c){
  const material=mat(c);
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vStonePosition;').replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
      vec4 stonePosition = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        stonePosition = instanceMatrix * stonePosition;
      #endif
      vStonePosition = (modelMatrix * stonePosition).xyz;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vStonePosition;').replace('#include <color_fragment>',`#include <color_fragment>
      float grain = fract(sin(dot(floor(vStonePosition * 34.0), vec3(12.9898,78.233,37.719))) * 43758.5453);
      float strata = sin(vStonePosition.y * 11.0 + sin(vStonePosition.x * 3.0) * 0.6 + sin(vStonePosition.z * 4.0) * 0.5);
      diffuseColor.rgb *= 0.86 + grain * 0.18 + strata * 0.035;`);
  };
  material.customProgramCacheKey=()=> 'stone-grain-v1';return material;
}
function mesh(geometry,material,parent,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function ball(parent,material,x,y,z,sx,sy=sx,sz=sx){const m=mesh(new THREE.SphereGeometry(1,16,12),material,parent,x,y,z);m.scale.set(sx,sy,sz);return m;}
function rod(parent,material,a,b,r=.065){const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),v=B.clone().sub(A);const m=mesh(new THREE.CylinderGeometry(r,r,v.length(),8),material,parent,...A.clone().add(B).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return m;}
function faceTexture(kind='runner'){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const c=canvas.getContext('2d');
  c.clearRect(0,0,256,256);c.strokeStyle='#2c2535';c.fillStyle='#2c2535';c.lineWidth=9;c.lineCap='round';
  if(kind==='grin'){
    c.lineWidth=12;c.beginPath();c.moveTo(43,58);c.lineTo(98,89);c.moveTo(158,89);c.lineTo(213,58);c.stroke();
    c.beginPath();c.ellipse(82,109,10,16,0,0,7);c.ellipse(174,109,10,16,0,0,7);c.fill();
    c.fillStyle='#fffdf2';c.beginPath();c.moveTo(39,140);c.quadraticCurveTo(128,166,217,136);c.quadraticCurveTo(199,223,132,224);c.quadraticCurveTo(65,222,39,140);c.fill();c.lineWidth=7;c.stroke();
    for(let x=66;x<213;x+=27){c.beginPath();c.moveTo(x,153);c.lineTo(x,209);c.stroke();}
  }else if(kind==='horrified'){
    c.lineWidth=7;
    for(const x of [79,177]){c.fillStyle='#fff';c.beginPath();c.ellipse(x,103,28,35,0,0,Math.PI*2);c.fill();c.stroke();c.fillStyle='#292435';c.beginPath();c.ellipse(x,108,7,11,0,0,Math.PI*2);c.fill();}
    c.beginPath();c.moveTo(48,55);c.quadraticCurveTo(76,31,107,53);c.moveTo(149,53);c.quadraticCurveTo(178,31,209,55);c.stroke();
    c.fillStyle='#292435';c.beginPath();c.ellipse(128,184,25,34,0,0,Math.PI*2);c.fill();
    c.fillStyle='#ef9aab';c.beginPath();c.ellipse(128,203,15,10,0,Math.PI,Math.PI*2);c.fill();
  }else if(kind==='happy'){
    c.lineWidth=6;
    for(const x of [82,174]){
      c.fillStyle='#fff9ed';c.beginPath();c.ellipse(x,109,20,12,-.1,0,Math.PI*2);c.fill();
      c.fillStyle='#593e39';c.beginPath();c.ellipse(x,109,9,11,0,0,Math.PI*2);c.fill();
      c.fillStyle='#fff';c.beginPath();c.arc(x-3,105,3,0,Math.PI*2);c.fill();
      c.beginPath();c.moveTo(x-21,109);c.quadraticCurveTo(x,86,x+21,106);c.stroke();
    }
    c.beginPath();c.moveTo(59,78);c.quadraticCurveTo(82,67,104,80);c.moveTo(153,80);c.quadraticCurveTo(176,67,198,78);c.stroke();
    c.fillStyle='#ae5468';c.beginPath();c.moveTo(89,157);c.quadraticCurveTo(128,174,168,153);c.quadraticCurveTo(139,204,104,180);c.closePath();c.fill();
    c.fillStyle='#fff9ed';c.beginPath();c.moveTo(96,163);c.quadraticCurveTo(130,176,160,160);c.lineTo(154,169);c.quadraticCurveTo(129,184,102,170);c.closePath();c.fill();
    c.fillStyle='rgba(238,126,147,.48)';c.beginPath();c.ellipse(49,147,19,10,0,0,7);c.ellipse(207,147,19,10,0,0,7);c.fill();
  }else if(kind==='pout'){
    c.beginPath();c.moveTo(53,84);c.lineTo(96,99);c.moveTo(161,99);c.lineTo(205,84);c.stroke();
    c.beginPath();c.arc(126,186,32,Math.PI*1.12,Math.PI*1.88);c.stroke();
  }else{
    c.beginPath();c.ellipse(82,109,kind==='runner'?8:10,17,0,0,Math.PI*2);c.ellipse(174,109,kind==='runner'?8:10,17,0,0,Math.PI*2);c.fill();
    c.beginPath();c.moveTo(59,73);c.quadraticCurveTo(81,kind==='runner'?61:48,103,76);c.moveTo(151,76);c.quadraticCurveTo(177,60,199,69);c.stroke();
    c.beginPath();c.arc(129,139,kind==='runner'?25:40,.18,Math.PI-.18);c.stroke();
  }
  if(kind==='runner'){c.fillStyle='rgba(238,126,147,.48)';c.beginPath();c.ellipse(48,149,16,9,0,0,7);c.ellipse(207,149,16,9,0,0,7);c.fill();}
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function face(parent,kind,r,y,z){return mesh(new THREE.PlaneGeometry(r*1.75,r*1.75),new THREE.MeshBasicMaterial({map:faceTexture(kind),transparent:true,depthWrite:false}),parent,0,y,z);}

export function makeRunner(){
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);
  const skin=mat(0xeac1a4),jacket=mat(0xc8e59b),pants=mat(0x393341),boots=mat(0x272735),hair=mat(0x654548),ends=mat(color.pink);
  const limbs=[],elbows=[];
  for(const side of [-1,1]){
    const leg=new THREE.Group();leg.position.set(side*.13,.68,0);body.add(leg);rod(leg,pants,[0,0,0],[0,-.5,0],.1);ball(leg,boots,0,-.52,.06,.12,.1,.2);limbs.push(leg);
    const arm=new THREE.Group();arm.position.set(side*.22,1.12,0);body.add(arm);rod(arm,jacket,[0,0,0],[side*.02,-.20,.015],.085);
    const elbow=new THREE.Group();elbow.position.set(side*.02,-.20,.015);arm.add(elbow);ball(elbow,jacket,0,0,0,.082);rod(elbow,jacket,[0,0,0],[0,-.17,.025],.075);ball(elbow,skin,0,-.20,.03,.08);elbows.push(elbow);limbs.push(arm);
  }
  mesh(new THREE.CylinderGeometry(.20,.16,.55,12),jacket,body,0,.93,0);
  rod(body,skin,[0,1.15,0],[0,1.33,0],.09);
  ball(body,skin,0,1.62,.03,.36,.40,.33);
  const crown=mesh(new THREE.SphereGeometry(1,24,16,0,Math.PI*2,0,1.15),hair,body,0,1.62,.025);crown.scale.set(.385,.435,.355);
  ball(body,hair,0,1.56,-.15,.34,.40,.20);
  const expression=face(body,'runner',.34,1.60,.369),happyTexture=faceTexture('happy'),normalTexture=expression.material.map;
  // A small upturned, pointed profile, inspired by the escape portrait.
  ball(body,skin,0,1.62,.368,.039,.078,.05);
  const nose=mesh(new THREE.ConeGeometry(.053,.145,12),skin,body,0,1.574,.416);nose.rotation.x=Math.PI/2-.16;
  ball(body,skin,0,1.586,.485,.017,.017,.022);
  const strands=[];
  for(let i=0;i<7;i++){
    const strand=new THREE.Group();strand.position.set((i-3)*.092,1.65,-.23);body.add(strand);
    ball(strand,hair,0,-.22,0,.10,.38,.09);
    ball(strand,ends,.01,-.50,-.025,.085,.27,.085);strands.push(strand);
  }
  ball(body,hair,-.27,1.77,.18,.13,.23,.17);
  ball(body,hair,.19,1.91,.13,.23,.12,.22);
  const carry=new THREE.Group();carry.position.set(0,.96,.36);body.add(carry);
  root.scale.setScalar(.85);
  let turn=0,idleBlend=0,photoBlend=0;
  const dampAngle=(from,to,f)=>from+Math.atan2(Math.sin(to-from),Math.cos(to-from))*f;
  return {root,body,carry,hairLocks:strands,get photoBlend(){return photoBlend;},animate(t,moving,holding,seconds=0,dt=1/60,cameraOffset=Math.PI,reducedMotion=false,powered=false){
    const idle=idlePerformance(seconds,holding,reducedMotion),ease=1-Math.exp(-12*dt);
    idleBlend+=(idle.blend-idleBlend)*ease;photoBlend+=((idle.mode==='cuddle'?idle.blend:0)-photoBlend)*ease;
    const facing=idle.mode==='cuddle'?cameraOffset:idle.yaw;
    turn=dampAngle(turn,facing,ease);body.rotation.set(0,turn,0);body.position.set(0,0,0);
    limbs.forEach(l=>l.rotation.set(0,0,0));elbows.forEach(e=>e.rotation.set(0,0,0));
    const a=moving?Math.sin(t*13)*.55:Math.sin(t*2)*.025;
    limbs[0].rotation.x=a;limbs[2].rotation.x=-a;
    limbs[1].rotation.x=holding?-.7:-a;limbs[3].rotation.x=holding?-.7:a;
    elbows.forEach(e=>e.rotation.x=holding?-1:.12);
    body.position.y=moving?Math.abs(Math.sin(t*13))*.04:0;
    if(idleBlend>.001){
      const sway=Math.sin(idle.beat),bounce=reducedMotion?0:Math.pow(Math.sin(idle.beat),2)*.035;
      body.position.y+=bounce*idleBlend;body.rotation.z=sway*(holding?.035:.075)*idleBlend;
      if(idle.mode==='dance'){
        body.position.x=sway*.045*idleBlend;
        limbs[0].rotation.x=THREE.MathUtils.lerp(a,.2*Math.sin(idle.beat+.6),idleBlend);
        limbs[2].rotation.x=THREE.MathUtils.lerp(-a,-.2*Math.sin(idle.beat+.6),idleBlend);
        limbs[1].rotation.x=THREE.MathUtils.lerp(-a,-.18,idleBlend);limbs[3].rotation.x=THREE.MathUtils.lerp(a,-.25,idleBlend);
        limbs[1].rotation.z=(-2.45+.18*Math.sin(idle.beat*.6))*idleBlend;
        limbs[3].rotation.z=(1.25+.3*Math.sin(idle.beat*.7))*idleBlend;
        elbows[0].rotation.z=-.6*idleBlend;elbows[1].rotation.z=(.45+.3*Math.sin(idle.beat))*idleBlend;
      }else if(idle.mode==='cuddle'){
        limbs[1].rotation.z=-.12*photoBlend;limbs[3].rotation.z=-.15*photoBlend;
        body.rotation.x=-.025*photoBlend;
      }
    }
    carry.position.set(-.18*photoBlend,.96+.11*photoBlend,.36+.04*photoBlend);carry.rotation.z=.08*photoBlend;
    expression.material.map=idleBlend>.2?happyTexture:normalTexture;
    const rushing=powered&&moving;
    strands.forEach((s,i)=>{s.rotation.x=(rushing?1.1:.1)+Math.sin(t*(rushing?16:moving?9:2)+i*.8)*(moving?.25:.05)+idle.twirl*.32*idleBlend;s.rotation.z=rushing?Math.sin(t*11+i*.6)*.14:idle.mode==='dance'?Math.sin(idle.beat+i*.45)*.09*idleBlend:0;s.scale.y=rushing?1.35:1;});
  },throwTiny(remaining){
    const swing=Math.sin(Math.PI*(1-remaining/.85));limbs[3].rotation.z=-1.9*swing;limbs[3].rotation.x=-1.1*swing;elbows[1].rotation.x=-.8*swing;body.rotation.z=-.12*swing;expression.material.map=happyTexture;
  },tackle(t){
    body.rotation.x=body.rotation.y=0;body.position.x=0;expression.material.map=normalTexture;
    const fall=THREE.MathUtils.smoothstep(t,.85,1.6);body.rotation.z=-fall*1.38;body.position.y=fall*.18;
    limbs[0].rotation.x=-fall*.7;limbs[2].rotation.x=fall*.55;limbs[1].rotation.z=-fall*.65;limbs[3].rotation.z=fall*.65;
  },reset(){turn=idleBlend=photoBlend=0;strands.forEach(s=>{s.rotation.set(0,0,0);s.scale.set(1,1,1);});limbs.forEach(l=>l.rotation.set(0,0,0));elbows.forEach(e=>e.rotation.set(0,0,0));body.rotation.set(0,0,0);body.position.set(0,0,0);carry.position.set(0,.96,.36);carry.rotation.set(0,0,0);expression.material.map=normalTexture;}};
}
export function makeStickman(weapon=null){
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);const ink=mat(color.ink),white=mat(STICKMAN_TUNING.calmFace);const limbs=[];
  const calmFace=new THREE.Color(STICKMAN_TUNING.calmFace),rageFace=new THREE.Color(STICKMAN_TUNING.rageFace);
  rod(body,ink,[0,.7,0],[0,1.5,0],.045);
  for(const side of [-1,1]){
    const leg=new THREE.Group();leg.position.set(0,.76,0);body.add(leg);rod(leg,ink,[0,0,0],[side*.16,-.36,0],.043);rod(leg,ink,[side*.16,-.36,0],[side*.25,-.72,.07],.043);limbs.push(leg);
    const arm=new THREE.Group();arm.position.set(0,1.37,0);body.add(arm);rod(arm,ink,[0,0,0],[side*.3,-.23,0],.04);rod(arm,ink,[side*.3,-.23,0],[side*.46,-.1,.13],.04);
    for(let i=-1;i<=1;i++)rod(arm,ink,[side*.46,-.1,.13],[side*(.55+i*.035),-.03+i*.07,.15],.02);limbs.push(arm);
  }
  const head=new THREE.Group();head.position.y=1.85;body.add(head);
  ball(head,new THREE.MeshBasicMaterial({color:color.ink,side:THREE.BackSide}),0,0,0,.435);ball(head,white,0,0,.025,.403,.403,.412);
  const smile=face(head,'smile',.37,0,.442),pout=face(head,'pout',.37,0,.444),grin=face(head,'grin',.40,0,.445),horror=face(head,'horrified',.40,0,.446);pout.visible=false;grin.visible=false;horror.visible=false;
  const ears=new THREE.Group(),flail=new THREE.Group();body.add(ears,flail);ears.visible=flail.visible=false;
  const cling=new THREE.Group();body.add(cling);cling.visible=false;
  for(const side of [-1,1]){
    rod(cling,ink,[0,1.37,0],[side*.36,1.74,.12],.04);rod(cling,ink,[side*.36,1.74,.12],[side*.28,2.17,.45],.04);
    ball(cling,ink,side*.28,2.17,.45,.06);for(let i=-1;i<=1;i++)rod(cling,ink,[side*.28,2.17,.45],[side*(.26+i*.05),2.2,.54],.018);
  }
  for(const side of [-1,1]){
    rod(ears,ink,[0,1.37,0],[side*.63,1.43,.06],.04);rod(ears,ink,[side*.63,1.43,.06],[side*.40,1.86,.08],.04);
    ball(ears,ink,side*.40,1.86,.08,.065);
    rod(flail,ink,[0,1.37,0],[side*.38,1.65,0],.04);rod(flail,ink,[side*.38,1.65,0],[side*.64,2.04,.08],.04);
    for(let i=-1;i<=1;i++){rod(ears,ink,[side*.40,1.86,.08],[side*.39,1.88+i*.065,.21],.018);rod(flail,ink,[side*.64,2.04,.08],[side*(.66+i*.075),2.18,.10],.018);}
  }
  const hammer=new THREE.Group(),grip=new THREE.Group(),gripSegments=[];body.add(hammer,grip);hammer.visible=grip.visible=!!weapon;hammer.position.set(.35,1.2,.2);
  if(weapon){
    const wood=mat(0x99603b),steel=mat(0x667783,{metalness:.65,roughness:.43});
    rod(hammer,wood,[0,-.55,0],[0,1.02,0],.055);
    mesh(new THREE.BoxGeometry(1.04,.43,.49),steel,hammer,0,1.02,0);
    for(const side of [-1,1])mesh(new THREE.BoxGeometry(.07,.46,.52),mat(0xb6babe,{metalness:.7,roughness:.4}),hammer,side*.51,1.02,0);
    for(let i=0;i<4;i++)gripSegments.push(mesh(new THREE.CylinderGeometry(.04,.04,1,8),ink,grip));
  }
  function poseGrip(raised=0){
    if(!weapon)return;grip.rotation.set(0,0,0);grip.position.set(0,0,0);
    for(let side=0;side<2;side++){
      const shoulder=new THREE.Vector3(0,1.37,0),hand=new THREE.Vector3(0,-.07-side*.28,0).applyEuler(hammer.rotation).add(hammer.position);
      const elbow=shoulder.clone().lerp(hand,.5);elbow.x+=(side?1:-1)*.3;elbow.z+=.10;
      // The raised salute goes around the side of his head, including the arms.
      elbow.lerp(new THREE.Vector3(hand.x+.18,1.4,.18),raised);
      for(const [n,a,b] of [[side*2,shoulder,elbow],[side*2+1,elbow,hand]]){const v=b.clone().sub(a),m=gripSegments[n];m.position.copy(a).add(b).multiplyScalar(.5);m.scale.y=v.length();m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());}
    }
  }
  return {root,faceColor:null,faceCamera:weapon?STICKMAN_TUNING.giantFaceCamera:STICKMAN_TUNING.faceCamera,lookAtCamera(camera,enraged){
    if(this.faceColor!==null)white.color.set(this.faceColor);else white.color.copy(enraged?rageFace:calmFace);
    // The parent may be leaning, running, or tackling. lookAt compensates for it.
    if(this.faceCamera)head.lookAt(camera.position);else head.quaternion.identity();
  },animate(t,moving,stunned,panic=null,speedMultiplier=1){
    stunned=!!stunned;
    cling.visible=false;
    const rate=(panic?23:12)*speedMultiplier,a=moving?Math.sin(t*rate)*(panic?1.05:.7):Math.sin(t*3)*.05;
    limbs.forEach(l=>l.rotation.set(0,0,0));limbs[0].rotation.x=a;limbs[2].rotation.x=-a;limbs[1].rotation.x=-a;limbs[3].rotation.x=a;
    limbs[1].visible=limbs[3].visible=!panic;ears.visible=panic?.kind==='scream';flail.visible=panic?.kind==='period';flail.rotation.z=Math.sin(t*17)*.07;
    if(weapon){grip.rotation.set(0,0,0);grip.position.set(0,0,0);limbs[1].visible=limbs[3].visible=false;grip.visible=!panic;hammer.rotation.set(panic?-.25:0,0,panic?-.35:Math.sin(t*3)*.025);hammer.position.set(.35,1.2,.2);}
    body.rotation.set(panic&&moving?.18:0,0,panic?Math.sin(t*18)*.065:stunned?Math.sin(t*6)*.15:0);body.position.y=moving?Math.abs(Math.sin(t*rate))*(panic?.13:.07):0;
    smile.visible=!stunned&&!panic;pout.visible=stunned&&!panic;horror.visible=!!panic;grin.visible=false;
    poseGrip();
  },hang(t){
    limbs[1].visible=limbs[3].visible=false;cling.visible=true;ears.visible=flail.visible=false;
    body.position.y=0;body.rotation.set(0,0,Math.sin(t*3)*.035);limbs[0].rotation.x=.12+Math.sin(t*3)*.13;limbs[2].rotation.x=-.1-Math.sin(t*3)*.12;
    smile.visible=true;pout.visible=horror.visible=grin.visible=false;
  },tackle(t){
    cling.visible=false;
    smile.visible=false;pout.visible=false;horror.visible=false;grin.visible=true;ears.visible=flail.visible=false;limbs[1].visible=limbs[3].visible=true;
    const charge=THREE.MathUtils.smoothstep(t,.35,.95),recover=THREE.MathUtils.smoothstep(t,1.05,1.7);
    body.rotation.x=.6*charge*(1-recover);body.rotation.z=-.09*(1-recover);
    body.position.y=t<1.1?Math.sin(Math.min(1,Math.max(0,(t-.35)/.75))*Math.PI)*.42:0;
    limbs[1].rotation.x=limbs[3].rotation.x=-1.25*(1-recover);
    limbs[1].rotation.z=recover*.85;limbs[3].rotation.z=-recover*.85;
  },hammerStrike(t){
    smile.visible=pout.visible=horror.visible=ears.visible=flail.visible=false;grin.visible=true;
    limbs[1].visible=limbs[3].visible=false;grip.visible=true;
    const windup=THREE.MathUtils.smoothstep(t,.1,.65),swing=THREE.MathUtils.smoothstep(t,.7,.98),recover=THREE.MathUtils.smoothstep(t,1.3,2.25);
    hammer.position.set(.35*(1-swing)*(1-recover)+.90*recover,1.2+1.26*recover,.2+.03*recover);
    hammer.rotation.set((-1.05*windup+3.05*swing)*(1-recover),0,-1.45*recover);
    body.rotation.set(.11*swing*(1-recover),0,0);body.position.y=0;
    // Recover into a sideways shoulder salute, clear of his head and grin.
    // Both stick arms follow the shaft through the wind-up, bonk and victory pose.
    poseGrip(recover);
  },reset(){limbs.forEach(l=>{l.rotation.set(0,0,0);l.visible=true;});body.rotation.set(0,0,0);head.quaternion.identity();white.color.copy(calmFace);ears.visible=flail.visible=horror.visible=cling.visible=false;}};
}
function makeCat(kind='ginger'){
  const stubby=kind==='stubby',g=new THREE.Group(),orange=mat(stubby?0x9a8a70:0xf4b765),white=mat(stubby?0xf5f1e5:0xffe9c9),ink=mat(color.ink),pink=mat(0xdb9291);
  if(stubby){
    orange.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vFur;').replace('#include <begin_vertex>','#include <begin_vertex>\nvFur=position;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vFur;').replace('#include <color_fragment>',`#include <color_fragment>
        float stripe=smoothstep(0.18,0.58,sin(vFur.z*23.0+sin(vFur.y*12.0)*1.8+sin(vFur.x*8.0)));
        diffuseColor.rgb*=mix(vec3(0.28,0.27,0.25),vec3(1.0),stripe);`);
    };orange.customProgramCacheKey=()=> 'stubby-tabby-v1';
  }
  ball(g,orange,0,.22,0,stubby?.27:.23,.23,.34);ball(g,orange,0,.44,.18,.25,.23,.215);
  if(stubby){
    ball(g,white,0,.28,.24,.205,.255,.18);ball(g,white,0,.465,.377,.044,.17,.035);
    for(let i=0;i<7;i++){const a=i/6*Math.PI;ball(g,white,Math.cos(a)*.17,.32-Math.sin(a)*.15,.285,.075,.11,.06);}
    for(const s of [-1,1]){ball(g,white,s*.15,.07,-.18,.08,.07,.1);ball(g,white,s*.15,.08,.19,.085,.085,.12);}
  }
  for(const s of [-1,1]){
    const e=mesh(new THREE.ConeGeometry(.105,.22,3),orange,g,s*.16,.64,.18);e.rotation.y=Math.PI/2;
    if(stubby){const inner=mesh(new THREE.ConeGeometry(.063,.14,3),mat(0xc79f91),g,s*.16,.645,.211);inner.rotation.y=Math.PI/2;ball(g,mat(0xb8bb70),s*.097,.48,.375,.043,.052,.019);ball(g,ink,s*.097,.48,.393,.012,.037,.009);ball(g,white,s*.087,.497,.4,.009);}
    else ball(g,ink,s*.085,.47,.358,.024,.035,.012);
    ball(g,white,s*.075,.385,.374,.085,.056,.043);if(!stubby)ball(g,white,s*.14,.075,.18,.075);
  }
  ball(g,pink,0,.422,.42,.028,.023,.02);
  const tail=new THREE.Group();g.add(tail);rod(tail,orange,[0,.24,-.22],[.1,.43,-.5],.065);rod(tail,orange,[.1,.43,-.5],[.16,.64,-.49],.057);
  for(const s of [-1,1])for(let i=-1;i<=1;i++)rod(g,stubby?white:ink,[s*.13,.4,.39],[s*.34,.4+i*.045,.36],.005);
  const cooldown=label('45s','#ede0c7');cooldown.position.set(0,1.02,0);cooldown.scale.set(1.15,.29,1);cooldown.material.depthTest=true;cooldown.visible=false;g.add(cooldown);
  const nameTag=stubby?label('STUBBY','#eee5c8'):null;if(nameTag){nameTag.position.y=.99;nameTag.scale.set(1.0,.25,1);nameTag.material.depthTest=true;g.add(nameTag);}
  return {root:g,tail,cooldown,nameTag};
}
function label(text,bg='#d4ef93',fg='#272532'){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const c=canvas.getContext('2d');
  c.fillStyle=bg;c.beginPath();c.roundRect(4,4,504,110,30);c.fill();c.fillStyle=fg;c.font='bold 43px Segoe UI, sans-serif';c.textAlign='center';c.fillText(text,256,73);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map,depthTest:false}));sprite.scale.set(10,2.5,1);
  sprite.userData.setText=value=>{if(sprite.userData.lastText===value)return;sprite.userData.lastText=value;c.clearRect(0,0,512,128);c.fillStyle=bg;c.beginPath();c.roundRect(4,4,504,110,30);c.fill();c.fillStyle=fg;c.fillText(value,256,73);map.needsUpdate=true;};return sprite;
}
// Merge contiguous equal cells into rectangles before instancing the stone blocks.
function rectangles(maze,predicate){
  const {width:w,height:h,rows}=maze,seen=new Uint8Array(w*h),rects=[];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    if(seen[y*w+x]||!predicate(rows[y][x],x,y))continue;
    let rw=1;while(x+rw<w&&!seen[y*w+x+rw]&&predicate(rows[y][x+rw],x+rw,y))rw++;
    let rh=1;outer:while(y+rh<h){for(let k=0;k<rw;k++)if(seen[(y+rh)*w+x+k]||!predicate(rows[y+rh][x+k],x+k,y+rh))break outer;rh++;}
    for(let j=0;j<rh;j++)for(let k=0;k<rw;k++)seen[(y+j)*w+x+k]=1;
    rects.push({x,y,w:rw,h:rh});
  }return rects;
}

export class World{
  constructor(canvas,maze,renderer=null){
    this.maze=maze;this.scene=new THREE.Scene();this.scene.background=new THREE.Color(maze.presentation?.theme?.colors.sky||0x282736);this.scene.fog=new THREE.FogExp2(maze.presentation?.theme?.colors.fog||0x958090,.003);
    this.wallStyles=createWallStyles(maze);this.cutaway={active:{value:0},center:{value:new THREE.Vector2()},ground:{value:0}};
    this.renderer=renderer||new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;
    this.camera=new THREE.PerspectiveCamera(45,1,.06,700);
    this.ambient=new THREE.HemisphereLight(0xeaf5ff,maze.id==='snowman'?0x829eb6:0x5f6040,2.6);this.scene.add(this.ambient);
    const sun=new THREE.DirectionalLight(0xffebc9,3);sun.position.set(-60,110,40);sun.castShadow=true;
    sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-90,right:90,top:90,bottom:-90,near:1,far:270});sun.shadow.bias=-.001;sun.shadow.normalBias=.12;this.scene.add(sun);
    this.light=sun;this.buildMaze();this.buildScenery();this.buildArtwork();
    if(maze.id==='snowman')this.weather=new WinterWeather(this.scene,maze);
    this.runner=makeRunner();this.stickman=makeStickman();this.scene.add(this.runner.root,this.stickman.root);
    if(maze.id==='leaky-pad')this.padPower=new PadPowerWorld(this);
    this.miniModels=new Map();if(maze.id==='leaky-pad')this.stickman.root.visible=false;
    this.extraStickmen=(maze.presentation?.extraHunters||[]).map(h=>{const model=makeStickman(h.weapon);this.scene.add(model.root);return model;});
    this.cats=[makeCat(),makeCat(),makeCat('stubby')];this.cats.forEach(c=>this.scene.add(c.root));
    this.buildFoodBowl();
    this.startMarker=this.makeMarker(maze.point(maze.startIndex),0xd4ef93,'YOU START HERE',-4);
    if(maze.id==='pound-town'){this.startMarker.groundOnly=true;this.startMarker.ring.visible=false;}
    this.exitMarker=this.makeMarker(maze.point(maze.exitIndex),maze.id==='leaky-pad'?0xff75bb:0xf3b48b,maze.id==='leaky-pad'?'EXIT · FOLLOW THE PINK LIGHT':'EXIT + STICKMAN',4);
    if(maze.id==='leaky-pad'){
      this.exitMarker.persistentBeacon=true;this.exitMarker.beam.scale.set(4.5,8,4.5);this.exitMarker.beam.position.y=32;this.exitMarker.beam.material.opacity=.7;this.exitMarker.beam.material.depthWrite=false;
      const glow=mesh(new THREE.CylinderGeometry(1.2,1.2,64,24,1,true),new THREE.MeshBasicMaterial({color:0xff75bb,transparent:true,opacity:.12,depthWrite:false,side:THREE.DoubleSide}),this.exitMarker.root,0,32,0);glow.castShadow=false;
    }
    this.markers=[this.startMarker,this.exitMarker];
    for(const h of maze.presentation?.extraHunters||[])this.markers.push(this.makeMarker(maze.point(h.cell[1]*maze.width+h.cell[0]),0xf3b48b,'SLEDGEHAMMER GIANT',4));
    this.orbit=0;this.zoom=1;this.look=new THREE.Vector3();this.temp=new THREE.Vector3();this.lastSize='';
    this.camera.position.set(100,125,130);this.camera.lookAt(0,0,12);
    this.effects=[];
    this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
    if(!document.getElementById('speech-styles')){const speechStyle=document.createElement('link');speechStyle.id='speech-styles';speechStyle.rel='stylesheet';speechStyle.href=new URL('./speech.css',import.meta.url).href;document.head.append(speechStyle);}
    this.speech={};
    for(const [who,name] of [['player','Christel'],['hunter','Stickman'],...(maze.presentation?.extraHunters||[]).map(h=>[h.id,h.name])]){
      const bubble=document.createElement('div');bubble.className=`character-speech ${who==='player'?'runner-speech':''}`;bubble.setAttribute('role','status');bubble.setAttribute('aria-label',`${name} says`);bubble.hidden=true;document.body.append(bubble);this.speech[who]=bubble;
    }
  }
  dispose(){
    const geometries=new Set(),materials=new Set(),textures=new Set();
    this.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:o.material?[o.material]:[]))materials.add(m);});
    for(const m of materials){for(const value of Object.values(m))if(value?.isTexture)textures.add(value);for(const u of Object.values(m.uniforms||{}))if(u.value?.isTexture)textures.add(u.value);for(const t of m.userData.disposableTextures||[])textures.add(t);m.dispose();}
    textures.forEach(t=>t.dispose());geometries.forEach(g=>g.dispose());Object.values(this.speech).forEach(b=>b.remove());this.renderer.renderLists.dispose();this.scene.clear();
  }
  cutawayMaterial(material){
    const prior=material.onBeforeCompile,priorKey=material.customProgramCacheKey();
    material.onBeforeCompile=shader=>{
      prior.call(material,shader);shader.uniforms.uCapture=this.cutaway.active;shader.uniforms.uCaptureCenter=this.cutaway.center;shader.uniforms.uCaptureGround=this.cutaway.ground;
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vCutawayPosition;').replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
        vec4 cutPos = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          cutPos = instanceMatrix * cutPos;
        #endif
        vCutawayPosition = (modelMatrix * cutPos).xyz;`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vCutawayPosition;\nuniform float uCapture;\nuniform float uCaptureGround;\nuniform vec2 uCaptureCenter;').replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
        if(uCapture > 0.5 && distance(vCutawayPosition.xz,uCaptureCenter)<6.5 && vCutawayPosition.y>uCaptureGround+0.25) discard;`);
    };
    material.customProgramCacheKey=()=>priorKey+'-capture-cutaway';return material;
  }
  buildMaze(){
    const maze=this.maze,s=maze.cellSize;
    const create=(rects,height,y,materials,variation=0)=>{
      if(maze.slope.nonlinear){
        for(const material of Array.isArray(materials)?materials:[materials])material.vertexColors=true;
        const mesh=new THREE.Mesh(terrainBoxes(maze,rects,height,y,variation),materials);mesh.castShadow=height>1;mesh.receiveShadow=true;this.scene.add(mesh);return mesh;
      }
      const geo=new THREE.BoxGeometry(1,1,1),batch=new THREE.InstancedMesh(geo,materials,rects.length),m=new THREE.Matrix4(),q=new THREE.Quaternion();
      rects.forEach((r,i)=>{m.compose(new THREE.Vector3((r.x+r.w/2-maze.width/2)*s,y,(r.y+r.h/2-maze.height/2)*s),q,new THREE.Vector3(r.w*s,height,r.h*s));m.elements[1]=maze.slope.x*r.w*s;m.elements[9]=maze.slope.z*r.h*s;m.elements[13]+=maze.heightAt(m.elements[12],m.elements[14]);batch.setMatrixAt(i,m);if(variation)batch.setColorAt(i,new THREE.Color().setScalar(.91+((r.x*13+r.y*7)%19)/100));});
      batch.castShadow=height>1;batch.receiveShadow=true;this.scene.add(batch);return batch;
    };
    const terrain=maze.presentation?.theme?.id==='mountain-seasons'?mountainMaterials(maze):maze.id==='snowman'?winterMaterials(maze):maze.id==='pound-town'?cityMaterials():maze.id==='leaky-pad'?(this.padMaterials=padMaterials(maze)):null;
    const wallMat=this.cutawayMaterial(terrain?.wall||rock(color.stone)),topMat=this.cutawayMaterial(terrain?.top||rock(color.top)),sideMat=maze.id==='leaky-pad'?mat(0xc4d4cf):rock(terrain?0x554532:0x514859);
    const h=maze.presentation?.wallHeights||{tall:3.4,low:1.05,sill:.65,lintel:2.75};
    const materials=[wallMat,wallMat,topMat,wallMat,wallMat,wallMat];
    const styleRects=style=>rectangles(maze,(c,x,y)=>c==='#'&&this.wallStyles[y*maze.width+x]===style);
    this.walls=create(styleRects(0),h.tall,h.tall/2,materials,1);
    this.lowWalls=create(styleRects(1),h.low,h.low/2,materials,1);
    if(maze.id==='pound-town')create(styleRects(GRAFFITI_STYLE),GRAFFITI_WALL_HEIGHT,GRAFFITI_WALL_HEIGHT/2,materials);
    const windows=styleRects(2),glass=this.cutawayMaterial(new THREE.MeshStandardMaterial({color:0x9ee7dd,transparent:true,opacity:.19,roughness:.12,metalness:.15,depthWrite:false}));
    create(windows,h.sill,h.sill/2,materials);
    create(windows,h.tall-h.lintel,(h.tall+h.lintel)/2,materials);
    this.windows=create(windows,h.lintel-h.sill,(h.lintel+h.sill)/2,glass);this.windows.castShadow=false;if(maze.id==='pound-town')this.windows.visible=false;
    for(const [i,prop] of (maze.presentation?.solidProps||[]).entries()){
      if(prop.id==='hammer-handle')continue; // One round timber shaft replaces the rectangular fill.
      const material=this.cutawayMaterial(cityPropMaterial(prop));create(styleRects(i+3),prop.height,prop.height/2,material);
    }
    // Narrow mullions at the ends of each window make the transparent barrier legible.
    const posts=windows.flatMap(r=>r.h>r.w?[{...r,h:.18},{...r,y:r.y+r.h-.18,h:.18}]:[{...r,w:.18},{...r,x:r.x+r.w-.18,w:.18}]);
    create(posts,h.lintel-h.sill,(h.lintel+h.sill)/2,this.cutawayMaterial(mat(0x827577)));
    this.floor=create(rectangles(maze,c=>c!== ' '),3,-1.56,[sideMat,sideMat,terrain?.ground||rock(color.path),sideMat,sideMat,sideMat]);
    if(maze.id==='leaky-pad'){this.floor.castShadow=false;this.walls.castShadow=this.lowWalls.castShadow=true;}
    // Small pebbles give the paper-derived paths a grounded, rocky surface.
    const pebbleGeo=new THREE.DodecahedronGeometry(.06),pebbleMat=mat(terrain?0xffffff:0x95808b);
    const spots=[];if(!['snowman','leaky-pad'].includes(maze.id))for(let i=0;i<maze.walk.length;i+=23)if(maze.walk[i])spots.push(maze.point(i));
    const pebbles=new THREE.InstancedMesh(pebbleGeo,pebbleMat,spots.length),m=new THREE.Matrix4();
    spots.forEach((p,i)=>{m.makeTranslation(p.x,maze.heightAt(p.x,p.z)+.01,p.z);pebbles.setMatrixAt(i,m);if(terrain)pebbles.setColorAt(i,new THREE.Color(terrainAt(maze,p.x,p.z).snow>.5?0xe1eef0:0x887052));});this.scene.add(pebbles);
  }
  buildScenery(){
    const scene=this.scene;
    if(this.maze.id==='leaky-pad'){this.pad=new PadWorld(this);return;}
    if(this.maze.id==='snowman'){buildWinterDecor(this);return;}
    if(this.maze.id==='pound-town'){buildCityDecor(this);return;}
    const seasonal=this.maze.presentation?.theme?.id==='mountain-seasons';
    const backdrop=mesh(new THREE.PlaneGeometry(1100,1100),mat(seasonal?0x81938b:0x68617c),scene,0,-9,0);backdrop.rotation.x=-Math.PI/2;backdrop.castShadow=false;
    for(let i=0;i<24;i++){
      const a=i/24*Math.PI*2,r=102+(i*17)%30,h=15+(i*11)%31;
      const mountain=mesh(new THREE.ConeGeometry(14+(i*3)%10,h,5),mat(seasonal?(i%2?0x637e83:0x849998):(i%2?0x65586f:0x786778)),scene,Math.cos(a)*r,h/2-8,Math.sin(a)*r);
      mountain.rotation.y=i*1.7;mountain.castShadow=false;
      const cap=mesh(new THREE.ConeGeometry((14+(i*3)%10)*.285,h*.285,5),mat(seasonal?0xe8f2f5:0xdccdd1),mountain,0,h*.36,0);cap.castShadow=false;
    }
    if(!this.maze.presentation?.artLayers?.length){const sun=mesh(new THREE.SphereGeometry(10,32,24),new THREE.MeshBasicMaterial({color:0xffd5a2}),scene,-76,65,-115);sun.castShadow=false;}
    const rng=(n)=>{const x=Math.sin(n*123.13)*43758.5453;return x-Math.floor(x);};
    const starGeo=new THREE.BufferGeometry(),arr=[];for(let i=0;i<180;i++)arr.push((rng(i+1)-.5)*500,40+rng(i+4)*100,(rng(i+9)-.5)*500);
    starGeo.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));this.sparks=new THREE.Points(starGeo,new THREE.PointsMaterial({color:0xffe5c4,size:.23,transparent:true,opacity:.65}));scene.add(this.sparks);
  }
  buildArtwork(){
    const maze=this.maze,p=maze.presentation;this.artwork=new THREE.Group();this.graffiti=new THREE.Group();this.scene.add(this.artwork,this.graffiti);
    if(!p)return;
    const city=maze.id==='pound-town';
    const texture=new THREE.TextureLoader().load(maze.source,t=>{
      if(!city)return;
      // Mask the original ink before mipmapping. Thresholding a reduced photo
      // was losing the thin pen strokes in WHOAAA and GET POUNDED from the sky.
      const c=document.createElement('canvas');c.width=t.image.width;c.height=t.image.height;const ctx=c.getContext('2d');ctx.drawImage(t.image,0,0);
      const pixels=ctx.getImageData(0,0,c.width,c.height),data=pixels.data;
      for(let i=0;i<data.length;i+=4){const g=data[i+1]/255,alpha=1-THREE.MathUtils.smoothstep(g,.24,.5);data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.round(alpha*255);}
      ctx.putImageData(pixels,0,0);t.image=c;t.needsUpdate=true;
    });texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
    const [iw,ih]=p.sourceSize,scale=maze.cellSize/maze.sourceStep;
    const inkMaterial=tint=>new THREE.ShaderMaterial({uniforms:{photo:{value:texture},ink:{value:new THREE.Color(tint)},isSkySun:{value:0}},transparent:true,depthWrite:false,side:THREE.DoubleSide,
      vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:`uniform sampler2D photo; uniform vec3 ink; uniform float isSkySun; varying vec2 vUv;
        void main(){vec2 sourcePixel=vec2(vUv.x*1079.0,(1.0-vUv.y)*1297.0);
        if(isSkySun>0.5 && ((sourcePixel.y>355.0 && sourcePixel.x>275.0)||(sourcePixel.x>440.0 && sourcePixel.y>280.0)||sourcePixel.y>450.0))discard;
        vec4 pixel=texture2D(photo,vUv);float alpha=${city?'pixel.a':'1.0-smoothstep(0.055,0.15,pixel.g)'};if(alpha<0.015)discard;gl_FragColor=vec4(ink,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`});
    const cutout=(layer,width,height)=>{
      const [x,y,w,h]=layer.crop,geometry=new THREE.PlaneGeometry(width,height,maze.slope.nonlinear?Math.ceil(width/.36):1,maze.slope.nonlinear?Math.ceil(height/.36):1),uv=geometry.attributes.uv;
      for(let i=0;i<uv.count;i++)uv.setXY(i,(x+uv.getX(i)*w)/iw,1-(y+(1-uv.getY(i))*h)/ih);
      return new THREE.Mesh(geometry,inkMaterial(layer.color));
    };
    for(const layer of p.artLayers||[]){
      const [x,y,w,h]=layer.crop,plane=cutout(layer,w*scale,h*scale);plane.name=layer.id;
      plane.rotation.x=-Math.PI/2;plane.position.set((x+w/2)/maze.sourceStep*maze.cellSize-maze.width*maze.cellSize/2,.01,(y+h/2)/maze.sourceStep*maze.cellSize-maze.height*maze.cellSize/2);if(maze.slope.x||maze.slope.z||maze.slope.nonlinear){
        plane.updateMatrix();plane.geometry.applyMatrix4(plane.matrix);plane.position.set(0,0,0);plane.rotation.set(0,0,0);
        const pos=plane.geometry.attributes.position;for(let i=0;i<pos.count;i++)pos.setY(i,pos.getY(i)+maze.heightAt(pos.getX(i),pos.getZ(i)));plane.geometry.computeVertexNormals();
      }this.artwork.add(plane);
      if(maze.id==='pound-town'){
        // A quiet paper-colored patch preserves the handwriting over the busy city.
        const backing=new THREE.Mesh(plane.geometry.clone(),new THREE.MeshBasicMaterial({color:0xf3dbb7,transparent:true,opacity:.94,depthWrite:false,side:THREE.DoubleSide}));
        backing.name=`${layer.id}-backing`;backing.position.copy(plane.position);backing.position.y-=.025;backing.rotation.copy(plane.rotation);backing.renderOrder=1;plane.renderOrder=2;this.artwork.add(backing);
      }
      // A second, upright copy makes the original pen-drawn sun visible from inside the maze.
      if(layer.id==='sun'){const skySun=cutout(layer,43,43*h/w);skySun.material.uniforms.isSkySun.value=1;skySun.position.set(-38,27,-74);skySun.rotation.y=.22;this.artwork.add(skySun);}
    }
    for(const item of p.graffiti||[]){
      const city=maze.id==='pound-town',canvas=document.createElement('canvas');canvas.width=city?1024:640;canvas.height=512;const c=canvas.getContext('2d');
      c.textAlign='center';c.textBaseline='middle';c.fillStyle=item.color;c.strokeStyle='#3e243b';c.lineWidth=city?4:7;c.font=`900 ${city?90:72}px 'Segoe Print','Comic Sans MS',sans-serif`;
      c.translate(canvas.width/2,256);c.rotate(-.055);c.shadowBlur=city?4:0;c.shadowColor=item.color;
      item.lines.forEach((line,i)=>{const y=(i-(item.lines.length-1)/2)*110;c.strokeText(line,0,y,canvas.width-80);c.fillText(line,0,y,canvas.width-80);});
      const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
      const sign=mesh(new THREE.PlaneGeometry(item.width||1.9,item.height||1.52,city?24:1,1),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}),this.graffiti);
      const point=maze.point(item.cell[1]*maze.width+item.cell[0]),side=item.face==='east'?1:-1;
      sign.position.set(point.x+side*(maze.cellSize/2+.025),maze.heightAt(point.x,point.z)+(item.centerHeight||1.75),point.z);sign.rotation.y=side*Math.PI/2;sign.castShadow=false;
      if(maze.slope.nonlinear){const pos=sign.geometry.attributes.position;for(let i=0;i<pos.count;i++)pos.setY(i,pos.getY(i)+maze.heightAt(sign.position.x,point.z-side*pos.getX(i))-maze.heightAt(point.x,point.z));sign.geometry.computeVertexNormals();}
    }
  }
  buildFoodBowl(){
    this.foodBowl=new THREE.Group();this.scene.add(this.foodBowl);this.foodBowl.visible=false;
    const ceramic=mat(0xb4d8c5,{roughness:.25}),food=mat(0x855339);
    mesh(new THREE.CylinderGeometry(.30,.23,.14,24),ceramic,this.foodBowl,0,.09,0);
    this.kibble=mesh(new THREE.CylinderGeometry(.255,.25,.025,20),food,this.foodBowl,0,.168,0);
    const rim=mesh(new THREE.TorusGeometry(.278,.035,8,28),ceramic,this.foodBowl,0,.17,0);rim.rotation.x=Math.PI/2;
    this.foodLabel=label('DINNER BELL','#d4ef93');this.foodLabel.scale.set(1.65,.42,1);this.foodLabel.position.y=.95;this.foodLabel.material.depthTest=true;this.foodBowl.add(this.foodLabel);
  }
  makeMarker(p,c,text,offset){
    const g=new THREE.Group();g.position.set(p.x,this.maze.heightAt(p.x,p.z),p.z);this.scene.add(g);
    const ring=mesh(new THREE.TorusGeometry(.53,.09,8,36),new THREE.MeshBasicMaterial({color:c}),g,0,.13,0);ring.rotation.x=Math.PI/2;
    const beam=mesh(new THREE.CylinderGeometry(.08,.08,8,8),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.7}),g,0,4,0);beam.castShadow=false;
    const sign=label(text,c===0xd4ef93?'#d4ef93':c===0xff75bb?'#ff75bb':'#f3b48b');sign.position.set(offset,10+Math.abs(offset)*.2,0);g.add(sign);
    return {root:g,ring,beam,sign};
  }
  burst(p,c=0xd4ef93){
    const g=new THREE.Group();g.position.set(p.x,this.maze.heightAt(p.x,p.z)+.8,p.z);const m=new THREE.MeshBasicMaterial({color:c});
    for(let i=0;i<14;i++){const dot=mesh(new THREE.IcosahedronGeometry(.07),m,g);dot.userData.velocity=new THREE.Vector3(Math.cos(i*2.4)*1.3,1+Math.sin(i)*.8,Math.sin(i*2.4)*1.3);}
    this.scene.add(g);this.effects.push({root:g,life:1});
  }
  resize(){const c=this.renderer.domElement,w=c.clientWidth,h=c.clientHeight,key=`${w}:${h}`;if(key!==this.lastSize){this.lastSize=key;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}}
  overviewPose(top=false){
    const aspect=this.camera.aspect;
    if(this.maze.id==='leaky-pad'){
      const fit=Math.max(1,.95/Math.max(.3,aspect)),a=.28+this.orbit;
      return top?{position:new THREE.Vector3(0,Math.max(278,215/Math.max(.4,aspect)),.01),target:new THREE.Vector3(0,0,0)}:{position:new THREE.Vector3(Math.sin(a)*105,245,Math.cos(a)*165).multiplyScalar(this.zoom*fit),target:new THREE.Vector3(0,0,3)};
    }
    const height=Math.max(165,118/Math.max(.6,aspect));
    if(top&&this.maze.id==='snowman'){const small=this.renderer.domElement.clientWidth<700;return {position:new THREE.Vector3(0,small?330:230,small?30.01:.01),target:new THREE.Vector3(0,0,small?30:0)};}
    if(top){const small=this.renderer.domElement.clientWidth<700;return {position:new THREE.Vector3(0,small?315:height*1.23,small?48.01:8.01),target:new THREE.Vector3(0,0,small?48:8)};}
    const a=.52+this.orbit,fit=Math.max(1,1.15/Math.max(.25,aspect));return {position:new THREE.Vector3(Math.sin(a)*105,122,Math.cos(a)*125+9).multiplyScalar(this.zoom*fit),target:new THREE.Vector3(0,0,10)};
  }
  followPose(round){
    const p=round.player,a=p.angle,ground=this.maze.heightAt(p.x,p.z);
    const target=new THREE.Vector3(p.x,ground+1.18,p.z),back=new THREE.Vector3(Math.sin(a),0,Math.cos(a));
    // Shorten the camera boom at walls. Camera stays below the tall maze walls.
    const cameraY=d=>Math.max(ground+2.2,this.maze.heightAt(p.x-back.x*d,p.z-back.z*d)+1.5);
    let dist=2.5;for(let d=.2;d<=2.5;d+=.1){if(opaqueAt(this.maze,this.wallStyles,p.x-back.x*d,cameraY(d),p.z-back.z*d)){dist=Math.max(.22,d-.18);break;}}
    const pos=new THREE.Vector3(p.x-back.x*dist,cameraY(dist)+(2.5-dist)*.12,p.z-back.z*dist);
    target.addScaledVector(back,2.2);return {position:pos,target};
  }
  actorInView(actor,height=1.85){
    const target=new THREE.Vector3(actor.x,this.maze.heightAt(actor.x,actor.z)+height,actor.z),screen=target.clone().project(this.camera);
    if(screen.z<=-1||screen.z>=1||Math.abs(screen.x)>.97||Math.abs(screen.y)>.97||target.distanceTo(this.camera.position)>27)return false;
    const start=this.camera.position,steps=Math.max(1,Math.ceil(start.distanceTo(target)/.12));
    for(let i=1;i<=steps;i++){const t=i/steps;if(opaqueAt(this.maze,this.wallStyles,start.x+(target.x-start.x)*t,start.y+(target.y-start.y)*t,start.z+(target.z-start.z)*t))return false;}
    return true;
  }
  stickmanInView(round){return this.actorInView(round.hunter,1.85*(round.hunter.scale||1));}
  updateSpeech(round,view){
    const rect=this.renderer.domElement.getBoundingClientRect(),active=round.phase==='playing'&&(view==='playing'||view==='paused');
    const paired=active&&round.player.speech&&round.hunter.speech&&this.stickmanInView(round);
    const boxes=[];let departingCount=0;
    for(const who of Object.keys(this.speech)){
      const actor=round[who]||round.extraHunters?.find(h=>h.id===who)||round.miniatures?.find(h=>h.id===who),bubble=this.speech[who],departing=actor?.miniature&&['flying','removed'].includes(actor.state),shown=active&&!!actor?.speech&&(departing||this.actorInView(actor,who==='player'?1.5:1.85*(actor.scale||1)));
      bubble.hidden=!shown;if(!shown)continue;
      if(bubble.textContent!==actor.speech.text)bubble.textContent=actor.speech.text;
      const pos=new THREE.Vector3(actor.x,this.maze.heightAt(actor.x,actor.z)+(actor.y||0)+(who==='player'?1.84:2.34*(actor.scale||1)),actor.z).project(this.camera);
      if(departing&&(actor.state==='removed'||pos.z<=-1||pos.z>=1||Math.abs(pos.x)>.9||Math.abs(pos.y)>.9))actor.captionDeparted=true;
      const pinned=departing&&actor.captionDeparted;bubble.classList.toggle('departing-speech',!!pinned);
      if(pinned){
        const half=bubble.offsetWidth/2+8,y=rect.top+140+bubble.offsetHeight+departingCount*(bubble.offsetHeight+18);departingCount++;
        bubble.style.left=`${rect.right-half-18}px`;bubble.style.top=`${Math.min(rect.bottom-20,y)}px`;continue;
      }
      if(pos.z<=-1||pos.z>=1){bubble.hidden=true;continue;}
      const half=bubble.offsetWidth/2+8;
      const anchor=rect.left+(pos.x+1)/2*rect.width,offset=paired?(who==='player'?-110:70):0;
      const x=THREE.MathUtils.clamp(anchor+offset,rect.left+half,rect.right-half);
      let y=Math.max(rect.top+bubble.offsetHeight+12,rect.top+(1-pos.y)/2*rect.height-10);
      // Keep simultaneous call-and-response bubbles readable when the characters are close.
      for(const box of boxes)if(Math.abs(x-box.x)<half+box.half&&Math.abs(y-box.y)<bubble.offsetHeight+14)y=box.y-box.height-18;
      y=Math.max(rect.top+bubble.offsetHeight+12,y);bubble.style.left=`${x}px`;bubble.style.top=`${y}px`;
      bubble.style.setProperty('--tail-left',`${THREE.MathUtils.clamp(anchor-x+bubble.offsetWidth/2-7,12,bubble.offsetWidth-25)}px`);
      boxes.push({x,y,half,height:bubble.offsetHeight});
    }
  }
  capturePose(round){
    const c=round.capture,p=c.player,h=c.hunter,t=c.elapsed;
    if(round.leakyPad){
      this.runner.tackle(t);const ground=this.maze.heightAt(p.x,p.z),fall=THREE.MathUtils.smoothstep(t,.85,1.6);
      for(const tiny of round.miniatures.filter(m=>m.state==='attached')){const model=this.miniModels.get(tiny.id);if(!model)continue;model.root.position.set(p.x+(tiny.attachment-1)*.3,ground+.4-fall*.25,p.z+.2);model.tackle(t);}
      this.cutaway.center.value.set(p.x,p.z);this.cutaway.ground.value=ground;
      return {position:new THREE.Vector3(p.x+3.5,ground+2.5,p.z+3),target:new THREE.Vector3(p.x,ground+.7,p.z)};
    }
    const giant=h.scale||1,ground=this.maze.heightAt(p.x,p.z),model=c.attackerId==='hunter'||!c.attackerId?this.stickman:this.extraStickmen[round.extraHunters.findIndex(h=>h.id===c.attackerId)];
    const len=Math.hypot(p.x-h.x,p.z-h.z)||1,dx=(p.x-h.x)/len,dz=(p.z-h.z)/len;
    const approach=THREE.MathUtils.smoothstep(t,.35,.98),settle=THREE.MathUtils.smoothstep(t,1.05,1.8);
    // One shoulder charge, then separate poses: runner sprawls sideways, Stickman stands and gloats.
    this.runner.root.position.set(p.x+dx*.3*settle,ground,p.z+dz*.3*settle);this.runner.root.rotation.y=Math.atan2(dx,dz);
    model.root.position.set(p.x-dx*(c.weapon?2.2:1.3-.95*approach)-dz*.35*settle,ground,p.z-dz*(c.weapon?2.2:1.3-.95*approach)+dx*.35*settle);
    this.runner.tackle(t);if(c.weapon)model.hammerStrike(t);else model.tackle(t);
    const position=new THREE.Vector3(p.x+(dz*3.6-dx*1.8)*giant,ground+2.65*giant,p.z-(dx*3.6+dz*1.8)*giant),target=new THREE.Vector3(p.x,ground+1.02*giant,p.z);
    const grin=THREE.MathUtils.smoothstep(t,2,3.15),s=model.root.position;
    const close=new THREE.Vector3(s.x+(dz*2.5-dx*.85)*giant,ground+2.15*giant,s.z-(dx*2.5+dz*.85)*giant);
    position.lerp(close,grin*(c.weapon?.2:.7));target.lerp(new THREE.Vector3(s.x,ground+1.55*giant,s.z),grin*.65);
    model.root.rotation.y=t<1.15?Math.atan2(dx,dz):Math.atan2(position.x-s.x,position.z-s.z);
    this.cutaway.center.value.set(p.x,p.z);this.cutaway.ground.value=ground;
    return {position,target};
  }
  update(round,dt,time,view='home'){
    this.resize();
    const capture=!!round?.capture&&(view==='capture'||view==='result'||(view==='paused'&&round.phase==='capture'));
    this.cutaway.active.value=capture?1:0;this.graffiti.visible=!capture;
    if(this.maze.id==='pound-town'){
      const aerial=['home','preview','transition'].includes(view);
      this.artwork.children.forEach(p=>p.visible=aerial||p.name==='courtyard');
      this.wastelandMaterial.color.setScalar(aerial?.58:1);
    }
    if(!capture&&this.wasCapture){this.runner.reset();this.stickman.reset();this.extraStickmen.forEach(m=>m.reset());}this.wasCapture=capture;
    if(round){
      if(this.round!==round){this.runner.reset();this.stickman.reset();this.extraStickmen.forEach(m=>m.reset());this.weather?.clear();this.pad?.clear();this.padPower?.clear();this.miniModels.forEach(m=>m.root.visible=false);this.round=round;}
      const {player:p,hunter:h}=round;this.runner.root.position.set(p.x,this.maze.heightAt(p.x,p.z),p.z);this.runner.root.rotation.y=p.angle;
      const cameraOffset=Math.atan2(this.camera.position.x-p.x,this.camera.position.z-p.z)-p.angle;
      if(view!=='paused')this.runner.animate(padPower(round).active?round.elapsed:time,!!p.moving,round.heldCat!==null,view==='playing'?p.idleSeconds:0,dt,cameraOffset,this.reducedMotion.matches,padPower(round).active);
      if(p.tossRemaining>0)this.runner.throwTiny(p.tossRemaining);
      if(!round.leakyPad)huntersIn(round).forEach((h,i)=>{const model=i?this.extraStickmen[i-1]:this.stickman;
        model.root.position.set(h.x,this.maze.heightAt(h.x,h.z),h.z);model.root.scale.setScalar(h.scale||1);model.root.rotation.y=h.angle;
        if(view!=='paused')model.animate(time,!!h.moving,h.stunned>0||round.heldCat!==null||h.catBlocked,h.panic,stickmanSpeedMultiplier(round));
      });
      if(round.leakyPad)for(const h of round.miniatures){
        let model=this.miniModels.get(h.id);
        if(!model){model=makeStickman();model.faceColor=0xff344d;this.miniModels.set(h.id,model);this.scene.add(model.root);
          const bubble=document.createElement('div');bubble.className='character-speech';bubble.setAttribute('role','status');bubble.setAttribute('aria-label','Tiny Stickman says');bubble.hidden=true;document.body.append(bubble);this.speech[h.id]=bubble;
        }
        const hanging=h.state==='attached'&&!capture;
        if(hanging){
          const lock=this.runner.hairLocks[[0,6,3][h.attachment]];if(model.root.parent!==lock)lock.add(model.root);
          model.root.position.set(0,-1.13,-.38);model.root.scale.setScalar(h.scale/this.runner.root.scale.x);model.root.rotation.set(0,0,0);
        }else{
          if(model.root.parent!==this.scene)this.scene.add(model.root);
          model.root.position.set(h.x,this.maze.heightAt(h.x,h.z)+(h.y||0),h.z);model.root.scale.setScalar(h.scale);model.root.rotation.set(h.state==='flying'?h.flightElapsed*3.5:0,h.angle,h.state==='flying'?h.flightElapsed*2.5:0);
        }
        model.root.visible=h.state!=='removed';
        if(view!=='paused')model.animate(round.elapsed,!!h.moving,h.stunned>0,h.panic,h.speedMultiplier);
        if(hanging)model.hang(round.elapsed);
        model.lookAtCamera(this.camera,false);
      }
      round.cats.forEach((c,i)=>{
        const obj=this.cats[i];obj.root.visible=c.state!=='hidden'&&c.state!=='summoned';obj.root.rotation.x=0;
        if(obj.nameTag)obj.nameTag.visible=(c.state==='ground'||c.state==='eating')&&!(c.pickupCooldown>0);
        obj.cooldown.visible=c.state==='ground'&&c.pickupCooldown>0;if(obj.cooldown.visible)obj.cooldown.userData.setText(`${Math.ceil(c.pickupCooldown)}s · paws off`);
        if(c.state==='held'){
          if(obj.root.parent!==this.runner.carry)this.runner.carry.add(obj.root);obj.root.position.set(0,0,0);obj.root.rotation.y=(1-this.runner.photoBlend)*Math.PI/2;obj.root.rotation.z=-.06*this.runner.photoBlend;obj.root.scale.setScalar(.7);
        }else{
          if(obj.root.parent!==this.scene)this.scene.add(obj.root);
          obj.root.rotation.z=0;
          const hop=c.jumpTime>0?Math.sin(c.jumpTime/.6*Math.PI)*.65:c.moving?Math.abs(Math.sin(time*8+i))*.16:Math.sin(time*3+i)*.015;
          obj.root.position.set(c.x,this.maze.heightAt(c.x,c.z)+.025+hop,c.z);obj.root.rotation.y=c.state==='eating'?Math.PI:c.angle??i*2;obj.root.scale.setScalar(1);
          if(c.state==='eating'){obj.root.position.z+=.28;obj.root.rotation.x=.18+Math.sin(time*8)*.065;}else if(c.moving)obj.root.rotation.x=Math.sin(time*8+i)*.08;
        }
        obj.tail.rotation.y=Math.sin(time*2)*.16;
      });
      this.foodBowl.visible=!!round.food;
      if(round.food){const f=round.food;this.foodBowl.position.set(f.x,this.maze.heightAt(f.x,f.z),f.z);this.kibble.visible=f.state!=='empty';this.kibble.scale.setScalar(f.state==='eating'?.25+.75*f.timer/5:1);this.foodLabel.visible=true;
        const seconds=Math.ceil(round.foodCooldown),refill=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
        this.foodLabel.userData.setText(f.state==='waiting'?`STUBBY IN ${Math.ceil(f.timer)}s`:f.state==='eating'?`DINNER · ${Math.ceil(f.timer)}s`:seconds>0?`REFILL ${refill}`:'BOWL READY');
      }
    }
    const preview=view==='preview';this.markers.forEach(m=>{m.sign.visible=!m.groundOnly&&(view==='home'||preview);m.beam.visible=!!m.persistentBeacon||m.sign.visible;m.ring.rotation.z=time*.6;});
    let pose=this.overviewPose(preview);
    if(view==='playing'||view==='paused'||view==='result')pose=this.followPose(round);
    if(capture)pose=this.capturePose(round);
    if(view==='transition'){
      const t=THREE.MathUtils.smoothstep(round.transition,0,1),top=this.overviewPose(true),follow=this.followPose(round);
      pose={position:top.position.lerp(follow.position,t),target:top.target.lerp(follow.target,t)};
    }
    const targetFov=capture?55:['playing','paused','result'].includes(view)?66:view==='transition'?45+21*Math.min(1,round.transition):45;
    this.camera.fov+=(targetFov-this.camera.fov)*Math.min(1,dt*8);this.camera.updateProjectionMatrix();
    const speed=view==='home'?dt*2:view==='preview'?dt*5:dt*14;
    this.camera.position.lerp(pose.position,Math.min(1,speed));this.look.lerp(pose.target,Math.min(1,speed));
    this.camera.up.set(0,1,0);this.camera.lookAt(this.look);
    if(round)[this.stickman,...this.extraStickmen].forEach(m=>m.lookAtCamera(this.camera,isStickmanEnraged(round)));
    this.scene.fog.density=['playing','paused','result','capture'].includes(view)?(this.maze.id==='pound-town'?.0055:.009):.002;
    for(const e of this.effects){e.life-=dt;e.root.children.forEach(c=>c.position.addScaledVector(c.userData.velocity,dt));e.root.scale.setScalar(Math.max(.01,e.life));if(e.life<=0){this.scene.remove(e.root);e.root.children.forEach(c=>c.geometry.dispose());e.root.children[0]?.material.dispose();}}
    this.effects=this.effects.filter(e=>e.life>0);if(this.sparks)this.sparks.rotation.y=time*.002;
    this.weather?.update(round,dt,view,this.reducedMotion.matches);
    this.pad?.update(round,dt,view);
    this.padPower?.update(round,dt,view);
    if(this.rubbleChunks)updateRubbleShadows(this.rubbleChunks,round?.player,['home','preview','transition'].includes(view));
    this.renderer.render(this.scene,this.camera);
    if(round)this.updateSpeech(round,view);
  }
}
