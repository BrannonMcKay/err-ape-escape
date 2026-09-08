// Decoded duration of the supplied Taciturn_Eternity_2025_08_03.mp3.
// The game clock keeps running with music muted or unavailable.
export const TACITURN_DURATION=307.3828541666667;
export function advanceSoundtrackClock(round,seconds){
  if(round.phase!=='playing')return;
  round.elapsed=Math.min(round.duration,round.elapsed+Math.max(0,seconds));
  round.remaining=Math.max(0,round.duration-round.elapsed);
}
