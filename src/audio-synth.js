const TAU=Math.PI*2;
export const EFFECTS={
  meow:{duration:.85,gain:.42},purr:{duration:2.4,gain:.38},catRelease:{duration:.75,gain:.5},
  playerStep:{duration:.12,gain:.1},hunterStep:{duration:.23,gain:.72},
  menace:{duration:1.45,gain:.38},taunt:{duration:.95,gain:.5},scream:{duration:.85,gain:.48},greeting:{duration:.65,gain:.4},
  frustration:{duration:1.05,gain:.5},
};

// Code-generated placeholders. Replaced by recordings through AUDIO_ASSETS in audio.js.
export function synthesizeEffect(kind,sampleRate,random=Math.random){
  const definition=EFFECTS[kind];if(!definition)throw new Error(`Unknown sound: ${kind}`);
  const samples=new Float32Array(Math.ceil(definition.duration*sampleRate));
  let phase=0,lowNoise=0;
  for(let i=0;i<samples.length;i++){
    const t=i/sampleRate,u=t/definition.duration,noise=random()*2-1;
    lowNoise=lowNoise*.94+noise*.06;let value=0;
    if(kind==='meow'){
      const f=t<.16?490+t*2000:810*Math.exp(-(t-.16)*1.65);
      phase+=TAU*f/sampleRate;
      const vibrato=.06*Math.sin(TAU*7*t),mouth=.5+.5*Math.sin(Math.PI*u);
      value=(Math.sin(phase+vibrato)+.4*mouth*Math.sin(phase*2)+.2*Math.sin(phase*3))*.28*Math.sin(Math.PI*u)**1.1;
    }else if(kind==='catRelease'){
      const f=230+210*Math.sin(Math.PI*u);
      phase+=TAU*(f+Math.sin(TAU*32*t)*22)/sampleRate;
      const growl=(Math.sin(phase)+.45*Math.sin(phase*2)+.3*Math.sin(phase*3))*.25;
      const hiss=noise*.17*Math.max(0,(u-.5)*2);
      value=(growl*(1-u*.7)+hiss)*Math.sin(Math.PI*u)**.7;
    }else if(kind==='purr'){
      const breath=.55+.45*Math.sin(TAU*t/2.4)**2,pulse=(.5+.5*Math.sin(TAU*30*t))**2;
      value=(Math.sin(TAU*60*t)*.24+lowNoise*.7)*(.2+.8*pulse)*breath;
    }else if(kind==='greeting'){
      const syllable=t%.32,envelope=Math.sin(Math.PI*Math.min(1,syllable/.3))**.6;
      phase+=TAU*(420+u*330+25*Math.sin(TAU*6*t))/sampleRate;
      value=(Math.sin(phase)+.3*Math.sin(phase*2)+.1*Math.sin(phase*3))*.28*envelope*Math.min(1,(1-u)*12);
    }else if(kind==='scream'){
      // A bright, breathy cartoon “Aaah!”; a placeholder for Christel's own recording.
      const f=470+135*Math.sin(Math.PI*u)+18*Math.sin(TAU*6.5*t);
      phase+=TAU*f/sampleRate;
      const vowel=Math.sin(phase)+.5*Math.sin(phase*2)+.22*Math.sin(phase*3);
      const envelope=Math.sin(Math.PI*u)**.45;
      value=(vowel*.27+lowNoise*.18)*envelope;
    }else if(kind==='taunt'){
      // A ridiculous rising “WAH!” followed by a falling “yow”, with pitch variation per play.
      const f=u<.32?170+u*750:410-(u-.32)*440;
      phase+=TAU*(f+Math.sin(TAU*9*t)*10)/sampleRate;
      const mouth=.55+.45*Math.sin(Math.PI*u),envelope=Math.sin(Math.PI*u)**.6;
      value=(Math.sin(phase)+.5*mouth*Math.sin(phase*2)+.25*Math.sin(phase*3))*.28*envelope;
    }else if(kind==='frustration'){
      // A comically descending "urrrgh!" with a breathy exasperated ending.
      phase+=TAU*(230-u*140+18*Math.sin(TAU*26*t))/sampleRate;
      value=((Math.sin(phase)+.6*Math.sin(phase*2)+.2*Math.sin(phase*3))*.26+lowNoise*u*.6)*Math.sin(Math.PI*u)**.7;
    }else if(kind==='menace'){
      const syllable=t%.43,envelope=Math.sin(Math.PI*Math.min(1,syllable/.34))**2;
      phase+=TAU*(120+65*Math.sin(syllable/.34*Math.PI)+12*Math.sin(TAU*5*t))/sampleRate;
      value=(Math.sin(phase)+.45*Math.sin(phase*2)+.3*Math.sin(phase*4))*.24*envelope*Math.min(1,(1-u)*8);
    }else{
      const heavy=kind==='hunterStep',f=heavy?62:130;
      phase+=TAU*f*Math.exp(-t*3)/sampleRate;
      value=(Math.sin(phase)*Math.exp(-t*(heavy?21:48))*.55+lowNoise*Math.exp(-t*30)*.8+noise*Math.exp(-t*75)*.15);
    }
    // Fade the ends, including the purr seam, to prevent clicks.
    const fade=Math.min(1,t/.004,(definition.duration-t)/.012);
    samples[i]=value*Math.max(0,fade);
  }
  return samples;
}
