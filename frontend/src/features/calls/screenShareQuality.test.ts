import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLastScreenShareQuality, setLastScreenShareQuality } from './screenShareQuality';

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
});
