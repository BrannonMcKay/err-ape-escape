// The Leaky Pad's rules use active soundtrack time, never wall time or preview time.
export const PAD_RULES=Object.freeze({firstRelease:30,releaseEvery:8,redLightsAt:29,size:1/3,firstSpeed:1.5,speedGrowth:1.1,tossChance:.5,attachmentsToTackle:3,oceanRedAt:60,sunsetAt:89,flightSeconds:4.8,tossCaptionSeconds:8});
export const PAD_POWER_WINDOWS=Object.freeze([Object.freeze([93,112]),Object.freeze([186,204])]);
export const STUBBY_POWER_SECONDS=18;
const NO_POWER=Object.freeze({active:false,index:-1,remaining:0,speedMultiplier:1});
export function padPower(round){
  if(!round.leakyPad)return NO_POWER;
  const t=round.elapsed||0,index=PAD_POWER_WINDOWS.findIndex(([start,end])=>t>=start&&t<end);
  const held=round.cats?.find(c=>c.id===round.heldCat&&c.state==='held'),stubbyRemaining=Math.max(0,(held?.powerUntil||0)-t);
  const remaining=Math.max(index<0?0:PAD_POWER_WINDOWS[index][1]-t,stubbyRemaining);
  return remaining<=0?NO_POWER:{active:true,index:index<0?2:index,remaining,speedMultiplier:2.5,stubby:stubbyRemaining>0};
}
export const TOSS_LINES=Object.freeze(['Wait!!!!','She-it!','I barely even knew you!','See you this time next month!']);
export const CHRISTEL_TOSS_LINE='I will not be hurt by a tiny stick man!';
export function padTimeline(seconds){
  const t=Math.max(0,seconds);
  return {oceanRed:Math.min(1,t/PAD_RULES.oceanRedAt),sunset:Math.min(1,t/PAD_RULES.sunsetAt),redLights:t>=PAD_RULES.redLightsAt,beamAngle:(t-30)/8*Math.PI*2,
    releaseCount:t<30?0:1+Math.floor((t-30)/8)};
}
export function miniatureContact(round,h,random=Math.random){
  if(h.state!=='chasing')return 'protected';
  h.moving=false;h.panic=null;h.ai=null;
  if(random()<PAD_RULES.tossChance){
    h.state='flying';h.flightElapsed=0;h.speech={text:TOSS_LINES[Math.min(3,Math.floor(random()*4))],remaining:PAD_RULES.tossCaptionSeconds};
    round.player.speech={text:CHRISTEL_TOSS_LINE,remaining:4.5};
    round.player.tossRemaining=.85;
    return 'tossed';
  }
  h.state='attached';h.attachment=round.miniatures.filter(m=>m.state==='attached').length-1;
  return h.attachment+1>=PAD_RULES.attachmentsToTackle?'caught':'attached';
}
export function tickMiniatures(round,maze,dt){
  if(!round.leakyPad||round.phase!=='playing')return [];
  const events=[],target=padTimeline(Math.min(round.elapsed,round.duration-1e-6)).releaseCount;
  round.player.tossRemaining=Math.max(0,(round.player.tossRemaining||0)-dt);
  while(round.miniatures.length<target){
    const n=round.miniatures.length,speedMultiplier=1.5*1.1**n;
    const spawn=maze.presentation?.miniatureSpawn||maze.start;
    const h={id:`mini-${n}`,miniature:true,state:'chasing',...maze.point(spawn[1]*maze.width+spawn[0]),angle:round.player.angle,scale:1/3,speedMultiplier,hunterSpeed:round.settings.hunterSpeed*speedMultiplier,stunned:0,panic:null,speech:null,moving:false,releasedAt:30+8*n};
    round.miniatures.push(h);events.push({kind:'release',hunter:h});
  }
  if(round.player.speech){round.player.speech.remaining-=dt;if(round.player.speech.remaining<=0)round.player.speech=null;}
  for(const h of round.miniatures){
    if(h.speech){h.speech.remaining-=dt;if(h.speech.remaining<=0)h.speech=null;}
    if(h.state==='attached'){
      const a=round.player.angle+(h.attachment===0?-1.8:h.attachment===1?1.8:0);
      h.x=round.player.x+Math.sin(a)*.24;h.z=round.player.z+Math.cos(a)*.24;h.y=.48+h.attachment*.17;h.angle=a+Math.PI;
    }else if(h.state==='flying'){
      if(!h.flight){
        const p=round.player,halfW=maze.width*maze.cellSize/2+8,halfH=maze.height*maze.cellSize/2+8;
        // Aim beyond the nearest whole-board edge, ensuring the landing is water.
        const targets=[{x:-halfW,z:p.z},{x:halfW,z:p.z},{x:p.x,z:-halfH},{x:p.x,z:halfH}];
        const end=targets.sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
        h.flight={x:p.x,z:p.z,...{endX:end.x,endZ:end.z}};
      }
      h.flightElapsed+=dt;const t=Math.min(1,h.flightElapsed/PAD_RULES.flightSeconds),f=h.flight;
      h.x=f.x+(f.endX-f.x)*t;h.z=f.z+(f.endZ-f.z)*t;h.y=.7*(1-t)-1.8*t+Math.sin(Math.PI*t)*16;
      if(t===1){h.state='removed';events.push({kind:'splash',hunter:h});}
    }
  }
  return events;
}
