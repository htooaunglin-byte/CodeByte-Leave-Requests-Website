/**
 * Audio Utility Module
 * Plays subtle synthesized Web Audio sound effects without requiring external sound files.
 */

export function playTaskCompletionDing() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // High quality sine wave chime tone
    osc.type = "sine";
    
    // Quick ascending pitch glide: C6 (1046.5Hz) -> E6 (1318.5Hz) for a sweet, clean "ding"
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(1046.5, now);
    osc.frequency.exponentialRampToValueAtTime(1318.5, now + 0.06);

    // Smooth envelope: quick fade-in, exponential decay
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.012); // Soft, non-intrusive volume
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.3);

    // Clean up audio context
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 350);
  } catch {
    // Fail gracefully if audio context is unavailable or blocked by browser policy
  }
}
