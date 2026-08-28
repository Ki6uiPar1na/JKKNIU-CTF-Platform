let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

export function playSuccessSound() {
  try {
    const ctx = getAudioCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = 'sine';
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    o.frequency.setValueAtTime(523.25, ctx.currentTime);
    o.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
    o.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.6);
  } catch { /* audio not supported */ }
}

export function playNotificationSound() {
  try {
    const ctx = getAudioCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = 'triangle';
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.setValueAtTime(1108.73, ctx.currentTime + 0.15);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.4);
  } catch { /* audio not supported */ }
}
