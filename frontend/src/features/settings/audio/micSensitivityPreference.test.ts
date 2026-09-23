import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MIC_SENSITIVITY_DEFAULT_THRESHOLD_DB,
  getMicSensitivityEnabled,
  getMicSensitivityThresholdDb,
  setMicSensitivityEnabled,
  setMicSensitivityThresholdDb,
} from './micSensitivityPreference';

describe('micSensitivityPreference', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('enabled flag', () => {
    it('defaults to disabled when nothing has been stored yet', () => {
      expect(getMicSensitivityEnabled()).toBe(false);
    });

    it('returns true after being set to true', () => {
      setMicSensitivityEnabled(true);
      expect(getMicSensitivityEnabled()).toBe(true);
    });

    it('returns false after being set to true then back to false', () => {
      setMicSensitivityEnabled(true);
      setMicSensitivityEnabled(false);
      expect(getMicSensitivityEnabled()).toBe(false);
    });

    it('defaults to disabled when localStorage.getItem throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });

      expect(getMicSensitivityEnabled()).toBe(false);
    });

    it('does not throw when localStorage.setItem throws', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('blocked');
      });

      expect(() => setMicSensitivityEnabled(true)).not.toThrow();
    });
  });

  describe('threshold', () => {
    it('defaults to -50dB when nothing has been stored yet', () => {
      expect(getMicSensitivityThresholdDb()).toBe(MIC_SENSITIVITY_DEFAULT_THRESHOLD_DB);
    });

    it('returns the stored value after being set', () => {
      setMicSensitivityThresholdDb(-30);
      expect(getMicSensitivityThresholdDb()).toBe(-30);
    });

    it('falls back to the default when the stored value is not a valid number', () => {
      localStorage.setItem('concord:audio:micSensitivityThresholdDb', 'not-a-number');
      expect(getMicSensitivityThresholdDb()).toBe(MIC_SENSITIVITY_DEFAULT_THRESHOLD_DB);
    });

    it('falls back to the default when localStorage.getItem throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });

      expect(getMicSensitivityThresholdDb()).toBe(MIC_SENSITIVITY_DEFAULT_THRESHOLD_DB);
    });

    it('does not throw when localStorage.setItem throws', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('blocked');
      });

      expect(() => setMicSensitivityThresholdDb(-20)).not.toThrow();
    });
  });
});
