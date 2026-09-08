// Distance-based footprints: posing, carrying a cat and teleporting leave no trail.
export class FootprintTrail {
  constructor({lifetime=18,capacity=1400}={}){this.lifetime=lifetime;this.capacity=capacity;this.clear();}
  clear(){this.marks=[];this.actors=new Map();}
  update(dt,actors,open=()=>true){
    if(dt<=0)return;
    for(const m of this.marks)m.age+=dt;
    this.marks=this.marks.filter(m=>m.age<this.lifetime);
    const active=new Set();
    for(const a of actors){
      active.add(a.id);const old=this.actors.get(a.id),stride=(a.kind==='cat'?.65:a.kind==='hunter'?.8:.65)*(a.scale||1);
      if(!old||a.active===false){this.actors.set(a.id,{x:a.x,z:a.z,distance:0,side:1});continue;}
      const dx=a.x-old.x,dz=a.z-old.z,d=Math.hypot(dx,dz);
      if(d>3){Object.assign(old,{x:a.x,z:a.z,distance:0});continue;}
      if(d>.00001){
        const ux=dx/d,uz=dz/d,angle=Math.atan2(ux,uz);
        let at=stride-old.distance;
        for(;at<=d;at+=stride){
          const x=old.x+ux*at,z=old.z+uz*at;old.side*=-1;
          const offsets=a.kind==='cat'?[[-.115,-.15],[.115,.15]]:[[old.side*.12,0]];
          for(const [side,forward] of offsets){
            const px=x+uz*side+ux*forward,pz=z-ux*side+uz*forward;
            if(open(px,pz))this.marks.push({x:px,z:pz,angle,kind:a.kind,side:old.side,age:0,scale:a.scale||1});
          }
        }
        old.distance=(old.distance+d)%stride;
      }
      old.x=a.x;old.z=a.z;
    }
    for(const id of this.actors.keys())if(!active.has(id))this.actors.delete(id);
    if(this.marks.length>this.capacity)this.marks.splice(0,this.marks.length-this.capacity);
  }
}
