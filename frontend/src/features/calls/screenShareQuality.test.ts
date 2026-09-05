import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getLastScreenShareAudioPreference,
  getLastScreenShareQuality,
  setLastScreenShareAudioPreference,
  setLastScreenShareQuality,
} from './screenShareQuality';

describe('screenShareQuality', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to fhd when nothing is stored', () => {
    expect(getLastScreenShareQuality()).toBe('fhd');
  });

  it('defaults to fhd when an invalid value is stored', () => {
    localStorage.setItem('concord:screenShareQuality', 'garbage');

    expect(getLastScreenShareQuality()).toBe('fhd');
  });

  it('returns the stored quality when it is hd', () => {
    localStorage.setItem('concord:screenShareQuality', 'hd');

    expect(getLastScreenShareQuality()).toBe('hd');
  });

  it('returns the stored quality when it is fhd', () => {
    localStorage.setItem('concord:screenShareQuality', 'fhd');

    expect(getLastScreenShareQuality()).toBe('fhd');
  });

  it('defaults to fhd when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(getLastScreenShareQuality()).toBe('fhd');
  });

  it('persists the chosen quality', () => {
    setLastScreenShareQuality('hd');

    expect(localStorage.getItem('concord:screenShareQuality')).toBe('hd');
  });

  it('does not throw when localStorage.setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => setLastScreenShareQuality('hd')).not.toThrow();
  });

  it('defaults the audio preference to false when nothing is stored', () => {
    expect(getLastScreenShareAudioPreference()).toBe(false);
  });

  it('defaults the audio preference to false when an unrecognized value is stored', () => {
    localStorage.setItem('concord:screenShareAudio', 'garbage');

    expect(getLastScreenShareAudioPreference()).toBe(false);
  });

  it('returns true only when the stored audio preference is exactly "true"', () => {
    localStorage.setItem('concord:screenShareAudio', 'true');

    expect(getLastScreenShareAudioPreference()).toBe(true);
  });

  it('returns false when the stored audio preference is "false"', () => {
    localStorage.setItem('concord:screenShareAudio', 'false');

    expect(getLastScreenShareAudioPreference()).toBe(false);
  });

  it('defaults the audio preference to false when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(getLastScreenShareAudioPreference()).toBe(false);
  });

  it('persists the chosen audio preference as a string', () => {
    setLastScreenShareAudioPreference(true);

    expect(localStorage.getItem('concord:screenShareAudio')).toBe('true');
  });

  it('does not throw when persisting the audio preference and localStorage.setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => setLastScreenShareAudioPreference(true)).not.toThrow();
  });
});
