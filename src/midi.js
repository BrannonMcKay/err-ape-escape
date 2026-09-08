// Standard MIDI formats 0/1 with PPQN timing. Metadata is data, never executable text.
export function parseMidi(input){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
  const data=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let pos=0;
  function need(n){if(pos+n>bytes.length)throw new Error('Truncated MIDI file.');}
  function byte(){need(1);return bytes[pos++];}
  function u16(){need(2);const n=data.getUint16(pos);pos+=2;return n;}
  function u32(){need(4);const n=data.getUint32(pos);pos+=4;return n;}
  function tag(){need(4);return String.fromCharCode(...bytes.subarray(pos,pos+=4));}
  function vlq(){let n=0;for(let i=0;i<4;i++){const b=byte();n=n*128+(b&127);if(!(b&128))return n;}throw new Error('Invalid MIDI delta time.');}
  if(tag()!=='MThd')throw new Error('This is not a Standard MIDI file.');
  const header=u32(),format=u16(),tracks=u16(),ppqn=u16();
  if(header<6||format>1||!tracks||!ppqn||(ppqn&0x8000))throw new Error('Use a format 0/1 MIDI file with beat-based timing.');
  need(header-6);pos+=header-6;const events=[];let lastTick=0;
  for(let track=0;track<tracks;track++){
    if(tag()!=='MTrk')throw new Error('Missing MIDI track.');
    const length=u32();need(length);const end=pos+length;let tick=0,running=0;
    while(pos<end){
      tick+=vlq();lastTick=Math.max(lastTick,tick);let status=byte();
      if(status<128){if(!running)throw new Error('Invalid MIDI running status.');pos--;status=running;}
      if(status===255){
        running=0;const kind=byte(),n=vlq();need(n);
        if(kind===81&&n===3){const tempo=bytes[pos]*65536+bytes[pos+1]*256+bytes[pos+2];if(!tempo)throw new Error('Invalid MIDI tempo.');events.push({tick,tempo});}
        pos+=n;
      }else if(status===240||status===247){running=0;const n=vlq();need(n);pos+=n;}
      else{
        if(status>=240)throw new Error('Unsupported MIDI system event.');
        running=status;const type=status>>4,channel=status&15,a=byte(),b=type===12||type===13?0:byte();
        if(a>127||b>127)throw new Error('Invalid MIDI event data.');
        events.push({tick,type,channel,a,b});
      }
      if(pos>end)throw new Error('MIDI event crosses a track boundary.');
    }
  }
  events.sort((a,b)=>a.tick-b.tick);
  const channels=Array.from({length:16},()=>({volume:100/127,expression:1,pan:0,program:0,sustain:false}));
  const active=new Map(),released=[],notes=[];let tick=0,seconds=0,tempo=500000;
  const endNote=(note)=>{note.duration=Math.max(.01,seconds-note.time);notes.push(note);};
  for(const e of events){
    seconds+=(e.tick-tick)*tempo/1e6/ppqn;tick=e.tick;
    if(e.tempo){tempo=e.tempo;continue;}
    const c=channels[e.channel],key=e.channel*128+e.a;
    if(e.type===12)c.program=e.a;
    if(e.type===11){
      if(e.a===7)c.volume=e.b/127;if(e.a===11)c.expression=e.b/127;if(e.a===10)c.pan=(e.b-64)/64;
      if(e.a===64){c.sustain=e.b>=64;if(!c.sustain){for(let i=released.length-1;i>=0;i--)if(released[i].channel===e.channel)endNote(released.splice(i,1)[0]);}}
    }
    if(e.type===9&&e.b){
      const list=active.get(key)||[];
      list.push({time:seconds,pitch:e.a,velocity:e.b/127*c.volume*c.expression,pan:c.pan,program:c.program,channel:e.channel});active.set(key,list);
    }else if(e.type===8||(e.type===9&&!e.b)){
      const note=active.get(key)?.shift();if(note){if(c.sustain)released.push(note);else endNote(note);}
    }
  }
  seconds+=(lastTick-tick)*tempo/1e6/ppqn;
  for(const list of active.values())for(const note of list)endNote(note);
  for(const note of released)endNote(note);
  notes.sort((a,b)=>a.time-b.time);
  if(!notes.length)throw new Error('This MIDI file has no notes.');
  return {format,tracks,ppqn,duration:seconds,notes};
}

// A small, warm piano approximation for Christel's piano MIDI. No soundfont download.
// Note timing/velocity/pan are preserved; this is not a full General MIDI instrument bank.
export function renderPiano(song,sampleRate=24000){
  const duration=song.duration+.65;
  if(!Number.isFinite(duration)||duration>600)throw new Error('Use a music clip shorter than ten minutes.');
  const length=Math.ceil(duration*sampleRate),left=new Float32Array(length),right=new Float32Array(length);
  for(const note of song.notes){
    const frequency=440*2**((note.pitch-69)/12),start=Math.round(note.time*sampleRate);
    const end=Math.min(length,start+Math.ceil((Math.min(note.duration,12)+.6)*sampleRate));
    const pan=Math.max(-.85,Math.min(.85,note.pan+(note.pitch-60)*.006));
    const l=Math.cos((pan+1)*Math.PI/4),r=Math.sin((pan+1)*Math.PI/4);
    for(let i=start;i<end;i++){
      const t=(i-start)/sampleRate,phase=2*Math.PI*frequency*t;
      const attack=Math.min(1,t/.006),decay=Math.exp(-t*(1.3+frequency/1600));
      const release=t>note.duration?Math.exp(-(t-note.duration)*12):1;
      const tone=Math.sin(phase)+.32*Math.sin(phase*2)*Math.exp(-t*2)+.12*Math.sin(phase*3)*Math.exp(-t*4);
      const value=tone*attack*decay*release*note.velocity*.2;
      left[i]+=value*l;right[i]+=value*r;
    }
  }
  let peak=0;for(let i=0;i<length;i++)peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));
  const gain=.8/Math.max(.8,peak);for(let i=0;i<length;i++){left[i]*=gain;right[i]*=gain;}
  return {channels:[left,right],sampleRate,duration};
}
