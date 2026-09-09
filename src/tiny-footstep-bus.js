// Only tiny footsteps use this channel. It joins the output after the music's
// compressor, so a crowd cannot reduce the song's gain.
export const TINY_FOOTSTEP_PITCH=1.3;
export const TINY_FOOTSTEP_CEILING=.12;
export function createTinyFootstepBus(context,destination,volume){
  const input=context.createBiquadFilter();input.type='lowpass';input.frequency.value=2400;input.Q.value=.5;
  const compressor=context.createDynamicsCompressor();
  compressor.threshold.value=-24;compressor.knee.value=8;compressor.ratio.value=12;compressor.attack.value=.002;compressor.release.value=.12;
  // Bound even a simultaneous burst before compression has time to react.
  const ceiling=context.createWaveShaper(),curve=new Float32Array(4097);
  for(let i=0;i<curve.length;i++){const x=i/(curve.length-1)*2-1;curve[i]=TINY_FOOTSTEP_CEILING*Math.tanh(x/TINY_FOOTSTEP_CEILING);}
  ceiling.curve=curve;
  const output=context.createGain();output.gain.value=volume;
  input.connect(compressor);compressor.connect(ceiling);ceiling.connect(output);output.connect(destination);
  return {input,compressor,ceiling,output};
}
