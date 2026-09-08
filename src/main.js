import {createMaze,findPath,moveWithCollision,lineClear,catBlocks,newRound,beginRound,finishRound,tryCapture,pickupCat,tickCats,dropFood,tickFood,roamCats,beginCapture,tickCapture,normalizeScores,RULES} from './core.js';
import {World} from './world.js';
import {sightClear} from './presentation.js';
import {tickRunnerIdle} from './runner-animation.js';
import {scream,tickPanic,tickBanter,tickCatComplaint,periodRetort,winGloat,say} from './stickman-behavior.js';
import {resultScreen} from './result-screen.js';
import {GameAudio} from './audio.js';
import {terrainAt} from './terrain.js';
import {LEVELS} from './levels.js';
import {advanceSoundtrackClock} from './soundtrack-clock.js';

const $=id=>document.getElementById(id),modal=$('modal'),content=$('modal-content'),keys=new Set();
const ART=LEVELS;
let selectedLevel='mountains',switchingLevel=false;
let maze,world,round,view='home',last=0,time=0,toastUntil=0,aiTimer=0,aiRoute=[],aiStep=0,pausedFrom=null,drag=null,loaded=false;
const audio=new GameAudio({onChange:updateAudioControls});
function activateAudio(){audio.activate().catch(error=>{notify(error.message);});}
document.addEventListener('pointerdown',()=>{if(!audio.context||audio.context.state!=='running'||(audio.enabled.music&&!audio.musicBuffer))activateAudio();});
document.addEventListener('keydown',()=>{if(!audio.context||audio.context.state!=='running')activateAudio();});
let scores=normalizeScores(null);try{scores=normalizeScores(JSON.parse(localStorage.getItem('wrath-maze-scores-v1')));}catch{}
const movieUrls=new Map();
const clock=s=>`${Math.floor(Math.max(0,Math.ceil(s))/60).toString().padStart(2,'0')}:${(Math.max(0,Math.ceil(s))%60).toString().padStart(2,'0')}`;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

function showModal(html){modal.classList.remove('victory-dialog');content.innerHTML=html;if(!modal.open)modal.showModal();}
function closeModal(){content.querySelector('video')?.pause();modal.close();if(pausedFrom)resume();else if(view==='result')home();audio.setView(view);}
$('close-modal').onclick=closeModal;
modal.addEventListener('cancel',e=>{e.preventDefault();closeModal();});
modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});
function notify(message){$('toast').textContent=message;$('toast').classList.add('visible');toastUntil=time+3.5;}
function sound(...args){audio.tone(...args);}
function updateAudioControls(){
  for(const channel of ['effects','music']){
    const enabled=audio.enabled[channel],label=channel==='effects'?'SFX':'Music';
    for(const id of [`${channel}-toggle`,`${channel}-setting`]){
      const button=$(id);if(!button)continue;
      button.textContent=`${label} ${enabled?'on':'off'}`;button.setAttribute('aria-pressed',String(enabled));button.setAttribute('aria-label',`${enabled?'Mute':'Enable'} ${channel==='effects'?'sound effects':'music'}`);
    }
  }
  if($('music-credit'))$('music-credit').textContent=audio.musicLabel;
  if($('music-status'))$('music-status').textContent=audio.musicStatus;
}
async function toggleAudio(channel){
  try{await audio.setEnabled(channel,!audio.enabled[channel]);if(channel==='effects'&&audio.enabled.effects)sound(520,.15);}
  catch(error){notify(error.message);if($('music-status'))$('music-status').textContent=error.message;}
  updateAudioControls();
  if(view==='playing')$('world').focus();
}
$('effects-toggle').onclick=()=>toggleAudio('effects');$('music-toggle').onclick=()=>toggleAudio('music');
$('sound').onclick=()=>{
  interruptForDialog();audio.setView('sound-settings');
  showModal(`<span class="modal-eyebrow">THE SOUND OF A SMALL ADVENTURE</span><h2 class="modal-title">Meows, mischief & music.</h2><p class="modal-lede">Keep the chase sounds, the music, or both. Headphones make it easier to hear which side the footsteps are coming from.</p><div class="audio-settings">${['effects','music'].map(channel=>`<div class="audio-setting"><button class="secondary" id="${channel}-setting"></button><label for="${channel}-volume">${channel==='effects'?'Sound effects':'Music'} volume</label><input id="${channel}-volume" type="range" min="0" max="100" value="${Math.round(audio.volume[channel]*100)}"><output id="${channel}-level">${Math.round(audio.volume[channel]*100)}%</output></div>`).join('')}</div><p id="music-credit" class="music-credit"></p><p id="music-status" class="fineprint" role="status"></p><div class="modal-buttons"><button class="secondary" id="choose-music">Try a local music file</button><button class="secondary" id="restore-music">Taciturn Eternity</button></div><input type="file" id="music-file" accept="audio/*,.mid,.midi,.wav" hidden><p class="fineprint">Now playing Mimesis: Taciturn Eternity. Music fades out at the end of a round and starts fresh on your next run. Meows, purring, soft shoes, heavy boots, and goofy “wah-ha-ha” noises are temporary synthesized sounds. A local WAV, MP3, or MIDI can replace the music for this visit; it stays on your computer. The chase waits while you adjust the sound.</p>`);
  for(const channel of ['effects','music']){
    $(`${channel}-setting`).onclick=()=>toggleAudio(channel);
    $(`${channel}-volume`).oninput=e=>{audio.setVolume(channel,e.target.value/100);$(`${channel}-level`).textContent=`${e.target.value}%`;};
  }
  $('choose-music').onclick=()=>$('music-file').click();
  async function changeMusic(action){
    const choose=$('choose-music'),restore=$('restore-music');choose.disabled=restore.disabled=true;
    try{await action();}catch(error){if($('music-status'))$('music-status').textContent=`Could not play this file: ${error.message}`;}
    finally{choose.disabled=restore.disabled=false;}
  }
  $('music-file').onchange=e=>{const file=e.target.files?.[0];if(file)changeMusic(()=>audio.useMusicFile(file));};
  $('restore-music').onclick=()=>changeMusic(()=>audio.restoreMusic());updateAudioControls();
};
updateAudioControls();

function setView(next){
  audio.setView(next);
  view=next;const home=next==='home';$('app').className=home?'home-mode':'game-mode';$('home-overlay').classList.toggle('hidden',!home);$('game-hud').classList.toggle('hidden',home);$('preview-panel').classList.toggle('hidden',next!=='preview');
  $('app').dataset.view=next;
  $('capture-overlay').classList.toggle('hidden',next!=='capture');
  $('touch-controls').classList.toggle('hidden',next!=='playing'||!matchMedia('(pointer:coarse)').matches);
  document.body.style.overflow=home?'':'hidden';
  if(next!=='playing')keys.clear();
}
function updateScores(){ $('player-score').textContent=scores.player;$('hunter-score').textContent=scores.stickman; }
function aimAtRoute(){const p=maze.point(maze.route[Math.min(5,maze.route.length-1)]);round.player.angle=Math.atan2(p.x-round.player.x,p.z-round.player.z);}
function start(){if(!loaded)return;modal.close();pausedFrom=null;round=newRound(maze,$('difficulty').value);if(audio.musicBuffer)round.duration=round.remaining=audio.musicBuffer.duration;aimAtRoute();aiTimer=0;aiRoute=[];aiStep=0;setView('preview');audio.startRound(round);activateAudio();updateScores();$('world').focus();sound(400,.2);}
function skip(){if(round&&beginRound(round)){setView('transition');$('world').focus();sound(660,.2);}}
function saveScores(){try{localStorage.setItem('wrath-maze-scores-v1',JSON.stringify(scores));}catch{}}
function home(){modal.close();pausedFrom=null;if(!maze)return;if(round?.phase==='capture'){tickCapture(round,RULES.captureDuration);finishRound(round,'caught',scores);saveScores();}round=newRound(maze,$('difficulty').value);aimAtRoute();setView('home');updateScores();}
function pause(){
  if(!['playing','preview','transition','capture'].includes(view))return;
  pausedFrom=view;round.player.moving=false;round.hunter.moving=false;setView('paused');showModal(`<span class="modal-eyebrow">TAKE A BREATHER</span><h2 class="modal-title">Even menaces need a break.</h2><p class="modal-lede">The clock, Stickman, and your kitty are all paused.</p><div class="modal-buttons"><button class="primary" id="resume">Keep running <b>↗</b></button><button class="secondary" id="quit">Back to mazes</button></div><p class="fineprint">Leaving this round does not change your score.</p>`);
  $('resume').onclick=closeModal;$('quit').onclick=home;
  if(pausedFrom==='capture'){content.querySelector('.fineprint').textContent='The tag has already landed. Leaving now still records Stickman’s five points.';$('resume').innerHTML='Continue <b>↗</b>';}
}
function resume(){if(!pausedFrom)return;const previous=pausedFrom;pausedFrom=null;setView(previous);$('world').focus();}
$('play').onclick=start;$('skip').onclick=skip;$('pause').onclick=pause;$('brand-home').onclick=e=>{e.preventDefault();if(view==='home')home();else pause();};$('nav-play').onclick=()=>{if(view==='home')$('play').focus();else pause();};
document.querySelectorAll('[data-level]').forEach(b=>b.onclick=()=>{if(view==='home'&&loaded&&!switchingLevel)selectLevel(b.dataset.level);});
function interruptForDialog(){if(['playing','preview','transition','capture'].includes(view)){pausedFrom=view;setView('paused');}}
function art(id){interruptForDialog();const a=ART[id];showModal(`<span class="modal-eyebrow">FROM CHRISTEL’S SKETCHBOOK</span><h2 class="modal-title">${a.name}</h2><img class="original-image" src="${a.file}" alt="${a.name}, original hand-drawn maze"><p class="fineprint">${a.note}</p>`);}
$('view-original').onclick=()=>art(selectedLevel);
$('nav-sketchbook').onclick=()=>{interruptForDialog();showModal(`<span class="modal-eyebrow">INK FIRST. ADVENTURE SECOND.</span><h2 class="modal-title">The sketchbook</h2><p class="modal-lede">Two strange little worlds drawn by Christel. Both are ready to explore in 3D.</p><div class="art-grid">${Object.entries(ART).map(([id,a])=>`<button data-view-art="${id}"><img src="${a.file}" alt="${a.name}"><strong>${a.name} ↗</strong><small>PLAYABLE · 3D</small></button>`).join('')}</div>`);document.querySelectorAll('[data-view-art]').forEach(b=>b.onclick=()=>art(b.dataset.viewArt));};
$('help').onclick=()=>{interruptForDialog();showModal(`<span class="modal-eyebrow">A FIELD GUIDE TO NOT GETTING CAUGHT</span><h2 class="modal-title">Find your way. Keep your cat.</h2><p class="modal-lede">Study the maze from above for 15 seconds, then run through it at ground level. Stickman starts at the exit and works his way toward you. Reach the glowing peach exit, or stay uncaught until the clock runs out.</p><div class="help-grid"><div><kbd>W</kbd><kbd>S</kbd> Move forward / backward</div><div><kbd>A</kbd><kbd>D</kbd> Turn left / right</div><div><kbd>SHIFT</kbd> Sprint while stamina lasts</div><div><kbd>E</kbd> Pick up a nearby kitty</div><div><kbd>SPACE</kbd> Shout to stun a nearby Stickman</div><div><kbd>ESC</kbd> Pause / resume</div><div><kbd>F</kbd> Drop cat food · two-minute refill</div></div><p class="fineprint">Arrow keys also work. Drag the game view to turn; on a touch screen, use the buttons. Stay still for one second to dance and twirl, or pose toward the camera with a held kitty. Move or turn to resume the chase. Kitty protection lasts eight seconds. The kitty then jumps down and bounds around the maze with a 45-second pickup cooldown shown above its head. Ground cats still block Stickman. Press F to place cat food: a kitty arrives after three seconds and eats for five seconds. The bowl has a two-minute refill countdown. Feeding does not cancel a kitty’s pickup cooldown. Low walls and glass windows let you see across corridors; they still block movement. A shout works within eight metres along a clear corridor and recharges in 16 seconds. An effective scream makes Stickman cover his ears and run around in a panic for 3.5 seconds. On the first unprotected catch attempt, there is a 25% chance Christel announces her period: Stickman cancels his tackle and flees for five seconds. Speech bubbles appear above their heads, and Stickman has a rotating collection of ridiculous taunts when he comes into view.</p><div class="rules-row"><span><strong>+5</strong> Find the exit</span><span><strong>+2</strong> Outlast the clock</span><span><strong>+5</strong> Stickman tags you</span></div><p class="fineprint">Capture is a five-second nonsexual cartoon tackle and grin sequence before the score screen. Use SFX and Music in the top bar to enable audio independently. Sound settings adjust their volumes and let you try a local music file. Cat meows and Stickman sounds fade with distance; a held kitty purrs. Music and effects default to on after your first click. Mimesis: Taciturn Eternity fades out at the end of a round and restarts with the next run. The sound effects are synthesized placeholders. Score saves in this browser.</p>`);};

function cinema(){interruptForDialog();showModal(`<span class="modal-eyebrow">THE SCREENING ROOM</span><h2 class="modal-title">Run now. Movie night later.</h2><p class="modal-lede">Earn points to unlock Christel’s three Wrath of Stickman films. Your score: <b>${scores.player}</b>.</p>${[5,10,20].map((points,i)=>{const unlocked=scores.player>=points;return `<div class="film-card ${unlocked?'':'locked'}"><span class="film-number">${['I','II','III'][i]}</span><div><strong>Wrath of Stickman · Part ${['I','II','III'][i]}</strong><small>${unlocked?'Unlocked · choose a local movie file':`Unlocks at ${points} points`}</small></div>${unlocked?`<button class="secondary" data-movie="${i}">${movieUrls.has(i)?'Watch film':'Choose film'}</button>`:`<span>${points} PTS</span>`}</div>`;}).join('')}<p class="fineprint">Film files haven’t been supplied yet. Unlocked films can play from a file you choose on this computer; nothing is uploaded. Attachments last for this session. Your unlocks are saved.</p>`);
  document.querySelectorAll('[data-movie]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.movie);if(movieUrls.has(i))return watch(i);const input=document.createElement('input');input.type='file';input.accept='video/*';input.onchange=()=>{const file=input.files?.[0];if(file){movieUrls.set(i,URL.createObjectURL(file));watch(i);}};input.click();});
  const reset=document.createElement('button');reset.className='secondary';reset.textContent='Reset scores';
  reset.onclick=()=>{scores=normalizeScores(null);try{localStorage.setItem('wrath-maze-scores-v1',JSON.stringify(scores));}catch{}updateScores();cinema();};content.append(reset);
}
function watch(i){showModal(`<span class="modal-eyebrow">UNLOCKED · PART ${['I','II','III'][i]}</span><h2 class="modal-title">Wrath of Stickman</h2><video class="movie-player" controls playsinline src="${movieUrls.get(i)}"></video><p class="fineprint">Playing your local file. Use the player’s full-screen button for movie night.</p>`);}
$('nav-cinema').onclick=cinema;

function pickup(){if(view!=='playing')return;const cat=pickupCat(round,maze);if(cat){aiTimer=0;notify('Kitty acquired. Eight seconds of untouchable.');world.burst(round.player);sound(850,.18);}else{const eating=round.food?.state==='eating'&&distance(round.player,round.food)<1.65&&lineClear(maze,round.player,round.food);const tired=round.cats.find(c=>c.state==='ground'&&c.pickupCooldown>0&&distance(c,round.player)<1.65&&lineClear(maze,c,round.player));notify(round.heldCat!==null?'Your kitty is already on duty.':eating?`Let kitty finish dinner · ${Math.ceil(round.food.timer)}s`:tired?`Kitty needs some space · ${Math.ceil(tired.pickupCooldown)}s`:'Get close to a kitty and press E.');}}
function food(){
  if(view!=='playing')return;
  const bowl=dropFood(round,maze);
  if(bowl){aiTimer=0;notify('Dinner is served. A kitty will arrive in 3 seconds.');sound(620,.14);}
  else notify(round.foodCooldown>0?`Bowl refills in ${clock(round.foodCooldown)}.`:round.cats.some(c=>c.appearance==='stubby'&&c.state==='held')?'Stubby is already in your arms!':'Find a clear spot in the corridor for the bowl.');
  $('world').focus();
}
function shout(){if(view!=='playing')return;if(round.screamCooldown>0){notify(`Catch your breath · ${Math.ceil(round.screamCooldown)}s`);return;}const effective=scream(round,maze);world.burst(round.player,0xf4b995);audio.effect('scream');if(effective){aiTimer=0;notify('AAAAH! Stickman is covering his ears and panicking!');}else notify('AAAAH! A magnificent shout. Nobody close enough to hear.');}
document.addEventListener('keydown',e=>{
  if(e.code==='Escape'){e.preventDefault();if(modal.open)closeModal();else pause();return;}
  if(modal.open||['INPUT','SELECT','TEXTAREA','BUTTON'].includes(e.target.tagName))return;
  const handled=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','KeyE','KeyF','Space'];
  if(!handled.includes(e.code))return;if(view==='playing'||view==='preview')e.preventDefault();
  if(view==='preview'&&(e.code==='Space')){skip();return;}
  if(view!=='playing')return;keys.add(e.code);if(!e.repeat){if(e.code==='KeyE')pickup();if(e.code==='KeyF')food();if(e.code==='Space')shout();}
});
document.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();if(!modal.open)pause();});
document.addEventListener('visibilitychange',()=>{audio.setHidden(document.hidden);if(document.hidden&&!modal.open)pause();});
const canvas=$('world');
canvas.addEventListener('pointerdown',e=>{if(view==='home'||view==='playing'){canvas.focus();drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}});
canvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x;drag={x:e.clientX,y:e.clientY};if(view==='home')world.orbit-=dx*.006;else if(view==='playing'&&dx){round.player.angle-=dx*.006;round.player.idleSeconds=0;}});
canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);
canvas.addEventListener('wheel',e=>{if(view==='home'&&world){e.preventDefault();world.zoom=Math.max(.7,Math.min(1.35,world.zoom+e.deltaY*.0005));}},{passive:false});
document.querySelectorAll('[data-key]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.key);};b.onpointerup=b.onpointercancel=()=>keys.delete(b.dataset.key);});
document.querySelector('[data-action="cat"]').onclick=pickup;document.querySelector('[data-action="shout"]').onclick=shout;
document.querySelector('[data-action="food"]').onclick=food;$('food-action').onclick=food;

function releaseCat(){
  const p=round.player;
  for(const d of [.65,.35,0]){const index=maze.index(p.x+Math.sin(p.angle)*d,p.z+Math.cos(p.angle)*d);if(index>=0&&maze.walk[index]){const point=maze.point(index);if(lineClear(maze,p,point))return point;}}
  return {x:p.x,z:p.z};
}
function updateHunter(dt){
  const h=round.hunter,p=round.player;h.moving=false;h.catBlocked=false;
  if(h.panic){tickPanic(round,maze,dt);aiTimer=0;aiRoute=[];aiStep=0;return;}
  if(h.stunned>0){h.stunned=Math.max(0,h.stunned-dt);return;}
  if(round.heldCat!==null&&distance(h,p)<2.5&&lineClear(maze,h,p)){h.catBlocked=true;return;}
  aiTimer-=dt;
  if(aiTimer<=0){
    aiTimer=.85;const start=maze.index(h.x,h.z),target=maze.index(p.x,p.z);const blocks=catBlocks(maze,round.cats);
    aiRoute=findPath(maze,start,target,blocks);
    // If animals cut off every route, approach politely and wait at the first cat.
    if(!aiRoute.length)aiRoute=findPath(maze,start,target);
    aiStep=0;if(aiRoute.length&&distance(h,maze.point(aiRoute[0]))<.035)aiStep=1;
  }
  let budget=round.settings.hunterSpeed*dt;
  while(budget>0&&aiStep<aiRoute.length){
    const target=maze.point(aiRoute[aiStep]),dist=distance(h,target);
    if(dist<.015){aiStep++;continue;}
    const step=Math.min(budget,dist),nx=h.x+(target.x-h.x)/dist*step,nz=h.z+(target.z-h.z)/dist*step;
    const near=round.cats.find(c=>(c.state==='ground'||c.state==='eating')&&Math.hypot(c.x-nx,c.z-nz)<1.25&&lineClear(maze,c,{x:nx,z:nz}));
    if(near){h.catBlocked=true;near.waited=(near.waited||0)+dt;
      if(near.state==='ground'&&near.waited>7){near.waypoint=null;near.previousCell=null;near.waited=0;aiTimer=0;}
      break;
    }
    h.angle=Math.atan2(target.x-h.x,target.z-h.z);h.x=nx;h.z=nz;h.moving=true;budget-=step;
    if(step>=dist-.001)aiStep++;
  }
}
function finish(result){
  if(!finishRound(round,result,scores))return;
  setView('result');updateScores();try{localStorage.setItem('wrath-maze-scores-v1',JSON.stringify(scores));}catch{}
  if(result==='caught')sound(130,.5,'triangle');else{world.burst(round.player);sound(660,.3);}
  showModal(resultScreen(result,round,scores));modal.classList.toggle('victory-dialog',result==='escape');
  $('again').onclick=start;$('result-home').onclick=home;
}
function capture(){
  if(!beginCapture(round))return;
  round.capture.gloat=winGloat();
  setView('capture');$('capture-word').textContent='UH-OH.';$('capture-caption').textContent='One tiny Stickman. Absolutely no chill.';
  sound(180,.18,'triangle');
}
function updateCapture(dt){
  const before=round.capture.elapsed,done=tickCapture(round,dt),t=round.capture.elapsed;
  if(before<.95&&t>=.95){world.burst(round.player,0xf5ca8c);sound(95,.25,'triangle',.05);}
  const gloat=round.capture.gloat;
  if(before<2&&t>=2)audio.taunt(round);
  $('capture-word').textContent=t<.9?'UH-OH.':t<2?'BONK!':gloat.headline;
  $('capture-caption').textContent=t<.9?'One tiny Stickman. Absolutely no chill.':t<2?'A spectacularly unnecessary tackle.':gloat.line;
  if(done)finish('caught');
}
function updatePlaying(dt){
  const p=round.player,h=round.hunter;
  round.grace=Math.max(0,round.grace-dt);round.screamCooldown=Math.max(0,round.screamCooldown-dt);
  const left=keys.has('KeyA')||keys.has('ArrowLeft'),right=keys.has('KeyD')||keys.has('ArrowRight');p.angle+=(Number(left)-Number(right))*2.4*dt;
  const f=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'));
  const sprint=f!==0&&(keys.has('ShiftLeft')||keys.has('ShiftRight'))&&p.stamina>2;
  p.stamina=Math.max(0,Math.min(100,p.stamina+(sprint?-24:13)*dt));
  const speed=round.settings.playerSpeed*(sprint?1.48:1)*(f<0?.65:1);
  p.moving=moveWithCollision(maze,p,Math.sin(p.angle)*f*speed*dt,Math.cos(p.angle)*f*speed*dt);
  tickRunnerIdle(round,dt,!!f||left||right);
  const heldBefore=round.heldCat,catEvents=tickCats(round,dt,releaseCat);
  if(catEvents.includes('jump')){notify('Kitty wants to explore! Pick up again in 45 seconds.');audio.releaseCat(round.cats.find(c=>c.id===heldBefore),round.player);aiTimer=0;}
  const foodEvents=tickFood(round,dt);
  if(foodEvents.includes('arrived')){aiTimer=0;world.burst(round.food);say(round.player,'Stubby!',3);audio.effect('greeting');notify('Stubby arrived! Five seconds for dinner.');}
  if(foodEvents.includes('fed')){aiTimer=0;const fedCat=round.cats.find(c=>c.id===round.food.catId);notify(fedCat.pickupCooldown>0?`Dinner is done. Kitty needs ${Math.ceil(fedCat.pickupCooldown)}s more rest.`:'A well-fed kitty. Press E nearby to pick them up.');sound(740,.15);}
  roamCats(round,maze,dt);
  updateHunter(dt);
  if(tickCatComplaint(round,dt))audio.taunt(round,'frustration');
  if(tickBanter(round,dt,world.stickmanInView(round)))audio.taunt(round);
  const goal=maze.point(maze.exitIndex);
  // Solid walls must separate nearby start/exit corridors and prevent tagging through stone.
  if(distance(p,goal)<.7&&lineClear(maze,p,goal)){finish('escape');return;}
  if(distance(p,h)<.55&&lineClear(maze,p,h)){
    const result=tryCapture(round);if(result==='caught'){capture();return;}
    if(result==='period'){periodRetort(round);audio.taunt(round);p.idleSeconds=0;aiTimer=0;notify('Tackle cancelled. Stickman is making a dramatic exit!');world.burst(h,0xeaa5c7);}
  }
  if(round.remaining<=0){finish('survived');return;}
}
function hud(){
  const region=terrainAt(maze,round.player.x,round.player.z);if($('biome').textContent!==region.name)$('biome').textContent=region.name;
  $('timer').textContent=clock(round.remaining);$('timer-label').textContent=view==='preview'?'STUDY THE MAZE':'TIME TO ESCAPE';$('countdown').textContent=Math.ceil(round.preview);
  document.querySelector('.timer-panel').classList.toggle('urgent',round.remaining<30);
  const cat=round.heldCat===null?null:round.cats[round.heldCat];
  $('stamina-fill').style.width=`${round.player.stamina}%`;$('kitty-text').textContent=cat?`Kitty shield · ${Math.ceil(cat.timer)}s`:'Find a kitty';$('kitty-status').classList.toggle('protected',!!cat);
  $('shout-text').textContent=round.screamCooldown>0?`Shout · ${Math.ceil(round.screamCooldown)}s`:'Shout · ready';
  const food=round.food;
  $('food-text').textContent=round.foodCooldown>0?`Bowl refill · ${clock(round.foodCooldown)}`:'Cat food · ready';
  $('food-detail').textContent=food?.state==='waiting'?`Kitty arrives in ${Math.ceil(food.timer)}s`:food?.state==='eating'?`Kitty eating · ${Math.ceil(food.timer)}s`:round.foodCooldown>0?'Two-minute refill':'Drop a bowl to call a kitty';
  $('food-action').disabled=view!=='playing'||round.foodCooldown>0;
  document.querySelector('[data-action="food"]').disabled=view!=='playing'||round.foodCooldown>0;
  const near=round.cats.find(c=>c.state==='ground'&&!(c.pickupCooldown>0)&&distance(c,round.player)<1.65&&lineClear(maze,c,round.player));
  $('interaction').classList.toggle('hidden',view!=='playing'||!near||!!cat);
  const h=round.hunter,p=round.player,clear=lineClear(maze,h,p),close=distance(h,p)<9&&clear,spotted=distance(h,p)<24&&sightClear(maze,world.wallStyles,h,p);
  $('danger').classList.toggle('hidden',view!=='playing'||!close||!!cat||h.stunned>0);
  $('hunter-status').textContent=view==='capture'?'The chase has reached its ridiculous conclusion.':view==='preview'?'Stickman starts at the exit.':h.panic?.kind==='period'?'Tackle cancelled. Stickman is fleeing!':h.panic?.kind==='scream'?'Stickman is covering his ears!':h.stunned>0?'Stickman is seeing stars…':h.catBlocked?'Stickman is negotiating with a cat.':cat?'Stickman respects the kitty.':close?'Those footsteps are getting closer.':spotted&&!clear?'Stickman spotted beyond the wall.':'Stickman is somewhere in the maze…';
  if(time>toastUntil)$('toast').classList.remove('visible');
}
function frame(now){
  const clockDt=Math.max(0,(now-last)/1000||.016),dt=Math.min(clockDt,.25);last=now;time+=dt;
  if(round){
    if(view==='preview'){round.preview=Math.max(0,round.preview-dt);if(round.preview<=0)skip();}
    else if(view==='transition'){round.transition+=dt/(matchMedia('(prefers-reduced-motion:reduce)').matches?.15:1.6);if(round.transition>=1){round.phase='playing';setView('playing');notify('The chase is on. W to run. A / D to turn.');}}
    else if(view==='playing'){advanceSoundtrackClock(round,clockDt);if(round.remaining<=0)finish('survived');let rest=dt;while(rest>0&&view==='playing'){const step=Math.min(rest,1/60);updatePlaying(step);rest-=step;}}
    else if(view==='capture')updateCapture(dt);
    audio.update(round,dt);hud();world.update(round,dt,time,view==='paused'&&pausedFrom!=='playing'?pausedFrom:view);
  }
  requestAnimationFrame(frame);
}
async function init(){
  try{
    const requested=new URLSearchParams(location.search).get('maze');await selectLevel(LEVELS[requested]?requested:'mountains');
    $('difficulty').onchange=()=>{if(view==='home'){round=newRound(maze,$('difficulty').value);aimAtRoute();$('home-duration').textContent=`${clock(round.remaining)} on the clock`;}};
    loaded=true;updateScores();requestAnimationFrame(frame);
    // A read-only snapshot makes rendering and manual playtest reports reproducible.
    window.gameSnapshot=()=>({view,phase:round.phase,player:{x:round.player.x,z:round.player.z,angle:round.player.angle},hunter:{x:round.hunter.x,z:round.hunter.z,stunned:round.hunter.stunned},cats:round.cats.map(c=>({state:c.state,x:c.x,z:c.z,timer:c.timer,pickupCooldown:c.pickupCooldown})),food:round.food,foodCooldown:round.foodCooldown,captureTime:round.capture?.elapsed,remaining:round.remaining,heldCat:round.heldCat,scores:{...scores},routeLength:maze.route.length,drawCalls:world.renderer.info.render.calls});
  }catch(error){console.error(error);$('world-loading').innerHTML='<strong>The maze could not start.</strong><span>Use “Start Game.cmd” and open the local game address.</span><span>A browser with WebGL 2 support is required.</span>';$('play').innerHTML='<span>Reload to try again</span><b>↻</b>';$('play').disabled=false;$('play').onclick=()=>location.reload();}
}
async function selectLevel(id){
  if(!LEVELS[id]||switchingLevel)return;
  switchingLevel=true;$('play').disabled=true;document.querySelectorAll('[data-level]').forEach(b=>b.disabled=true);$('world-loading').classList.remove('hidden');
  try{
    const [response,presentation]=await Promise.all([fetch(`levels/${id}.json`),fetch(`levels/${id}-presentation.json`)]);
    if(!response.ok||!presentation.ok)throw new Error('Maze data could not be loaded.');
    const nextMaze=createMaze({...await response.json(),presentation:await presentation.json()}),oldWorld=world;
    const nextWorld=new World(canvas,nextMaze,oldWorld?.renderer);oldWorld?.dispose();world=nextWorld;maze=nextMaze;selectedLevel=id;
    round=newRound(maze,$('difficulty').value);aimAtRoute();aiRoute=[];aiStep=0;aiTimer=0;setView('home');
    const level=LEVELS[id];$('level-count').textContent=`${level.number} / 02`;$('home-expedition').textContent=$('hud-expedition').textContent=`EXPEDITION ${level.number}`;
    $('home-title').innerHTML=`${level.title}<span>↗</span>`;$('home-caption').innerHTML=level.caption;$('home-terrain').textContent=level.terrain;$('hud-title').textContent=level.name;
    canvas.setAttribute('aria-label',`3D ${level.name} maze. Use W and S to move, A and D to turn, E to pick up a cat, F to drop cat food, Space to shout, Shift to sprint.`);
    document.querySelectorAll('[data-level]').forEach(b=>{const selected=b.dataset.level===id;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
    $('home-duration').textContent=`${clock(round.remaining)} on the clock`;$('play').innerHTML='<span>Enter the maze</span><b>↗</b>';
  }catch(error){if(!world)throw error;console.error(error);notify('This maze could not load. Your current maze is still available.');}
  finally{switchingLevel=false;$('world-loading').classList.add('hidden');$('play').disabled=false;document.querySelectorAll('[data-level]').forEach(b=>b.disabled=false);}
}
init();
