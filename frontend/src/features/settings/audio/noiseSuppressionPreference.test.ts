import { beforeEach, describe, expect, it } from 'vitest';
import { getNoiseSuppressionPreference, setNoiseSuppressionPreference } from './noiseSuppressionPreference';

describe('noiseSuppressionPreference', () => {
  beforeEach(() => {
    localStorage.clear();
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
});
