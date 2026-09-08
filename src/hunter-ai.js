import {catBlocks,findPath,lineClear} from './core.js';
import {tickPanic} from './stickman-behavior.js';
import {stickmanSpeedMultiplier} from './stickman-tuning.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

// Each pursuer owns a route and cooldown. A giant cannot borrow the exit hunter's
// route, teleport to his cell, or inherit his speed when he leaves the courtyard.
export function updatePursuit(round,maze,h,dt){
  if(round.phase!=='playing')return;
  const p=round.player,ai=h.ai||={timer:0,route:[],step:0};h.moving=false;h.catBlocked=false;
  if(h.panic){tickPanic(round,maze,dt,Math.random,h);ai.timer=0;ai.route=[];return;}
  if(h.stunned>0){h.stunned=Math.max(0,h.stunned-dt);return;}
  if(round.heldCat!==null&&distance(h,p)<2.5&&lineClear(maze,h,p)){h.catBlocked=true;return;}
  ai.timer-=dt;
  if(ai.timer<=0){
    ai.timer=.85;const start=maze.index(h.x,h.z),target=maze.index(p.x,p.z),blocks=catBlocks(maze,round.cats);
    ai.route=findPath(maze,start,target,blocks);
    if(!ai.route.length)ai.route=findPath(maze,start,target);
    // Continue toward the next cell when safe, rather than repeatedly walking
    // backwards to this cell's centre each time the path is recalculated.
    ai.step=0;
    if(ai.route.length>1){
      const here=maze.point(ai.route[0]),next=maze.point(ai.route[1]);
      const cross=(h.x-here.x)*(next.z-here.z)-(h.z-here.z)*(next.x-here.x);
      // At a turn, go via the corner's centre so the collider cannot cut stone.
      if(Math.abs(cross)<.000001)ai.step=1;
    }
  }
  let budget=(h.hunterSpeed??round.settings.hunterSpeed)*stickmanSpeedMultiplier(round)*dt;
  while(budget>0&&ai.step<ai.route.length){
    const target=maze.point(ai.route[ai.step]),dist=distance(h,target);
    if(dist<.00001){ai.step++;continue;}
    const step=Math.min(budget,dist),nx=h.x+(target.x-h.x)/dist*step,nz=h.z+(target.z-h.z)/dist*step;
    const near=round.cats.find(c=>(c.state==='ground'||c.state==='eating')&&Math.hypot(c.x-nx,c.z-nz)<1.25&&lineClear(maze,c,{x:nx,z:nz}));
    if(near){h.catBlocked=true;near.waited=(near.waited||0)+dt;
      if(near.state==='ground'&&near.waited>7){near.waypoint=null;near.previousCell=null;near.waited=0;ai.timer=0;}
      break;
    }
    h.angle=Math.atan2(target.x-h.x,target.z-h.z);h.x=nx;h.z=nz;h.moving=true;budget-=step;
    if(step>=dist)ai.step++;
  }
}
