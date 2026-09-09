import * as THREE from '../vendor/three.module.js';

// Adapt the interior to curvature, but sample shared edges on the same cell grid.
// Shared corner anchors are retained when simplifying edges, so neighbouring
// rectangles and differently sized patches meet without cracks.
export function terrainBoxes(maze,rects,height,centerY,variation=0){
  const positions=[],normals=[],uvs=[],colors=[],groups=Array.from({length:6},()=>[]),s=maze.cellSize;
  const cache=new Map(),world=(x,z)=>[(x-maze.width/2)*s,(z-maze.height/2)*s];
  const sample=(x,z)=>{
    const key=`${x}:${z}`;if(cache.has(key))return cache.get(key);
    const [wx,wz]=world(x,z),y=maze.heightAt(wx,wz);cache.set(key,y);return y;
  };
  function ticks(a,b){const out=[a];for(let n=Math.floor(a)+1;n<b-1e-8;n++)out.push(n);out.push(b);return out;}
  const rows=new Map(),columns=new Map(),curves=new Map(),key=n=>n.toFixed(8);
  function anchor(x,z){
    for(const [map,k,value] of [[rows,key(z),x],[columns,key(x),z]]){if(!map.has(k))map.set(k,new Set());map.get(k).add(value);}
  }
  function edge(ax,az,bx,bz){
    const axis=ax!==bx?0:1,fixed=axis===0?az:ax,a=axis===0?ax:az,b=axis===0?bx:bz,id=`${axis}:${key(fixed)}`;
    if(!curves.has(id)){
      const anchors=[...(axis===0?rows:columns).get(key(fixed))].sort((a,b)=>a-b),out=[];
      for(let segment=1;segment<anchors.length;segment++){
        const points=ticks(anchors[segment-1],anchors[segment]).map(v=>{const p=axis===0?[v,fixed]:[fixed,v];return [...p,sample(...p)];});
        const keep=new Set([0,points.length-1]),stack=[[0,points.length-1]];
        while(stack.length){
          const [start,end]=stack.pop(),p=points[start],q=points[end];let worst=.002,split=-1;
          for(let i=start+1;i<end;i++){const t=(points[i][axis]-p[axis])/(q[axis]-p[axis]),error=Math.abs(points[i][2]-p[2]-(q[2]-p[2])*t);if(error>worst){worst=error;split=i;}}
          if(split>=0){keep.add(split);stack.push([start,split],[split,end]);}
        }
        for(const i of [...keep].sort((a,b)=>a-b))if(!out.length||i!==0)out.push(points[i]);
      }curves.set(id,out);
    }
    const points=curves.get(id).filter(p=>p[axis]>=Math.min(a,b)-1e-8&&p[axis]<=Math.max(a,b)+1e-8);if(a>b)points.reverse();return points;
  }
  function needsSplit(x0,z0,x1,z1){
    if(x1-x0<=1&&z1-z0<=1)return false;
    const a=sample(x0,z0),b=sample(x1,z0),c=sample(x0,z1),d=sample(x1,z1);
    // Check the cell lattice and patch centre against the two corner triangles.
    // A 4 mm tolerance preserves the hill without subdividing planar plateaus.
    const xs=ticks(x0,x1),zs=ticks(z0,z1);xs.push((x0+x1)/2);zs.push((z0+z1)/2);
    for(const z of zs)for(const x of xs){
      const u=(x-x0)/(x1-x0),v=(z-z0)/(z1-z0);
      const y=u>v?a+(b-a)*u+(d-b)*v:a+(d-c)*u+(c-a)*v;
      if(Math.abs(sample(x,z)-y)>.004)return true;
    }return false;
  }
  const middle=(a,b)=>{const n=Math.floor((a+b)/2);return n>a&&n<b?n:(a+b)/2;};
  const sections=rects.map(r=>{
    const patches=[];
    function divide(ax,az,bx,bz){
      if(needsSplit(ax,az,bx,bz)){
        if(bx-ax>=bz-az){const m=middle(ax,bx);divide(ax,az,m,bz);divide(m,az,bx,bz);}
        else{const m=middle(az,bz);divide(ax,az,bx,m);divide(ax,m,bx,bz);}return;
      }
      patches.push([ax,az,bx,bz]);anchor(ax,az);anchor(ax,bz);anchor(bx,az);anchor(bx,bz);
    }
    divide(r.x,r.y,r.x+r.w,r.y+r.h);return {r,patches};
  });
  const up=new THREE.Vector3();
  for(const {r,patches} of sections){
    const x0=r.x,z0=r.y,x1=x0+r.w,z1=z0+r.h,tint=variation?.91+((r.x*13+r.y*7)%19)/100:1;
    const vertex=(p,lift,normal,uv)=>{
      const [x,z]=world(p[0],p[1]),index=positions.length/3;
      positions.push(x,p[2]+lift,z);normals.push(...normal);uvs.push(...uv);colors.push(tint,tint,tint);return index;
    };
    const normalAt=(x,z,invert)=>{
      const [wx,wz]=world(x,z),e=.03;
      up.set(-(maze.heightAt(wx+e,wz)-maze.heightAt(wx-e,wz))/(2*e),1,-(maze.heightAt(wx,wz+e)-maze.heightAt(wx,wz-e))/(2*e)).normalize();if(invert)up.negate();return up.toArray();
    };
    const surface=(ring,group,lift,invert=false)=>{
      const ids=ring.map(p=>vertex(p,lift,normalAt(p[0],p[1],invert),[(p[0]-x0)/r.w,1-(p[1]-z0)/r.h]));
      const triangle=(a,b,c)=>groups[group].push(a,invert?c:b,invert?b:c);
      if(ids.length===4){triangle(ids[0],ids[1],ids[2]);triangle(ids[0],ids[2],ids[3]);}
      else{
        const x=(ring[0][0]+Math.max(...ring.map(p=>p[0])))/2,z=(ring[0][1]+Math.max(...ring.map(p=>p[1])))/2;
        const center=vertex([x,z,sample(x,z)],lift,normalAt(x,z,invert),[(x-x0)/r.w,1-(z-z0)/r.h]);
        for(let i=0;i<ids.length;i++)triangle(center,ids[i],ids[(i+1)%ids.length]);
      }
    };
    for(const [ax,az,bx,bz] of patches){
      const ring=[...edge(ax,az,ax,bz).slice(0,-1),...edge(ax,bz,bx,bz).slice(0,-1),...edge(bx,bz,bx,az).slice(0,-1),...edge(bx,az,ax,az).slice(0,-1)];
      surface(ring,2,centerY+height/2);surface(ring,3,centerY-height/2,true);
    }
    // Only the original rectangle has side walls; interior patches share tops.
    for(const [ax,az,bx,bz,group,n] of [[x0,z0,x0,z1,1,[-1,0,0]],[x0,z1,x1,z1,4,[0,0,1]],[x1,z1,x1,z0,0,[1,0,0]],[x1,z0,x0,z0,5,[0,0,-1]]]){
      const points=edge(ax,az,bx,bz);
      for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i],lo=centerY-height/2,hi=centerY+height/2;
        const ids=[vertex(a,hi,n,[0,1]),vertex(a,lo,n,[0,0]),vertex(b,lo,n,[1,0]),vertex(b,hi,n,[1,1])];
        groups[group].push(ids[0],ids[1],ids[2],ids[0],ids[2],ids[3]);
      }
    }
  }
  const geo=new THREE.BufferGeometry(),indices=[];
  for(let material=0;material<6;material++){const start=indices.length;for(const index of groups[material])indices.push(index);geo.addGroup(start,indices.length-start,material);}
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeBoundingSphere();return geo;
}
