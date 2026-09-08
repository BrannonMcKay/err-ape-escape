// Set faceCamera to false to restore the original body-facing head.
export const STICKMAN_TUNING=Object.freeze({
  faceCamera:true,
  rageAt:210,
  rageSpeedMultiplier:1.25,
  calmFace:0xfff8e8,
  rageFace:0xe3d8ef,
});

export const isStickmanEnraged=round=>(round.elapsed||0)>=STICKMAN_TUNING.rageAt;
// Derived from active play time, so the boost never stacks and resets on replay.
export const stickmanSpeedMultiplier=round=>isStickmanEnraged(round)?STICKMAN_TUNING.rageSpeedMultiplier:1;
