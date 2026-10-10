"use client";

/** Sound + vibration + (only if already granted) a browser notification. Never asks for permission. */
export function fireReadyAlert(token: number | null) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      const ctx = new Ctx();
      [0, 0.35, 0.7].forEach((t) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.25, ctx.currentTime + t);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + t);
        osc.stop(ctx.currentTime + t + 0.3);
      });
      setTimeout(() => ctx.close().catch(() => {}), 1500);
    }
  } catch {
    /* audio blocked */
  }
  try {
    navigator.vibrate?.([300, 120, 300, 120, 300]);
  } catch {
    /* no vibration */
  }
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Your order is ready", { body: token ? `Token ${token}: collect it at the counter.` : undefined });
    }
  } catch {
    /* notifications unavailable */
  }
}
