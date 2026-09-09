import * as THREE from '../vendor/three.module.js';
import {padPower} from './leaky-pad.js';

// A bounded pool of small, hinged butterflies trails from Christel toward the camera.
export class PadPowerWorld{
  constructor(world){
    this.world=world;this.palette=[];const seen=new Set();
    world.runner.root.traverse(o=>{const m=o.material;if(!m?.emissive||seen.has(m))return;seen.add(m);this.palette.push({material:m,color:m.color.clone(),emissive:m.emissive.clone(),intensity:m.emissiveIntensity});});
    this.pink=new THREE.Color(0xff48cb);this.purple=new THREE.Color(0x9349ff);this.tint=new THREE.Color();
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(64,64,8,64,64,64);
    gradient.addColorStop(0,'#ffffff88');gradient.addColorStop(.45,'#ffffff44');gradient.addColorStop(1,'#ffffff00');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
    this.aura=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),color:0xff48cb,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:.4}));this.aura.visible=false;world.scene.add(this.aura);
    this.light=new THREE.PointLight(0xff48cb,0,8,1.6);world.scene.add(this.light);
    const wing=new THREE.Shape();wing.moveTo(0,0);wing.bezierCurveTo(.06,.18,.24,.22,.24,.1);wing.bezierCurveTo(.25,.03,.16,-.005,.12,-.02);wing.bezierCurveTo(.26,-.13,.09,-.24,0,0);
    const geometry=new THREE.ShapeGeometry(wing,10),body=new THREE.CylinderGeometry(.009,.012,.19,5);
    this.butterflies=Array.from({length:28},(_,i)=>{
      const root=new THREE.Group(),material=new THREE.MeshBasicMaterial({color:i%2?0xcc8aff:0xff91de,side:THREE.DoubleSide,transparent:true,depthWrite:false});
      const wings=[1,-1].map(side=>{const mesh=new THREE.Mesh(geometry,material);mesh.scale.x=side;root.add(mesh);return mesh;});root.add(new THREE.Mesh(body,material));root.visible=false;world.scene.add(root);
      return {root,wings,material,velocity:new THREE.Vector3(),age:0,life:0,phase:0};
    });
    this.direction=new THREE.Vector3();this.motion=new THREE.Vector3();this.previousPlayer=null;this.serial=0;this.emission=0;this.active=false;
  }
  clear(){
    for(const p of this.palette){p.material.color.copy(p.color);p.material.emissive.copy(p.emissive);p.material.emissiveIntensity=p.intensity;}
    this.aura.visible=false;this.light.intensity=0;this.active=false;this.emission=0;this.serial=0;this.previousPlayer=null;
    for(const b of this.butterflies){b.root.visible=false;b.age=b.life=0;}
  }
  update(round,dt,view){
    const active=padPower(round).active&&['playing','paused','preview'].includes(view),p=round.player,t=round.elapsed||0;
    const step=view==='playing'?Math.max(0,dt):0,reduced=this.world.reducedMotion.matches;
    this.motion.set(0,0,0);if(step&&this.previousPlayer)this.motion.set(p.x-this.previousPlayer.x,0,p.z-this.previousPlayer.z).divideScalar(step).clampLength(0,20);
    this.previousPlayer={x:p.x,z:p.z};
    if(!active&&this.active){for(const entry of this.palette){entry.material.color.copy(entry.color);entry.material.emissive.copy(entry.emissive);entry.material.emissiveIntensity=entry.intensity;}this.emission=0;}
    this.active=active;this.aura.visible=active;this.light.intensity=0;
    if(active){
      const pulse=.5+.5*Math.sin(t*Math.PI*(reduced?.5:2.4));
      for(let i=0;i<this.palette.length;i++){
        const entry=this.palette[i];this.tint.copy(this.pink).lerp(this.purple,(i%2)?1-pulse:pulse);
        entry.material.color.copy(entry.color).lerp(this.tint,.72);entry.material.emissive.copy(this.tint);entry.material.emissiveIntensity=.4+pulse*.45;
      }
      this.tint.copy(this.pink).lerp(this.purple,pulse);this.aura.material.color.copy(this.tint);this.aura.material.opacity=.2+.15*pulse;
      this.aura.position.set(p.x,this.world.maze.heightAt(p.x,p.z)+.95,p.z);this.aura.scale.set(2.3+pulse*.25,2.8+pulse*.25,1);
      this.light.position.copy(this.aura.position);this.light.color.copy(this.tint);this.light.intensity=7+pulse*9;
    }
    if(active&&p.moving&&step>0){
      this.emission+=step*(reduced?5:14);
      while(this.emission>=1){
        this.emission--;const butterfly=this.butterflies.find(b=>!b.root.visible);if(!butterfly)break;
        const n=this.serial++,phase=n*2.399;butterfly.phase=phase;butterfly.age=0;butterfly.life=.9+(n%4)*.08;butterfly.root.visible=true;
        butterfly.root.position.set(p.x+Math.sin(phase)*.4,this.world.maze.heightAt(p.x,p.z)+1+(n%5)*.12,p.z+Math.cos(phase)*.4);
        this.direction.copy(this.world.camera.position).sub(butterfly.root.position).normalize();butterfly.velocity.copy(this.direction).multiplyScalar(1.3).addScaledVector(this.motion,.9);butterfly.velocity.y+=.12;
        butterfly.root.scale.setScalar(.3+(n%3)*.06);
      }
    }else this.emission=0;
    for(const b of this.butterflies){
      if(!b.root.visible)continue;b.age+=step;
      if(b.age>=b.life||view==='home'||view==='result'||view==='capture'){b.root.visible=false;continue;}
      b.root.position.addScaledVector(b.velocity,step);b.root.position.x+=Math.sin(b.phase+b.age*8)*step*.25;
      b.root.quaternion.copy(this.world.camera.quaternion);b.root.rotateZ(Math.sin(b.phase+b.age*5)*.18);
      b.wings.forEach((wing,i)=>{wing.rotation.y=(i?-1:1)*(.25+Math.sin(b.phase+b.age*(reduced?12:32))*.95);});
      b.material.opacity=Math.min(1,b.age/.12)*Math.min(1,(b.life-b.age)/.35)*.9;
    }
  }
}
