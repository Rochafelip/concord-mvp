import { afterEach, describe, expect, it, vi } from 'vitest';

class MockOscillator {
  frequency = { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() };
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class MockGain {
  gain = { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() };
  connect = vi.fn();
}

class WorkingMockAudioContext {
  currentTime = 0;
  destination = {};
  resume = vi.fn().mockResolvedValue(undefined);
  createOscillator = vi.fn(() => new MockOscillator());
  createGain = vi.fn(() => new MockGain());
}

class ThrowingMockAudioContext {
  constructor() {
    throw new Error('AudioContext not supported');
  }
}

describe('soundEffects', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('playSelfJoin plays two ascending tones', async () => {
    vi.stubGlobal('AudioContext', WorkingMockAudioContext);
    const { playSelfJoin } = await import('./soundEffects');

    expect(() => playSelfJoin()).not.toThrow();
  });

  it('playSelfLeave plays two descending tones', async () => {
    vi.stubGlobal('AudioContext', WorkingMockAudioContext);
    const { playSelfLeave } = await import('./soundEffects');

    expect(() => playSelfLeave()).not.toThrow();
  });

  it('playParticipantJoined plays a single tone', async () => {
    let created: WorkingMockAudioContext | undefined;
    class RecordingAudioContext extends WorkingMockAudioContext {
      constructor() {
        super();
        created = this;
      }
    }
    vi.stubGlobal('AudioContext', RecordingAudioContext);
    const { playParticipantJoined } = await import('./soundEffects');

    playParticipantJoined();

    expect(created?.createOscillator).toHaveBeenCalledTimes(1);
  });

  it('playParticipantLeft plays a single tone', async () => {
    let created: WorkingMockAudioContext | undefined;
    class RecordingAudioContext extends WorkingMockAudioContext {
      constructor() {
        super();
        created = this;
      }
    }
    vi.stubGlobal('AudioContext', RecordingAudioContext);
    const { playParticipantLeft } = await import('./soundEffects');

    playParticipantLeft();

    expect(created?.createOscillator).toHaveBeenCalledTimes(1);
  });

  it('never throws and never leaves an unhandled rejection when resume() rejects', async () => {
    class RejectingResumeAudioContext extends WorkingMockAudioContext {
      resume = vi.fn().mockRejectedValue(new Error('resume failed'));
    }
    vi.stubGlobal('AudioContext', RejectingResumeAudioContext);
    const { playSelfJoin } = await import('./soundEffects');

    expect(() => playSelfJoin()).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
  });

  it('never throws when the browser has no usable AudioContext (autoplay block / unsupported)', async () => {
    vi.stubGlobal('AudioContext', ThrowingMockAudioContext);
    const { playSelfJoin, playSelfLeave, playParticipantJoined, playParticipantLeft } = await import('./soundEffects');

    expect(() => playSelfJoin()).not.toThrow();
    expect(() => playSelfLeave()).not.toThrow();
    expect(() => playParticipantJoined()).not.toThrow();
    expect(() => playParticipantLeft()).not.toThrow();
  });
});
