import * as THREE from '../vendor/three.module.js';

export const BLOOD_RED=0x8c0718;
let horrorFont;
export function loadPadFont(){
  return horrorFont??=new FontFace('Creepster',`url("${new URL('../assets/creepster-regular.ttf',import.meta.url).href}")`).load().then(font=>document.fonts.add(font));
}
const SOURCE_WIDTH=1062,SOURCE_HEIGHT=1314;
function canvas(){const c=document.createElement('canvas');c.width=SOURCE_WIDTH;c.height=SOURCE_HEIGHT;return c;}
function path(ctx,draw){ctx.beginPath();draw(ctx);ctx.closePath();ctx.fill();}
// Cosmetic source-space masks. They never change collision or the solution route.
export function bloodMask(includePad=true){
  const c=canvas(),ctx=c.getContext('2d');ctx.fillStyle='#fff';
  if(includePad)path(ctx,p=>{p.moveTo(167,123);p.bezierCurveTo(118,116,119,179,130,214);p.bezierCurveTo(142,258,112,295,121,342);p.bezierCurveTo(125,388,179,393,192,353);p.bezierCurveTo(201,325,176,292,179,262);p.bezierCurveTo(178,220,196,197,195,190);p.bezierCurveTo(157,197,119,138,167,123);});
  path(ctx,p=>{p.moveTo(269,378);p.bezierCurveTo(267,410,241,409,240,451);p.bezierCurveTo(239,480,269,477,274,451);p.bezierCurveTo(277,424,271,398,269,378);});
  path(ctx,p=>{p.moveTo(257,568);p.bezierCurveTo(256,592,236,612,247,631);p.bezierCurveTo(256,646,269,631,269,613);p.bezierCurveTo(269,596,260,582,257,568);});
  path(ctx,p=>{p.moveTo(215,915);p.bezierCurveTo(226,984,248,982,237,1010);p.bezierCurveTo(224,1027,213,1058,228,1067);p.bezierCurveTo(253,1082,263,1034,244,1005);p.bezierCurveTo(235,978,226,956,215,915);});
  path(ctx,p=>{p.moveTo(434,984);p.bezierCurveTo(422,1021,389,1021,386,1081);p.bezierCurveTo(382,1110,399,1124,411,1114);p.bezierCurveTo(427,1103,410,1078,407,1056);p.bezierCurveTo(405,1036,427,1008,434,984);});
  path(ctx,p=>{p.moveTo(532,966);p.bezierCurveTo(504,944,492,952,503,977);p.bezierCurveTo(513,997,527,985,527,973);p.bezierCurveTo(537,1009,477,1007,479,1039);p.bezierCurveTo(487,1067,469,1079,460,1064);p.bezierCurveTo(453,1042,477,1020,481,989);p.bezierCurveTo(484,950,516,941,532,966);});
  path(ctx,p=>{p.moveTo(478,1064);p.bezierCurveTo(480,1118,461,1134,463,1170);p.bezierCurveTo(461,1207,490,1210,498,1196);p.bezierCurveTo(503,1178,477,1147,477,1128);p.bezierCurveTo(475,1100,481,1080,478,1064);});
  const texture=new THREE.CanvasTexture(c);texture.anisotropy=8;return texture;
}
export function bloodTopShader(top,maze,mask){
  top.onBeforeCompile=s=>{
    s.uniforms.bloodInk={value:mask};s.uniforms.bloodColor={value:new THREE.Color(BLOOD_RED)};
    s.uniforms.padSize={value:new THREE.Vector2(maze.width*maze.cellSize,maze.height*maze.cellSize)};
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 bloodWorld;').replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
      vec4 p=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
        p=instanceMatrix*p;
      #endif
      bloodWorld=(modelMatrix*p).xyz;`);
    s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 bloodWorld;uniform sampler2D bloodInk;uniform vec3 bloodColor;uniform vec2 padSize;').replace('#include <color_fragment>',`#include <color_fragment>
      vec2 source=(bloodWorld.xz/padSize+.5)*vec2(1062.0,1314.0);
      vec2 uv=vec2(source.x/1062.0,1.0-source.y/1314.0);
      if((source.x<278.0&&source.y<426.0)||texture2D(bloodInk,uv).a>.25)diffuseColor.rgb=bloodColor;`);
  };top.customProgramCacheKey=()=> 'pad-blood-tops-v1';
}
export function sourceArt(scene,maze){
  const size=[maze.width*maze.cellSize,maze.height*maze.cellSize];
  // Clip the original handwriting, including its small face, before extracting ink.
  const texture=new THREE.TextureLoader().load(maze.source,t=>{
    const c=canvas(),ctx=c.getContext('2d');ctx.save();ctx.beginPath();
    for(const polygon of [
      [[225,65],[260,64],[291,110],[305,206],[291,286],[269,307],[243,272],[251,225],[257,167],[247,129]],
      [[370,112],[824,112],[824,260],[370,260]],
      [[941,880],[991,878],[994,991],[950,1048],[910,1070],[902,1040],[932,1005],[944,966],[932,920]]
    ]){ctx.moveTo(...polygon[0]);polygon.slice(1).forEach(p=>ctx.lineTo(...p));ctx.closePath();}
    ctx.clip();ctx.drawImage(t.image,0,0);ctx.restore();
    const pixels=ctx.getImageData(0,0,c.width,c.height),d=pixels.data;
    for(let i=0;i<d.length;i+=4){const alpha=d[i+3]/255,ink=1-THREE.MathUtils.smoothstep(d[i+1],90,169);d[i]=d[i+1]=d[i+2]=0;d[i+3]=Math.round(255*alpha*ink);}
    ctx.putImageData(pixels,0,0);t.image=c;t.needsUpdate=true;
  });texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
  const handwriting=new THREE.Mesh(new THREE.PlaneGeometry(...size),new THREE.MeshBasicMaterial({map:texture,alphaTest:.12}));
  handwriting.name='Christel’s original underwater handwriting';handwriting.rotation.x=-Math.PI/2;handwriting.position.y=-2.6;scene.add(handwriting);
  const drops=new THREE.Mesh(new THREE.PlaneGeometry(...size),new THREE.MeshStandardMaterial({color:BLOOD_RED,map:bloodMask(false),alphaTest:.1,roughness:.75}));
  drops.name='Underwater blood drops';drops.rotation.x=-Math.PI/2;drops.position.y=-2.3;scene.add(drops);
  return {handwriting,drops};
}
export function startArrow(scene,maze){
  const c=document.createElement('canvas');c.width=192;c.height=512;const ctx=c.getContext('2d');
  ctx.strokeStyle='#fff7e8';ctx.lineWidth=12;ctx.fillStyle='#c20c26';ctx.lineJoin='round';
  ctx.beginPath();ctx.moveTo(96,20);ctx.lineTo(177,160);ctx.lineTo(125,160);ctx.lineTo(125,480);ctx.lineTo(67,480);ctx.lineTo(67,160);ctx.lineTo(15,160);ctx.closePath();ctx.stroke();ctx.fill();
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
  const root=new THREE.Group();root.name='Starting direction painted on linen';scene.add(root);
  // Bend the paint through each actual path cell, so a curved opening never
  // gets a straight arrow cutting through the wall at its inside corner.
  for(const [index,last] of [[1,12],[17,32]]){
    const points=maze.route.slice(index,last+1).map(i=>maze.point(i)),positions=[],uvs=[],indices=[];
    for(let i=0;i<points.length;i++){
      const p=points[i],before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+1)];
      const incoming=new THREE.Vector2(p.x-before.x,p.z-before.z),outgoing=new THREE.Vector2(after.x-p.x,after.z-p.z);
      if(i===0)incoming.copy(outgoing);if(i===points.length-1)outgoing.copy(incoming);incoming.normalize();outgoing.normalize();
      const normal=new THREE.Vector2(-incoming.y,incoming.x).add(new THREE.Vector2(-outgoing.y,outgoing.x)).normalize();
      const halfWidth=.12/Math.max(.7,normal.dot(new THREE.Vector2(-outgoing.y,outgoing.x)));
      for(const side of [1,-1])positions.push(p.x+normal.x*halfWidth*side,-.035,p.z+normal.y*halfWidth*side);
      uvs.push(0,i/(points.length-1),1,i/(points.length-1));
      if(i<points.length-1){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();
    const arrow=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));
    root.add(arrow);
  }
  return root;
}
