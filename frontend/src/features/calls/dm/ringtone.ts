function beep(context: AudioContext): void {
  const now = context.currentTime;
  [660, 880].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    gain.connect(context.destination);
    const start = now + index * 0.15;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.2, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);
    oscillator.start(start);
    oscillator.stop(start + 0.26);
  });
}

let ringInterval: ReturnType<typeof setInterval> | null = null;
let ringContext: AudioContext | null = null;

/**
 * Loops a short two-tone ring, synthesized with the Web Audio API — same no-bundled-asset
 * approach as services/desktopNotifications.ts's chime. Call stopRingtone() to end it
 * (IncomingCallModal does so on unmount/resolution).
 */
export function playRingtone(): void {
  const AudioContextCtor = (globalThis as unknown as { AudioContext?: typeof AudioContext }).AudioContext;
  if (!AudioContextCtor) return;
  try {
    ringContext = new AudioContextCtor();
    beep(ringContext);
    ringInterval = setInterval(() => {
      if (ringContext) beep(ringContext);
    }, 1500);
  } catch {
    // Audio unavailable (autoplay policy, unsupported browser) — the modal still shows.
  }
}

export function stopRingtone(): void {
  if (ringInterval != null) {
    clearInterval(ringInterval);
    ringInterval = null;
  }
  if (ringContext) {
    ringContext.close().catch(() => {});
    ringContext = null;
  }
}
