import {canOccupy,lineClear,moveWithCollision,startPanic,huntersIn,RULES} from './core.js';
import {stickmanSpeedMultiplier} from './stickman-tuning.js';

export const TAUNTS = Object.freeze([
  "Would you like a churro?",
  "He'll yeah!",
  "I heard you have two dollars and I'm gonna take it!",
  "How can you even run with that big ol dupliclit!?",
  "Your shoelaces owe me money!",
  "You run like a shopping cart with one bad wheel!",
  "Your escape plan was written by a confused potato!",
  "I'm the final boss of minor inconveniences!",
  "Come back! I practiced this entrance!",
  "I'll fold your map into a tiny hat!",
  "I'm all limbs and terrible decisions!",
  "You can't outrun my emotional baggage!",
  "We're gonna have to do this the hard way!",
  "You look like you lose arguments to pigeons!",
  "Your GPS called. It gave up!",
  "Churro delivery!",
]);
export const WIN_GLOATS = Object.freeze([
  {headline:'TWO DOLLARS???',line:"I'll take the points because you don't have shit!"},
  {headline:'CHURRO DELIVERY!',line:"I've got a churro with your name on it!"},
  {headline:'CALL ME SIR TWIG.',line:'Five points. Zero muscles. Unbelievable talent.'},
  {headline:'POINTS, PLEASE!',line:'Your shoelaces have agreed to pay my appearance fee.'},
  {headline:'I WON A THING!',line:'Nobody panic. I have absolutely no idea what to do now.'},
  {headline:'BEHOLD THE STICK!',line:"I'm gonna make you hold it, that is."},
  {headline:'TIME TO PADDLE THE POOSA.',line:"I only brought my stick!"},
  {headline:'TINY MAN. BIG EGO.',line:'Please hold your applause. I brought my own.'},
]);
export function winGloat(random=Math.random){return WIN_GLOATS[Math.min(WIN_GLOATS.length-1,Math.floor(Math.max(0,random())*WIN_GLOATS.length))];}

export function say(actor,text,seconds=6.5){actor.speech={text,remaining:seconds};}
export const CAT_BLOCKED_LINE='Damn it! This stick is blocked again by a cute kitty.';
export function tickCatComplaint(round,dt,h=round.hunter){
  if(round.phase!=='playing')return false;
  const owner=h===round.hunter?round:h,b=owner.catComplaint||={blocked:0,clear:0,armed:true,cooldown:0};
  b.cooldown=Math.max(0,b.cooldown-dt);
  if(!h.catBlocked){b.blocked=0;b.clear+=dt;if(b.clear>=1)b.armed=true;return false;}
  b.clear=0;b.blocked+=dt;
  if(b.blocked<.35||!b.armed||b.cooldown>0||h.panic||h.speech)return false;
  say(h,CAT_BLOCKED_LINE,6.5);b.armed=false;b.cooldown=12;return true;
}
export function periodRetort(round,h=round.hunter){
  say(round.player,"I'm on my period!",5);
  say(h,'Damn it!!! Not again!',5);
}
export function scream(round,maze){
  if(round.phase!=='playing'||round.screamCooldown>0)return false;
  round.screamCooldown=RULES.screamCooldown;say(round.player,'AAAAAAH!',1.6);
  const p=round.player;let effective=false;
  for(const h of huntersIn(round)){
    if(Math.hypot(p.x-h.x,p.z-h.z)>=8||!lineClear(maze,p,h))continue;
    startPanic(round,'scream',h);say(h,'MY TINY EARS!!!',RULES.screamDuration);effective=true;
  }
  return effective;
}

// A new sighting must last briefly; corners and transparent walls cannot spam taunts.
export function tickBanter(round,dt,visible,random=Math.random,h=round.hunter){
  if(round.phase!=='playing')return;
  dt=Math.max(0,dt);
  for(const actor of h===round.hunter?[round.player,h]:[h])if(actor.speech){actor.speech.remaining-=dt;if(actor.speech.remaining<=0)actor.speech=null;}
  const owner=h===round.hunter?round:h,b=owner.banter ||= {seen:0,hidden:1,armed:true,cooldown:0,previous:-1};
  b.cooldown=Math.max(0,b.cooldown-dt);
  if(!visible){b.seen=0;b.hidden+=dt;if(b.hidden>=.8)b.armed=true;return;}
  b.hidden=0;b.seen+=dt;
  if(b.seen<.15||!b.armed||b.cooldown>0||h.panic||h.speech)return;
  const options=TAUNTS.map((_,i)=>i).filter(i=>i!==b.previous);
  const index=options[Math.min(options.length-1,Math.floor(Math.max(0,random())*options.length))];
  say(h,TAUNTS[index]);b.previous=index;b.armed=false;b.cooldown=12;
  return TAUNTS[index];
}

const neighbors=(maze,i)=>{
  const x=i%maze.width,y=Math.floor(i/maze.width),w=maze.width;
  return [x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<maze.height-1?i+w:-1].filter(n=>n>=0&&maze.walk[n]);
};
function distances(maze,start){
  const d=new Int32Array(maze.walk.length).fill(-1),q=new Int32Array(d.length);let head=0,tail=0;
  if(start<0||!maze.walk[start])return d;d[start]=0;q[tail++]=start;
  while(head<tail){const i=q[head++];for(const n of neighbors(maze,i))if(d[n]===-1){d[n]=d[i]+1;q[tail++]=n;}}
  return d;
}
function animalBlocks(round,maze,point){
  if(round.heldCat!==null&&Math.hypot(point.x-round.player.x,point.z-round.player.z)<2.5&&lineClear(maze,round.player,point))return true;
  return round.cats.some(c=>(c.state==='ground'||c.state==='eating')&&Math.hypot(c.x-point.x,c.z-point.z)<1.25&&lineClear(maze,c,point));
}

// Fast, cell-by-cell panic movement: random turns for screams, increasing maze distance for retreats.
export function tickPanic(round,maze,dt,random=Math.random,h=round.hunter){
  const panic=h.panic;
  if(round.phase!=='playing'||!panic||h.stunned<=0)return false;
  const step=Math.min(Math.max(0,dt),h.stunned),before=panic.elapsed;
  h.stunned=Math.max(0,h.stunned-step);panic.elapsed+=step;panic.turnTimer=Math.max(0,panic.turnTimer-step);h.moving=false;h.catBlocked=false;
  const retreat=panic.kind==='period',startle=retreat?.65:.2;
  let budget=Math.max(0,panic.elapsed-Math.max(before,startle))*(retreat?8.6:7.2)*(h.speedMultiplier||1)*stickmanSpeedMultiplier(round);
  if(retreat&&(!panic.distances||panic.elapsed>=panic.nextDistances)){
    panic.distances=distances(maze,maze.index(round.player.x,round.player.z));panic.nextDistances=panic.elapsed+.7;
  }
  while(budget>.0001){
    if(panic.waypoint===null){
      const i=maze.index(h.x,h.z);
      if(!panic.settled){panic.waypoint=i;panic.settled=true;}
      else{
        let options=neighbors(maze,i).filter(n=>{const p=maze.point(n);return canOccupy(maze,p.x,p.z)&&!animalBlocks(round,maze,p);});
        const forward=options.filter(n=>n!==panic.previousCell);
        const changeMind=!retreat&&panic.turnTimer<=0&&random()<.2;
        if(forward.length&&!changeMind)options=forward;
        if(!options.length){h.catBlocked=true;break;}
        if(retreat){const farthest=Math.max(...options.map(n=>panic.distances[n]));options=options.filter(n=>panic.distances[n]===farthest);}
        panic.waypoint=options[Math.min(options.length-1,Math.floor(Math.max(0,random())*options.length))];panic.previousCell=i;
        if(panic.turnTimer<=0)panic.turnTimer=.55+random()*.4;
      }
    }
    const target=maze.point(panic.waypoint),dx=target.x-h.x,dz=target.z-h.z,d=Math.hypot(dx,dz);
    if(d<.001){panic.waypoint=null;continue;}
    const travel=Math.min(budget,d),next={x:h.x+dx/d*travel,z:h.z+dz/d*travel};
    if(animalBlocks(round,maze,next)){h.catBlocked=true;panic.waypoint=null;break;}
    h.angle=Math.atan2(dx,dz);
    if(!moveWithCollision(maze,h,next.x-h.x,next.z-h.z)){panic.waypoint=null;break;}
    h.moving=true;budget-=travel;if(travel>=d-.001)panic.waypoint=null;
  }
  if(h.stunned<=0){h.panic=null;h.moving=false;}
  return true;
}
