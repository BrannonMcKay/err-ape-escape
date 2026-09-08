import * as THREE from '../vendor/three.module.js';

// A seamless, code-drawn leaf texture shared by every foliage wall. World-space UVs
// keep its leaves the same size on long merged walls, window sills and short walls.
function leafTexture(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const c=canvas.getContext('2d');c.fillStyle='#343a2b';c.fillRect(0,0,512,512);
  let seed=49;const random=()=>((seed=seed*16807%2147483647)/2147483647);
  for(let i=0;i<360;i++){
    const x=random()*512,y=random()*512,angle=random()*Math.PI*2,length=16+random()*27,width=8+random()*13,light=110+Math.floor(random()*120);
    for(const dx of [-512,0,512])for(const dy of [-512,0,512]){
      c.save();c.translate(x+dx,y+dy);c.rotate(angle);
      c.shadowColor='#101a0baa';c.shadowBlur=3;c.shadowOffsetY=2;
      c.beginPath();c.moveTo(0,-length/2);c.bezierCurveTo(width,-length*.14,width*.75,length*.35,0,length/2);c.bezierCurveTo(-width*.8,length*.2,-width,-length*.2,0,-length/2);
      c.fillStyle=`rgb(${light},${light},${light})`;c.fill();c.shadowBlur=0;c.shadowOffsetY=0;
      c.strokeStyle=`rgba(40,48,26,${.22+random()*.2})`;c.lineWidth=.8;c.beginPath();c.moveTo(0,-length*.4);c.lineTo(0,length*.5);
      for(let j=-1;j<=1;j++){const yy=j*length*.2;c.moveTo(0,yy);c.lineTo(width*.48,yy-length*.16);c.moveTo(0,yy);c.lineTo(-width*.48,yy-length*.16);}c.stroke();c.restore();
    }
  }
  const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;return texture;
}

export function mountainMaterials(maze){
  const theme=maze.presentation.theme,leaves=leafTexture(),colors=theme.colors;
  const uniforms={uTerrainSize:{value:new THREE.Vector2(maze.width*maze.cellSize,maze.height*maze.cellSize)},uLeaves:{value:leaves},uCaps:{value:theme.snowCaps.map(c=>new THREE.Vector3(...c))},uGreenLine:{value:new THREE.Vector2(...theme.greenTransition)}};
  for(const name of ['snow','ice','green','gold','orange','red','dirt'])uniforms[`u${name[0].toUpperCase()+name.slice(1)}`]={value:new THREE.Color(colors[name])};
  function material(kind){
    const m=new THREE.MeshStandardMaterial({color:0xffffff,roughness:kind==='ground'?.98:.9});
    m.userData.disposableTextures=[leaves];
    m.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vTerrainPosition;').replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
        vec4 terrainPosition = vec4(transformed,1.0);
        #ifdef USE_INSTANCING
          terrainPosition = instanceMatrix * terrainPosition;
        #endif
        vTerrainPosition = (modelMatrix * terrainPosition).xyz;`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
        varying vec3 vTerrainPosition; uniform vec2 uTerrainSize; uniform sampler2D uLeaves;
        uniform vec3 uCaps[3]; uniform vec2 uGreenLine;
        uniform vec3 uSnow,uIce,uGreen,uGold,uOrange,uRed,uDirt;
        float terrainHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float terrainNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(terrainHash(i),terrainHash(i+vec2(1,0)),f.x),mix(terrainHash(i+vec2(0,1)),terrainHash(i+vec2(1,1)),f.x),f.y);}
      `).replace('#include <color_fragment>',`#include <color_fragment>
        vec2 region = vTerrainPosition.xz / uTerrainSize + 0.5;
        float snow=0.0;
        for(int i=0;i<3;i++){
          float edge=uCaps[i].y+sin(region.x*85.0)*0.004+sin(region.x*33.0)*0.007;
          snow=max(snow,(1.0-smoothstep(edge-0.015,edge+0.015,region.y))*(1.0-smoothstep(uCaps[i].z-0.025,uCaps[i].z,abs(region.x-uCaps[i].x))));
        }
        float greenery=smoothstep(uGreenLine.x,uGreenLine.y,region.y);
        vec3 planeNormal=abs(normalize(cross(dFdx(vTerrainPosition),dFdy(vTerrainPosition))));
        vec2 leafUv=planeNormal.y>0.5?vTerrainPosition.xz:(planeNormal.x>0.5?vTerrainPosition.zy:vTerrainPosition.xy);
        float grain=terrainHash(floor(leafUv*95.0));
        float patches=terrainNoise(leafUv*2.3);
        vec3 snowy=mix(uIce,uSnow,0.7+0.3*patches)*(0.95+grain*0.07);
        vec3 autumn=mix(uRed,uOrange,smoothstep(0.2,0.6,patches));autumn=mix(autumn,uGold,smoothstep(0.53,0.85,patches));
        vec3 foliage=mix(autumn,uGreen*(0.82+patches*0.4),greenery);
        ${kind==='ground'?`
          float fleck=step(0.986,terrainHash(floor(leafUv*18.0)));
          vec3 dirt=uDirt*(0.74+patches*0.38+grain*0.15);
          dirt=mix(dirt,foliage*1.3,fleck*(1.0-greenery*0.65)*0.5);
          diffuseColor.rgb*=mix(dirt,snowy,snow);
        `:`
          vec3 leaf=texture2D(uLeaves,leafUv*0.82).rgb;
          foliage*=0.46+leaf.r*0.78;
          diffuseColor.rgb*=mix(foliage,snowy,snow)*${kind==='top'?'1.12':'1.0'};
        `}
      `);
    };
    m.customProgramCacheKey=()=>`mountain-seasons-${kind}-v1`;return m;
  }
  return {wall:material('wall'),top:material('top'),ground:material('ground')};
}
