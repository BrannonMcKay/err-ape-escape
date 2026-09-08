import {huntersIn} from './core.js';
export const SOUND_RANGES={meow:20,catRelease:20,hunterStep:30,menace:34,taunt:38,frustration:38};
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

// The listener follows steering, not Christel's cosmetic dancing/cuddle rotation.
export function spatialMix(listener,source,range){
  const dx=source.x-listener.x,dz=source.z-listener.z,distance=Math.hypot(dx,dz);
  const fade=clamp(1-distance/range,0,1);
  return {distance,gain:fade*fade,pan:distance<.001?0:clamp((-Math.cos(listener.angle)*dx+Math.sin(listener.angle)*dz)/distance,-1,1)*.85};
}

export class AudioCues{
  constructor(random=Math.random){this.random=random;this.round=null;this.reset();}
  reset(){this.positions=new Map();this.steps={player:0,hunter:0};this.meows=new Map();this.menace=4;this.catGap=0;}
  update(round,dt,active){
    if(this.round!==round){this.round=round;this.reset();}
    if(!active){this.reset();return {events:[],purring:false};}
    const events=[],p=round.player;dt=clamp(dt,0,.25);
    for(const [name,actor,stride,kind] of [['player',p,1.6,'playerStep'],...huntersIn(round).map(h=>[h.id||'hunter',h,1.65*(h.scale||1),'hunterStep'])]){
      const before=this.positions.get(name);this.positions.set(name,{x:actor.x,z:actor.z});
      const traveled=before?Math.hypot(actor.x-before.x,actor.z-before.z):0;
      // Ignore teleports, blocked input, posing, and paused-frame backlogs.
      if(traveled>.00001&&traveled<=Math.max(.3,dt*12)){
        this.steps[name]=(this.steps[name]||0)+traveled;
        if(this.steps[name]>=stride){this.steps[name]%=stride;events.push({kind,source:actor});}
      }else if(traveled===0||traveled>Math.max(.3,dt*12))this.steps[name]=0;
    }
    this.catGap=Math.max(0,this.catGap-dt);
    for(const cat of round.cats){
      const available=cat.state==='ground',mix=spatialMix(p,cat,SOUND_RANGES.meow);
      if(!available||!mix.gain){this.meows.delete(cat.id);continue;}
      const wait=(this.meows.get(cat.id)??(.7+this.random()*1.5))-dt;
      if(wait<=0&&this.catGap<=0){events.push({kind:'meow',source:cat});this.meows.set(cat.id,3+this.random()*4);this.catGap=1.1;}
      else this.meows.set(cat.id,wait);
    }
    this.menace-=dt;
    if(this.menace<=0){
      const nearest=huntersIn(round).filter(h=>!h.panic).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
      if(nearest&&spatialMix(p,nearest,SOUND_RANGES.menace).gain>0)events.push({kind:'menace',source:nearest});
      this.menace=7+this.random()*5;
    }
    return {events,purring:round.heldCat!==null};
  }
}
