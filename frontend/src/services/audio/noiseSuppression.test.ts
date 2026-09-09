import { afterEach, describe, expect, it, vi } from 'vitest';
import { isNoiseSuppressionSupported } from './noiseSuppression';

describe('isNoiseSuppressionSupported', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false when the browser has no AudioWorklet (e.g. this test environment)', () => {
    expect(isNoiseSuppressionSupported()).toBe(false);
  });

  it('returns true when AudioWorklet is present', () => {
    vi.stubGlobal('AudioWorklet', class {});
    expect(isNoiseSuppressionSupported()).toBe(true);
  });
});
