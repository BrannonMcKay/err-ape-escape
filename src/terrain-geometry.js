import * as THREE from '../vendor/three.module.js';

// Tessellated boxes follow the same height function as gameplay. Keeping a
// sub-metre grid avoids cracks where a long wall crosses either ramp shoulder.
export function terrainBoxes(maze,rects,height,centerY,variation=0){
  const positions=[],uvs=[],colors=[],indices=Array.from({length:6},()=>[]),s=maze.cellSize;
  for(const r of rects){
    const width=r.w*s,depth=r.h*s,geo=new THREE.BoxGeometry(width,height,depth,Math.max(1,Math.ceil(width/s)),1,Math.max(1,Math.ceil(depth/s)));
    const pos=geo.attributes.position,uv=geo.attributes.uv,offset=positions.length/3;
    const cx=(r.x+r.w/2-maze.width/2)*s,cz=(r.y+r.h/2-maze.height/2)*s;
    const tint=variation?.91+((r.x*13+r.y*7)%19)/100:1;
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i)+cx,z=pos.getZ(i)+cz;
      positions.push(x,pos.getY(i)+centerY+maze.heightAt(x,z),z);uvs.push(uv.getX(i),uv.getY(i));colors.push(tint,tint,tint);
    }
    for(const g of geo.groups)for(let i=g.start;i<g.start+g.count;i++)indices[g.materialIndex].push(geo.index.getX(i)+offset);
    geo.dispose();
  }
  const geo=new THREE.BufferGeometry(),all=[];
  for(let material=0;material<6;material++){
    const group=indices[material],start=all.length;for(const index of group)all.push(index);geo.addGroup(start,group.length,material);
  }
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(all);geo.computeVertexNormals();geo.computeBoundingSphere();return geo;
}
