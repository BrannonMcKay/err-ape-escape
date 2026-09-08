// Pure game rules and navigation; kept separate from rendering for repeatable tests.
import {TACITURN_DURATION} from './soundtrack-clock.js';
export const RULES = Object.freeze({ preview:15, kittyHold:8, kittyPickupCooldown:45, foodCooldown:120, foodArrival:3, foodEating:5, captureDuration:5.2, escapePoints:5, survivePoints:2, capturePoints:5, periodChance:.25, screamCooldown:16, screamDuration:3.5, retreatDuration:5 });
export const DIFFICULTIES = {
  gentle:{name:'Gentle', playerSpeed:4.7, hunterSpeed:2.7, timeScale:1.2},
  normal:{name:'Normal', playerSpeed:4.7, hunterSpeed:3.65, timeScale:1},
  wild:{name:'Wild', playerSpeed:4.7, hunterSpeed:4.4, timeScale:.85},
};
export function createMaze(data) {
  const {width:w,height:h,cellSize:s}=data;
  const walk=new Uint8Array(w*h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) walk[y*w+x]=data.rows[y][x]==='.'?1:0;
  const toIndex=([x,y])=>y*w+x;
  const maze={...data,walk,startIndex:toIndex(data.start),exitIndex:toIndex(data.exit)};
  maze.point=(i)=>({x:(i%w-w/2+.5)*s,z:(Math.floor(i/w)-h/2+.5)*s});
  maze.index=(x,z)=>{const cx=Math.floor(x/s+w/2),cy=Math.floor(z/s+h/2);return cx<0||cy<0||cx>=w||cy>=h?-1:cy*w+cx;};
  maze.open=(x,z)=>walk[maze.index(x,z)]===1;
  maze.route=findPath(maze,maze.startIndex,maze.exitIndex);
  if(!maze.route.length) throw new Error('The maze entrance and exit are disconnected.');
  maze.timeLimit=TACITURN_DURATION;
  return maze;
}
export function findPath(maze,start,end,blocked=null) {
  const {width:w,height:h,walk}=maze;
  if(start<0||end<0||!walk[start]||!walk[end]) return [];
  const parent=new Int32Array(w*h).fill(-1),q=new Int32Array(w*h);
  let head=0,tail=1;q[0]=start;parent[start]=start;
  while(head<tail){
    const i=q[head++]; if(i===end) break;
    const x=i%w,y=Math.floor(i/w);
    for(const n of [x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1]){
      if(n<0||!walk[n]||parent[n]!==-1||(blocked&&blocked.has(n)&&n!==start))continue;
      parent[n]=i;q[tail++]=n;
    }
  }
  if(parent[end]===-1)return [];
  const route=[];let n=end;
  while(n!==start){route.push(n);n=parent[n];}route.push(start);return route.reverse();
}
export function canOccupy(maze,x,z,r=.14){
  if(!maze.open(x,z))return false;
  for(let i=0;i<8;i++){const a=i*Math.PI/4;if(!maze.open(x+Math.cos(a)*r,z+Math.sin(a)*r))return false;}
  return true;
}
export function moveWithCollision(maze,body,dx,dz,r=.14){
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/(.12)));
  const sx=dx/steps,sz=dz/steps;let moved=false;
  for(let i=0;i<steps;i++){
    if(canOccupy(maze,body.x+sx,body.z,r)){body.x+=sx;moved ||= sx!==0;}
    if(canOccupy(maze,body.x,body.z+sz,r)){body.z+=sz;moved ||= sz!==0;}
  }
  return moved;
}
export function lineClear(maze,a,b){
  const n=Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/(.12));
  for(let i=0;i<=n;i++){const t=n?i/n:0;if(!maze.open(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t))return false;}
  return true;
}
export function catBlocks(maze,cats,radius=1.25){
  const result=new Set(),{width:w,cellSize:s}=maze,r=Math.ceil(radius/s);
  for(const cat of cats.filter(c=>c.state==='ground'||c.state==='eating')){
    const i=maze.index(cat.x,cat.z),cx=i%w,cy=Math.floor(i/w);
    for(let y=Math.max(0,cy-r);y<=Math.min(maze.height-1,cy+r);y++)for(let x=Math.max(0,cx-r);x<=Math.min(w-1,cx+r);x++){
      const n=y*w+x,p=maze.point(n);if(maze.walk[n]&&Math.hypot(p.x-cat.x,p.z-cat.z)<radius)result.add(n);
    }
  }
  return result;
}
export function newRound(maze,difficulty='normal'){
  const base=DIFFICULTIES[difficulty]||DIFFICULTIES.normal,hunter=maze.presentation?.hunter||{};
  const settings={...base,hunterSpeed:base.hunterSpeed*(hunter.speedMultiplier||1)};
  return {phase:'preview',preview:RULES.preview,remaining:maze.timeLimit,duration:maze.timeLimit,settings,
    player:{...maze.point(maze.startIndex),angle:0,stamina:100,idleSeconds:0,speech:null},hunter:{...maze.point(maze.exitIndex),angle:Math.PI,stunned:0,panic:null,speech:null,scale:hunter.scale||1,speedMultiplier:hunter.speedMultiplier||1},
    cats:[.07,.42,.74].map((t,id)=>({id,appearance:id===2?'stubby':'ginger',name:id===2?'Stubby':'Kitty',...maze.point(maze.route[Math.floor(maze.route.length*t)]),state:'ground',timer:0,pickupCooldown:0,moving:false})),
    heldCat:null,foodCooldown:0,food:null,capture:null,screamCooldown:0,grace:2,luckUsed:false,elapsed:0,result:null};
}
export function beginRound(round){if(round.phase==='preview'){round.phase='transition';round.transition=0;return true;}return false;}
export function finishRound(round,result,scores){
  if(round.result||!['escape','survived','caught'].includes(result))return false;
  if(result==='caught'){
    if(round.phase!=='capture'||!round.capture||round.capture.elapsed<RULES.captureDuration)return false;
  }else if(round.phase!=='playing')return false;
  round.result=result;round.phase='result';
  if(result==='escape'){scores.player+=RULES.escapePoints;scores.escapes++;}
  else if(result==='survived')scores.player+=RULES.survivePoints;
  else if(result==='caught')scores.stickman+=RULES.capturePoints;
  scores.rounds++;return true;
}
export function tryCapture(round,random=Math.random){
  if(round.heldCat!==null||round.grace>0||round.hunter.stunned>0)return 'protected';
  if(!round.luckUsed){round.luckUsed=true;if(random()<RULES.periodChance){startPanic(round,'period');round.grace=RULES.retreatDuration+.75;return 'period';}}
  return 'caught';
}
export function startPanic(round,kind='scream'){
  const h=round.hunter;
  h.stunned=kind==='period'?RULES.retreatDuration:RULES.screamDuration;
  h.panic={kind,elapsed:0,waypoint:null,previousCell:null,settled:false,turnTimer:0};h.moving=false;
  h.angle=Math.atan2(round.player.x-h.x,round.player.z-h.z);
}
export function pickupCat(round,maze){
  if(round.phase!=='playing'||round.heldCat!==null)return null;
  const cat=round.cats.find(c=>c.state==='ground'&&!(c.pickupCooldown>0)&&Math.hypot(c.x-round.player.x,c.z-round.player.z)<1.65&&lineClear(maze,c,round.player));
  if(!cat)return null;cat.state='held';cat.timer=RULES.kittyHold;round.heldCat=cat.id;return cat;
}
export function tickCats(round,dt,spawn){
  const events=[];
  for(const cat of round.cats){
    cat.pickupCooldown=Math.max(0,(cat.pickupCooldown||0)-dt);cat.jumpTime=Math.max(0,(cat.jumpTime||0)-dt);
    if(cat.state!=='held')continue;
    cat.timer-=dt;
    if(cat.timer>0)continue;
    Object.assign(cat,spawn(cat));cat.state='ground';cat.timer=0;cat.pickupCooldown=RULES.kittyPickupCooldown;cat.jumpTime=.6;cat.waypoint=null;cat.previousCell=null;cat.waited=0;
    round.heldCat=null;round.grace=Math.max(round.grace,1);events.push('jump');
  }
  return events;
}
export function dropFood(round,maze){
  if(round.phase!=='playing'||round.foodCooldown>0)return null;
  const cat=round.cats.find(c=>c.appearance==='stubby'&&(c.state==='hidden'||c.state==='ground'));
  if(!cat)return null;
  const p=round.player;let point=null;
  for(const [d,side] of [[.8,.65],[.8,-.65],[.8,0],[.5,0],[0,0]]){
    const index=maze.index(p.x+Math.sin(p.angle)*d+Math.cos(p.angle)*side,p.z+Math.cos(p.angle)*d-Math.sin(p.angle)*side);
    if(index<0||!maze.walk[index])continue;
    const candidate=maze.point(index);
    if(canOccupy(maze,candidate.x,candidate.z)&&lineClear(maze,p,candidate)){point=candidate;break;}
  }
  if(!point)return null;
  round.foodCooldown=RULES.foodCooldown;cat.state='summoned';cat.timer=0;cat.waited=0;cat.moving=false;
  round.food={...point,state:'waiting',timer:RULES.foodArrival,catId:cat.id};
  return round.food;
}
export function tickFood(round,dt){
  if(round.phase!=='playing')return [];
  round.foodCooldown=Math.max(0,round.foodCooldown-Math.max(0,dt));
  if(!round.food||round.food.state==='empty')return [];
  const events=[],food=round.food,cat=round.cats.find(c=>c.id===food.catId);
  let remaining=Math.max(0,dt);
  while(remaining>0&&food.state!=='empty'){
    const step=Math.min(remaining,food.timer);food.timer=Math.max(0,food.timer-step);remaining-=step;
    if(food.timer>0)break;
    if(food.state==='waiting'){
      food.state='eating';food.timer=RULES.foodEating;
      Object.assign(cat,{x:food.x,z:food.z,state:'eating',timer:0,waited:0,waypoint:null,previousCell:null});events.push('arrived');
    }else{
      food.state='empty';food.timer=0;cat.state='ground';cat.waited=0;events.push('fed');
    }
  }
  return events;
}
export function roamCats(round,maze,dt,random=Math.random){
  if(round.phase!=='playing')return;
  const w=maze.width;
  for(const cat of round.cats){
    cat.moving=false;
    if(cat.state!=='ground'||cat.jumpTime>0)continue;
    // A ready kitty waits when approached; one on cooldown keeps exploring.
    if(!(cat.pickupCooldown>0)&&Math.hypot(cat.x-round.player.x,cat.z-round.player.z)<1.15&&lineClear(maze,cat,round.player))continue;
    let budget=Math.min(.25,dt)*(cat.pickupCooldown>0?1.15:.72);
    while(budget>0){
      if(cat.waypoint==null){
        const i=maze.index(cat.x,cat.z),x=i%w,y=Math.floor(i/w);
        let options=[x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<maze.height-1?i+w:-1].filter(n=>n>=0&&maze.walk[n]);
        const forward=options.filter(n=>n!==cat.previousCell);if(forward.length)options=forward;
        if(!options.length)break;
        cat.waypoint=options[Math.min(options.length-1,Math.floor(random()*options.length))];cat.previousCell=i;
      }
      const point=maze.point(cat.waypoint),dx=point.x-cat.x,dz=point.z-cat.z,dist=Math.hypot(dx,dz);
      if(dist<.001){cat.waypoint=null;continue;}
      const step=Math.min(budget,dist);cat.angle=Math.atan2(dx,dz);
      moveWithCollision(maze,cat,dx/dist*step,dz/dist*step);cat.moving=true;budget-=step;
      if(step>=dist-.001)cat.waypoint=null;
    }
  }
}
export function beginCapture(round){
  if(round.phase!=='playing'||round.result||round.heldCat!==null||round.grace>0||round.hunter.stunned>0)return false;
  round.phase='capture';round.player.moving=false;round.hunter.moving=false;
  round.capture={elapsed:0,player:{...round.player},hunter:{...round.hunter}};
  return true;
}
export function tickCapture(round,dt){
  if(round.phase!=='capture'||!round.capture)return false;
  round.capture.elapsed=Math.min(RULES.captureDuration,round.capture.elapsed+Math.max(0,dt));
  return round.capture.elapsed>=RULES.captureDuration;
}
export function normalizeScores(value){
  const base={player:0,stickman:0,escapes:0,rounds:0};
  if(value&&typeof value==='object')for(const k in base)if(Number.isSafeInteger(value[k])&&value[k]>=0)base[k]=value[k];
  return base;
}
