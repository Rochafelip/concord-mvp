import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createdOscillators: MockOscillator[] = [];
const createdContexts: WorkingMockAudioContext[] = [];

class MockOscillator {
  frequency = { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() };
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
  constructor() {
    createdOscillators.push(this);
  }
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
  constructor() {
    createdContexts.push(this);
  }
}

class ThrowingMockAudioContext {
  constructor() {
    throw new Error('AudioContext not supported');
  }
}

describe('soundEffects', () => {
  beforeEach(() => {
    createdOscillators.length = 0;
    createdContexts.length = 0;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('playSelfJoin plays two ascending tones', async () => {
    vi.stubGlobal('AudioContext', WorkingMockAudioContext);
    const { playSelfJoin } = await import('./soundEffects');

    expect(() => playSelfJoin()).not.toThrow();

    expect(createdOscillators).toHaveLength(2);
    expect(createdOscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(440, expect.any(Number));
    expect(createdOscillators[1].frequency.setValueAtTime).toHaveBeenCalledWith(660, expect.any(Number));
  });

  it('playSelfLeave plays two descending tones', async () => {
    vi.stubGlobal('AudioContext', WorkingMockAudioContext);
    const { playSelfLeave } = await import('./soundEffects');

    expect(() => playSelfLeave()).not.toThrow();

    expect(createdOscillators).toHaveLength(2);
    expect(createdOscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(660, expect.any(Number));
    expect(createdOscillators[1].frequency.setValueAtTime).toHaveBeenCalledWith(440, expect.any(Number));
  });

  it('playParticipantJoined plays a single tone', async () => {
    vi.stubGlobal('AudioContext', WorkingMockAudioContext);
    const { playParticipantJoined } = await import('./soundEffects');

    playParticipantJoined();

    const created = createdContexts.at(-1);
    expect(created?.createOscillator).toHaveBeenCalledTimes(1);
  });

  it('playParticipantLeft plays a single tone', async () => {
    vi.stubGlobal('AudioContext', WorkingMockAudioContext);
    const { playParticipantLeft } = await import('./soundEffects');

    playParticipantLeft();

    const created = createdContexts.at(-1);
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
