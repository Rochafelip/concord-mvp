import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getNoiseSuppressionPreference, setNoiseSuppressionPreference } from './noiseSuppressionPreference';

describe('noiseSuppressionPreference', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to enabled when nothing has been stored yet', () => {
    expect(getNoiseSuppressionPreference()).toBe(true);
  });

  it('returns false after being set to false', () => {
    setNoiseSuppressionPreference(false);
    expect(getNoiseSuppressionPreference()).toBe(false);
  });

  it('returns true after being set to false then back to true', () => {
    setNoiseSuppressionPreference(false);
    setNoiseSuppressionPreference(true);
    expect(getNoiseSuppressionPreference()).toBe(true);
  });

  it('persists across separate reads', () => {
    setNoiseSuppressionPreference(false);
    expect(getNoiseSuppressionPreference()).toBe(false);
    expect(getNoiseSuppressionPreference()).toBe(false);
  });

  it('defaults to enabled when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(getNoiseSuppressionPreference()).toBe(true);
  });

  it('does not throw when localStorage.setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => setNoiseSuppressionPreference(false)).not.toThrow();
  });
});
