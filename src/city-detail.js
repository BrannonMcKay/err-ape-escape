import * as THREE from '../vendor/three.module.js';

// Small spatial batches let Three cull unseen rubble. Every original rock and
// brick remains in the scene; distant groups just skip the extra shadow pass.
export function rubbleBatches(scene,geometry,material,items,size=24){
  const buckets=new Map(),result=[];
  for(const p of items){const key=`${Math.floor(p.x/size)}:${Math.floor(p.z/size)}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(p);}
  const m=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),v=new THREE.Vector3(),scale=new THREE.Vector3();
  for(const [key,items] of buckets){
    const mesh=new THREE.InstancedMesh(geometry,material,items.length);
    items.forEach((p,i)=>{
      q.setFromEuler(e.set(p.rx||0,p.ry||0,p.rz||0));m.compose(v.set(p.x,p.y,p.z),q,scale.set(p.sx||1,p.sy||1,p.sz||1));mesh.setMatrixAt(i,m);
      if(p.color)mesh.setColorAt(i,new THREE.Color(p.color));
    });
    mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.receiveShadow=true;mesh.castShadow=false;mesh.name=`Rubble ${key}`;scene.add(mesh);result.push(mesh);
  }return result;
}

export function updateRubbleShadows(chunks,player,aerial){
  for(const mesh of chunks){
    const b=mesh.boundingBox,dx=player?Math.max(b.min.x-player.x,0,player.x-b.max.x):Infinity,dz=player?Math.max(b.min.z-player.z,0,player.z-b.max.z):Infinity;
    mesh.castShadow=!aerial&&dx*dx+dz*dz<28*28;
  }
}
