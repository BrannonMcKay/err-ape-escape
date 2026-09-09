import {AudioCues,spatialMix,SOUND_RANGES,miniatureFootstepGain} from './audio-cues.js';
import {EFFECTS,synthesizeEffect} from './audio-synth.js';
import {createTinyFootstepBus,TINY_FOOTSTEP_PITCH} from './tiny-footstep-bus.js';

// Set a slot to one recording URL or an array of variations. Null keeps the synth.
// Resolve recordings from this module, e.g. new URL('../assets/cat-meow-01.wav',import.meta.url).href.
export const AUDIO_ASSETS={meow:null,purr:null,catRelease:null,playerStep:null,hunterStep:null,menace:null,taunt:null,scream:null,greeting:null,frustration:null};
export const MUSIC_ASSET=new URL('../assets/taciturn-eternity.mp3',import.meta.url).href;
export const MUSIC_CREDIT='Mimesis · Taciturn Eternity';

function renderMidi(data){
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./music-worker.js',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>{worker.terminate();if(data.error)reject(new Error(data.error));else resolve(data);};
    worker.onerror=()=>{worker.terminate();reject(new Error('The piano renderer could not start.'));};
    worker.postMessage(data,[data]);
  });
}

export class GameAudio{
  constructor({onChange=()=>{},random=Math.random,enabled=true}={}){
    this.onChange=onChange;this.random=random;this.cues=new AudioCues(random);
    this.enabled={effects:enabled,music:enabled};this.volume={effects:.8,music:.3};
    this.view='home';this.voices=new Set();this.buffers=new Map();this.recordings=new Map();
    this.miniatureStepGain=.85;
    this.musicOffset=0;this.defaultMusic={file:MUSIC_ASSET,name:'Taciturn Eternity',credit:MUSIC_CREDIT};this.musicLabel=MUSIC_CREDIT;this.musicStatus='Ready';this.context=null;
  }
  async unlock(){
    if(!this.context){
      const AudioContext=globalThis.AudioContext||globalThis.webkitAudioContext;
      if(!AudioContext)throw new Error('Audio is unavailable in this browser.');
      this.context=new AudioContext();const c=this.context;
      this.master=c.createDynamicsCompressor();this.master.threshold.value=-10;this.master.knee.value=10;this.master.ratio.value=6;
      this.master.connect(c.destination);this.buses={effects:c.createGain(),music:c.createGain()};
      for(const [name,bus] of Object.entries(this.buses)){bus.gain.value=this.enabled[name]?this.volume[name]:0;bus.connect(this.master);}
      this.tinyFootsteps=createTinyFootstepBus(c,c.destination,this.enabled.effects?this.volume.effects:0);
      this.loadRecordings();
    }
    await this.context.resume();
    if(this.context.state!=='running')throw new Error('Click a sound control to allow audio playback.');
  }
  async setEnabled(channel,enabled){
    this.enabled[channel]=enabled;this.updateBus(channel);
    if(!enabled){if(channel==='effects')this.stopEffects();else this.stopMusic();this.onChange();return;}
    try{
      await this.unlock();
      if(channel==='music'&&!this.musicBuffer)await this.loadMusic();
      this.updateBus(channel);this.syncMusic();this.onChange();
    }catch(error){
      this.enabled[channel]=false;this.updateBus(channel);this.onChange();throw error;
    }
  }
  async activate(){
    if(!this.enabled.music&&!this.enabled.effects)return;
    if(!this.activating)this.activating=(async()=>{await this.unlock();if(this.enabled.music&&!this.musicBuffer)await this.loadMusic();this.syncMusic();this.onChange();})().finally(()=>this.activating=null);
    return this.activating;
  }
  startRound(round=null){
    this.stopMusic();this.clockRound=round;this.roundEnded=false;this.fadeEnd=0;this.musicOffset=0;this.updateBus('music');
  }
  fadeMusicOut(){
    if(!this.context||!this.musicSource)return;
    const now=this.context.currentTime,gain=this.buses.music.gain;
    gain.cancelScheduledValues(now);gain.setValueAtTime(gain.value,now);gain.linearRampToValueAtTime(0,now+1.4);this.fadeEnd=now+1.4;
  }
  setVolume(channel,value){this.volume[channel]=Math.max(0,Math.min(1,Number(value)||0));this.updateBus(channel);}
  updateBus(channel){if(this.buses){
    const gain=this.buses[channel].gain,now=this.context.currentTime,volume=this.enabled[channel]&&!(channel==='music'&&this.roundEnded)?this.volume[channel]:0;
    gain.cancelScheduledValues(now);gain.setTargetAtTime(volume,now,.02);
    if(channel==='effects'&&this.tinyFootsteps){const tiny=this.tinyFootsteps.output.gain;tiny.cancelScheduledValues(now);tiny.setTargetAtTime(volume,now,.02);}
  }}
  setView(view){
    if(view!==this.view){
      this.view=view;if(view!=='playing')this.stopEffects();
      if(['capture','result'].includes(view)&&!this.roundEnded){this.roundEnded=true;this.fadeMusicOut();}
      this.syncMusic();
    }
  }
  setHidden(hidden){this.hidden=hidden;if(hidden)this.stopEffects();this.syncMusic();}
  stopEffects(){for(const voice of this.voices)this.stopVoice(voice);this.purr=null;this.cues.reset();if(this.speaking){globalThis.speechSynthesis?.cancel();this.speaking=false;}}
  speakToss(hunter){
    if(!this.enabled.effects||this.hidden||this.view!=='playing')return;
    this.effect('angryGirl');
    if(!globalThis.speechSynthesis||!globalThis.SpeechSynthesisUtterance){this.effect('taunt',hunter,this.clockRound.player);return;}
    globalThis.speechSynthesis.cancel();this.speaking=true;
    for(const [text,pitch,rate] of [[hunter.speech.text,1.85,1.3]]){
      const line=new SpeechSynthesisUtterance(text);line.pitch=pitch;line.rate=rate;line.volume=this.volume.effects;line.lang='en-US';
      // Prefer an installed voice, so the game does not depend on a speech service.
      const voice=speechSynthesis.getVoices().find(v=>v.localService&&v.lang.startsWith('en'));if(voice)line.voice=voice;
      speechSynthesis.speak(line);
    }
  }
  stopVoice(voice){
    if(voice.stopping)return;voice.stopping=true;
    const now=this.context.currentTime;voice.gain.gain.cancelScheduledValues(now);voice.gain.gain.setTargetAtTime(0,now,.008);
    voice.source.stop(now+.04);
  }
  async loadRecordings(){
    const c=this.context;
    for(const [kind,urls] of Object.entries(AUDIO_ASSETS)){
      if(!urls)continue;
      const results=await Promise.allSettled([urls].flat().map(async url=>{
        const response=await fetch(url);if(!response.ok)throw new Error(`Sound file could not load: ${url}`);
        return c.decodeAudioData(await response.arrayBuffer());
      }));
      this.recordings.set(kind,results.filter(r=>r.status==='fulfilled').map(r=>r.value));
      for(const r of results)if(r.status==='rejected')console.warn('Using synthesized sound fallback.',r.reason);
    }
  }
  effectBuffer(kind){
    const recordings=this.recordings.get(kind);
    if(recordings?.length)return recordings[Math.floor(this.random()*recordings.length)];
    if(!this.buffers.has(kind)){
      const c=this.context,samples=synthesizeEffect(kind,c.sampleRate,this.random),buffer=c.createBuffer(1,samples.length,c.sampleRate);
      buffer.copyToChannel(samples,0);this.buffers.set(kind,buffer);
    }
    return this.buffers.get(kind);
  }
  playBuffer(buffer,{kind='tone',source=null,gain=1,pan=0,loop=false,rate=1}={}){
    if(!this.enabled.effects||!this.context||this.context.state!=='running'||this.hidden||this.voices.size>=24)return null;
    const c=this.context,node=c.createBufferSource(),level=c.createGain(),panner=c.createStereoPanner();
    node.buffer=buffer;node.loop=loop;node.playbackRate.value=rate;level.gain.value=gain;panner.pan.value=pan;
    node.connect(level);level.connect(panner);panner.connect(kind==='hunterStep'&&source?.miniature?this.tinyFootsteps.input:this.buses.effects);
    const voice={source:node,gain:level,panner,actor:source,kind,baseGain:gain};this.voices.add(voice);
    node.onended=()=>{node.disconnect();level.disconnect();panner.disconnect();this.voices.delete(voice);};node.start();return voice;
  }
  effect(kind,source=null,listener=null){
    if(!this.enabled.effects||!this.context)return null;
    const mix=source&&listener?spatialMix(listener,source,SOUND_RANGES[kind]||20):{gain:1,pan:0};
    if(mix.gain<=0)return null;
    const tinyStep=kind==='hunterStep'&&source?.miniature,stepGain=tinyStep?this.miniatureStepGain*this.miniatureAudibility(source):1;
    if(stepGain<=0)return null;
    const voice=this.playBuffer(this.effectBuffer(kind),{kind,source,gain:EFFECTS[kind].gain*mix.gain*stepGain,pan:mix.pan,loop:kind==='purr',rate:kind==='purr'?1:(tinyStep?TINY_FOOTSTEP_PITCH:source?.miniature?1.8:1)*(.94+this.random()*.12)});
    if(voice)voice.baseGain=EFFECTS[kind].gain;
    return voice;
  }
  miniatureAudibility(actor){return this.cues.round?(this.cues.miniatureGains.get(actor.id)||0):1;}
  tone(frequency=440,duration=.12,type='sine',volume=.025){
    if(!this.enabled.effects||!this.context)return;
    const c=this.context,buffer=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate),data=buffer.getChannelData(0);let phase=0;
    for(let i=0;i<data.length;i++){
      const t=i/c.sampleRate,u=t/duration;phase+=Math.PI*2*frequency*(1-u*.3)/c.sampleRate;
      const sample=type==='triangle'?Math.asin(Math.sin(phase))*2/Math.PI:type==='sawtooth'?Math.sin(phase)+.3*Math.sin(phase*2):Math.sin(phase);
      data[i]=sample*Math.min(1,t/.005)*Math.exp(-u*5)*Math.min(1,(1-u)*30);
    }
    this.playBuffer(buffer,{gain:volume});
  }
  taunt(round,kind='taunt',hunter=round.hunter){
    // Trigger at the speech event, never by polling a bubble that remains visible.
    for(const voice of this.voices)if(['menace','taunt','frustration'].includes(voice.kind))this.stopVoice(voice);
    this.cues.menace=7+this.random()*5;
    return this.effect(kind,hunter,round.player);
  }
  releaseCat(cat,listener){
    if(this.purr){this.stopVoice(this.purr);this.purr=null;}
    return this.effect('catRelease',cat,listener);
  }
  update(round,dt){
    if(this.fadeEnd&&this.context.currentTime>=this.fadeEnd){this.fadeEnd=0;this.stopMusic();}
    if(this.clockRound&&this.view==='playing'&&!this.roundEnded){
      const position=this.musicOffset+(this.musicSource?this.context.currentTime-this.musicStart:0);
      if(this.musicSource&&(this.clockRound.elapsed>=this.musicBuffer.duration||Math.abs(position-this.clockRound.elapsed)>.2))this.stopMusic();
      this.syncMusic();
    }
    const active=this.enabled.effects&&this.context?.state==='running'&&this.view==='playing'&&!this.hidden;
    const cues=this.cues.update(round,dt,active);
    if(!active){if(this.purr){this.stopVoice(this.purr);this.purr=null;}return;}
    this.miniatureStepGain=miniatureFootstepGain(round,this.cues.nearestMiniatures);
    for(const event of cues.events)this.effect(event.kind,event.kind==='playerStep'?null:event.source,round.player);
    if(cues.purring&&!this.purr)this.purr=this.effect('purr');
    if(!cues.purring&&this.purr){this.stopVoice(this.purr);this.purr=null;}
    for(const voice of this.voices){
      if(!voice.actor||voice.stopping)continue;
      if(voice.kind==='meow'&&voice.actor.state!=='ground'){this.stopVoice(voice);continue;}
      const mix=spatialMix(round.player,voice.actor,SOUND_RANGES[voice.kind]||20);
      const stepGain=voice.kind==='hunterStep'&&voice.actor.miniature?this.miniatureStepGain*this.miniatureAudibility(voice.actor):1;
      voice.gain.gain.setTargetAtTime(voice.baseGain*mix.gain*stepGain,this.context.currentTime,.04);
      voice.panner.pan.setTargetAtTime(mix.pan,this.context.currentTime,.04);
    }
  }
  async loadMusic(){
    if(!this.musicPromise)this.musicPromise=(async()=>{
      this.musicStatus=`Loading ${this.defaultMusic.name}…`;this.onChange();
      const response=await fetch(this.defaultMusic.file);if(!response.ok)throw new Error(`${this.defaultMusic.name} could not load.`);
      this.musicBuffer=await this.context.decodeAudioData(await response.arrayBuffer());
      this.musicRoundDuration=this.defaultMusic.duration??this.musicBuffer.duration;
      this.retimeRound();
      this.musicStatus='Ready · original Mimesis recording';this.onChange();
    })().catch(error=>{this.musicPromise=null;this.musicStatus='Music could not load. Try again.';this.onChange();throw error;});
    return this.musicPromise;
  }
  syncMusic(){
    if(this.roundEnded){if(!this.fadeEnd||this.hidden||this.view==='paused')this.stopMusic();return;}
    const play=this.enabled.music&&this.context?.state==='running'&&this.view==='playing'&&!this.hidden;
    if(!play){this.stopMusic();return;}
    if(this.musicSource||!this.musicBuffer)return;
    this.musicOffset=Math.min(this.musicBuffer.duration,this.clockRound?.elapsed??this.musicOffset);
    if(this.musicOffset>=this.musicBuffer.duration)return;
    const c=this.context,node=c.createBufferSource();node.buffer=this.musicBuffer;node.loop=false;node.connect(this.buses.music);
    this.musicStart=c.currentTime;this.musicSource=node;node.onended=()=>{node.disconnect();if(this.musicSource===node){this.musicOffset=this.musicBuffer.duration;this.musicSource=null;}};node.start(0,this.musicOffset);
  }
  stopMusic(){
    this.fadeEnd=0;
    if(!this.musicSource)return;
    this.musicOffset=Math.min(this.musicBuffer.duration,this.musicOffset+this.context.currentTime-this.musicStart);
    const source=this.musicSource;this.musicSource=null;source.stop();
  }
  // Local recordings replace the music for this page session; no upload takes place.
  get roundDuration(){return this.musicRoundDuration??this.musicBuffer?.duration;}
  retimeRound(){if(this.clockRound&&!this.roundEnded){this.clockRound.duration=this.roundDuration;this.clockRound.remaining=Math.max(0,this.clockRound.duration-this.clockRound.elapsed);}}
  async useMusicFile(file){
    await this.unlock();if(this.musicPromise)await this.musicPromise.catch(()=>{});
    const data=await file.arrayBuffer();let buffer;
    if(/\.midi?$/i.test(file.name)){
      const rendered=await renderMidi(data);buffer=this.context.createBuffer(2,rendered.channels[0].length,rendered.sampleRate);
      rendered.channels.forEach((channel,i)=>buffer.copyToChannel(channel,i));
    }else buffer=await this.context.decodeAudioData(data);
    this.stopMusic();this.musicBuffer=buffer;this.musicRoundDuration=buffer.duration;this.musicOffset=0;this.musicLabel=file.name;this.musicStatus='Local track · this session';
    this.retimeRound();
    this.enabled.music=true;this.updateBus('music');this.syncMusic();this.onChange();
  }
  async restoreMusic(){
    await this.unlock();if(this.musicPromise)await this.musicPromise.catch(()=>{});this.stopMusic();this.musicBuffer=null;this.musicOffset=0;this.musicPromise=null;this.musicLabel=this.defaultMusic.credit;
    await this.loadMusic();this.enabled.music=true;this.updateBus('music');this.syncMusic();this.onChange();
  }
  async setDefaultMusic(track){
    if(this.musicPromise)await this.musicPromise.catch(()=>{});
    this.stopMusic();this.clockRound=null;this.defaultMusic=track||{file:MUSIC_ASSET,name:'Taciturn Eternity',credit:MUSIC_CREDIT};
    this.musicBuffer=null;this.musicRoundDuration=null;this.musicPromise=null;this.musicOffset=0;this.musicLabel=this.defaultMusic.credit;this.musicStatus='Ready';this.onChange();
    if(this.context&&this.enabled.music)await this.loadMusic();
  }
  snapshot(){return {context:this.context?.state||'not started',effects:this.enabled.effects,music:this.enabled.music,voices:this.voices.size,purring:!!this.purr,musicPlaying:!!this.musicSource,musicFading:!!this.fadeEnd,musicGain:this.buses?.music.gain.value||0,musicPosition:this.musicBuffer?Math.min(this.musicBuffer.duration,this.musicOffset+(this.musicSource?this.context.currentTime-this.musicStart:0)):0,musicDuration:this.musicBuffer?.duration||0,musicStatus:this.musicStatus};}
}
