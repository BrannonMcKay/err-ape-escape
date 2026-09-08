// Idle performance is visual only: it never changes position, steering, or cat timers.
export const IDLE_DELAY = 1;
const smooth = (value, start, end) => {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
};

export function tickRunnerIdle(round, dt, movementInput = false) {
  if (round.phase !== 'playing') return;
  const p = round.player;
  p.idleSeconds = p.moving || movementInput ? 0 : (p.idleSeconds || 0) + Math.max(0, dt);
}

export function idlePerformance(seconds, holding, reducedMotion = false) {
  const elapsed = Math.max(0, (seconds || 0) - IDLE_DELAY);
  if (!elapsed) return { mode: 'rest', blend: 0, yaw: 0, beat: 0, twirl: 0 };
  const blend = smooth(elapsed, 0, .4);
  if (holding) return { mode: 'cuddle', blend, yaw: Math.PI, beat: elapsed * 2.4, twirl: 0 };
  // Turn to show her face, wave, spin once, then linger facing the camera again.
  const dance = Math.max(0, elapsed - .8), cycle = dance % 5.4;
  const twirl = reducedMotion ? 0 : smooth(cycle, 1.3, 3.2);
  const turns = reducedMotion ? 0 : Math.floor(dance / 5.4) + twirl;
  return { mode: 'dance', blend, yaw: Math.PI * smooth(elapsed, 0, .8) + Math.PI * 2 * turns,
    beat: elapsed * (reducedMotion ? 2 : 4.6), twirl: Math.sin(twirl * Math.PI) };
}
