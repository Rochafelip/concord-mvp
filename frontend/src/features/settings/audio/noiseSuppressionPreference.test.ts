import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getNoiseSuppressionPreference, setNoiseSuppressionPreference } from './noiseSuppressionPreference';

describe('noiseSuppressionPreference', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to disabled when nothing has been stored yet', () => {
    expect(getNoiseSuppressionPreference()).toBe(false);
  });

  it('returns true after being set to true', () => {
    setNoiseSuppressionPreference(true);
    expect(getNoiseSuppressionPreference()).toBe(true);
  });

  it('returns false after being set to true then back to false', () => {
    setNoiseSuppressionPreference(true);
    setNoiseSuppressionPreference(false);
    expect(getNoiseSuppressionPreference()).toBe(false);
  });

  it('persists across separate reads', () => {
    setNoiseSuppressionPreference(true);
    expect(getNoiseSuppressionPreference()).toBe(true);
    expect(getNoiseSuppressionPreference()).toBe(true);
  });

  it('defaults to disabled when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(getNoiseSuppressionPreference()).toBe(false);
  });

  it('does not throw when localStorage.setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => setNoiseSuppressionPreference(false)).not.toThrow();
  });
});
