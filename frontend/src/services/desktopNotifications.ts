interface NotifyOptions {
  title: string;
  body: string;
  onClick: () => void;
}

function notificationCtor(): typeof Notification | undefined {
  return (globalThis as unknown as { Notification?: typeof Notification }).Notification;
}

export function requestPermission(): void {
  const ctor = notificationCtor();
  if (ctor && ctor.permission === 'default') {
    void ctor.requestPermission();
  }
}

export function notify({ title, body, onClick }: NotifyOptions): void {
  const ctor = notificationCtor();
  if (!ctor || ctor.permission !== 'granted') return;
  try {
    const notification = new ctor(title, { body });
    notification.onclick = () => {
      window.focus();
      onClick();
      notification.close();
    };
  } catch {
    // Some browsers throw when constructing Notification outside a user-gesture context.
  }
}

/** A short two-tone chime synthesized with the Web Audio API — no bundled audio asset needed. */
export function playChime(): void {
  const AudioContextCtor = (
    globalThis as unknown as { AudioContext?: typeof AudioContext }
  ).AudioContext;
  if (!AudioContextCtor) return;
  try {
    const context = new AudioContextCtor();
    const now = context.currentTime;
    [880, 1320].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      gain.connect(context.destination);
      const start = now + index * 0.09;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.15, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
      oscillator.start(start);
      oscillator.stop(start + 0.13);
    });
    window.setTimeout(() => context.close(), 300);
  } catch {
    // Audio unavailable (autoplay policy, unsupported browser) — sound is a nice-to-have.
  }
}
