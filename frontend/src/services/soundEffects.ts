let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  audioContext ??= new AudioContext();
  return audioContext;
}

/**
 * Plays one short tone: a sine oscillator ramped from `startFreq` to `endFreq` (equal values
 * produce a flat single-pitch blip) with a short gain envelope to avoid the click of a hard
 * on/off. `startAt` delays the tone relative to now, in seconds — used to sequence two tones
 * into a chime. Swallows any error (autoplay-policy rejection, no AudioContext support): a
 * missed notification sound is harmless, a thrown error reaching voiceClient's call sites is not.
 */
function playTone(startFreq: number, endFreq: number, durationMs: number, startAt = 0): void {
  try {
    const ctx = getAudioContext();
    ctx.resume().catch(() => {});

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);

    const start = ctx.currentTime + startAt;
    const end = start + durationMs / 1000;
    oscillator.frequency.setValueAtTime(startFreq, start);
    oscillator.frequency.linearRampToValueAtTime(endFreq, end);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.15, start + 0.01);
    gain.gain.linearRampToValueAtTime(0, end);

    oscillator.start(start);
    oscillator.stop(end);
  } catch {
    // See doc comment above.
  }
}

/** The local user just connected to a voice channel. */
export function playSelfJoin(): void {
  playTone(440, 440, 90);
  playTone(660, 660, 110, 0.09);
}

/** The local user just left a voice channel (not a channel-switch teardown). */
export function playSelfLeave(): void {
  playTone(660, 660, 90);
  playTone(440, 440, 110, 0.09);
}

/** A remote participant joined the channel the local user is connected to. */
export function playParticipantJoined(): void {
  playTone(880, 880, 90);
}

/** A remote participant left the channel the local user is connected to. */
export function playParticipantLeft(): void {
  playTone(330, 330, 90);
}
