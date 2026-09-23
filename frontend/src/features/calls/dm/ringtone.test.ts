import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playRingtone, stopRingtone } from './ringtone';

describe('ringtone', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    delete (globalThis as unknown as { AudioContext?: unknown }).AudioContext;
    vi.useRealTimers();
  });

  it('does not throw when the browser has no AudioContext', () => {
    expect(() => playRingtone()).not.toThrow();
    expect(() => stopRingtone()).not.toThrow();
  });

  it('starts an oscillator through AudioContext when it is available, and loops it', () => {
    const oscillator = { frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
    const gain = {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    };
    const close = vi.fn().mockResolvedValue(undefined);
    const audioContextCtor = vi.fn().mockImplementation(function AudioContextMock() {
      return {
        currentTime: 0,
        createOscillator: () => oscillator,
        createGain: () => gain,
        destination: {},
        close,
      };
    });
    (globalThis as unknown as { AudioContext: unknown }).AudioContext = audioContextCtor;

    playRingtone();

    expect(audioContextCtor).toHaveBeenCalledTimes(1);
    expect(oscillator.start).toHaveBeenCalled();

    const callsBeforeLoop = oscillator.start.mock.calls.length;
    vi.advanceTimersByTime(1500);
    expect(oscillator.start.mock.calls.length).toBeGreaterThan(callsBeforeLoop);

    stopRingtone();
    expect(close).toHaveBeenCalled();

    // The interval was cleared — advancing time further doesn't ring again.
    const callsAfterStop = oscillator.start.mock.calls.length;
    vi.advanceTimersByTime(3000);
    expect(oscillator.start.mock.calls.length).toBe(callsAfterStop);
  });

  it('stopRingtone is safe to call when nothing is playing', () => {
    expect(() => stopRingtone()).not.toThrow();
  });
});
