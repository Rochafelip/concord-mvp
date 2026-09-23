import { afterEach, describe, expect, it, vi } from 'vitest';
import { isMicGateSupported } from './micGate';

describe('isMicGateSupported', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false when the browser has no AudioWorklet (e.g. this test environment)', () => {
    expect(isMicGateSupported()).toBe(false);
  });

  it('returns true when AudioWorklet is present', () => {
    vi.stubGlobal('AudioWorklet', class {});
    expect(isMicGateSupported()).toBe(true);
  });
});
