import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getPreferred,
  refreshDevices,
  setPreferred,
  watchDeviceChanges,
} from './deviceManager';

function mockMediaDevices(overrides: Partial<MediaDevices> = {}) {
  const mediaDevices = {
    getUserMedia: vi.fn().mockResolvedValue(undefined),
    enumerateDevices: vi.fn().mockResolvedValue([]),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    ...overrides,
  } as unknown as MediaDevices;
  Object.defineProperty(navigator, 'mediaDevices', { value: mediaDevices, configurable: true });
  return mediaDevices;
}

function fakeDevice(kind: MediaDeviceKind, deviceId: string, label: string): MediaDeviceInfo {
  return { kind, deviceId, label, groupId: '', toJSON: () => ({}) } as MediaDeviceInfo;
}

describe('deviceManager', () => {
  afterEach(() => {
    localStorage.clear();
  });

  describe('refreshDevices', () => {
    it('requests permission then groups enumerated devices by kind', async () => {
      const devices = mockMediaDevices({
        enumerateDevices: vi.fn().mockResolvedValue([
          fakeDevice('videoinput', 'cam-1', 'Integrated Camera'),
          fakeDevice('audioinput', 'mic-1', 'Internal Microphone'),
          fakeDevice('audiooutput', 'spk-1', 'Speakers'),
          fakeDevice('audioinput', 'mic-2', 'USB Headset'),
        ]),
      });

      const result = await refreshDevices();

      expect(devices.getUserMedia).toHaveBeenCalledWith({ audio: true, video: true });
      expect(result.error).toBeNull();
      expect(result.cameras).toEqual([{ deviceId: 'cam-1', label: 'Integrated Camera' }]);
      expect(result.microphones).toEqual([
        { deviceId: 'mic-1', label: 'Internal Microphone' },
        { deviceId: 'mic-2', label: 'USB Headset' },
      ]);
      expect(result.speakers).toEqual([{ deviceId: 'spk-1', label: 'Speakers' }]);
    });

    it('falls back to a generic label when the device has none', async () => {
      mockMediaDevices({
        enumerateDevices: vi.fn().mockResolvedValue([fakeDevice('audioinput', 'mic-abcdefgh', '')]),
      });

      const result = await refreshDevices();

      expect(result.microphones[0].label).toBe('Microfone mic-abcd');
    });

    it('resolves to empty lists with an "unknown" error when mediaDevices is unavailable', async () => {
      Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });

      const result = await refreshDevices();

      expect(result).toEqual({ cameras: [], microphones: [], speakers: [], error: 'unknown' });
    });

    it('classifies a permission-denied getUserMedia rejection', async () => {
      mockMediaDevices({ getUserMedia: vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')) });

      const result = await refreshDevices();

      expect(result).toEqual({ cameras: [], microphones: [], speakers: [], error: 'permission-denied' });
    });

    it('classifies a not-found getUserMedia rejection', async () => {
      mockMediaDevices({ getUserMedia: vi.fn().mockRejectedValue(new DOMException('none', 'NotFoundError')) });

      const result = await refreshDevices();

      expect(result.error).toBe('not-found');
    });

    it('classifies an in-use (device already captured elsewhere) getUserMedia rejection', async () => {
      mockMediaDevices({ getUserMedia: vi.fn().mockRejectedValue(new DOMException('busy', 'NotReadableError')) });

      const result = await refreshDevices();

      expect(result.error).toBe('in-use');
    });

    it('classifies any other failure as unknown', async () => {
      mockMediaDevices({ getUserMedia: vi.fn().mockRejectedValue(new Error('boom')) });

      const result = await refreshDevices();

      expect(result.error).toBe('unknown');
    });
  });

  describe('getPreferred / setPreferred', () => {
    it('returns null when nothing was ever stored', () => {
      expect(getPreferred('audioinput')).toBeNull();
    });

    it('round-trips a stored preference per device kind', () => {
      setPreferred('audioinput', 'mic-1');
      setPreferred('audiooutput', 'spk-1');
      setPreferred('videoinput', 'cam-1');

      expect(getPreferred('audioinput')).toBe('mic-1');
      expect(getPreferred('audiooutput')).toBe('spk-1');
      expect(getPreferred('videoinput')).toBe('cam-1');
    });
  });

  describe('watchDeviceChanges', () => {
    let devices: MediaDevices;

    beforeEach(() => {
      devices = mockMediaDevices();
    });

    it('registers a devicechange listener and invokes the callback when it fires', () => {
      const onChange = vi.fn();
      watchDeviceChanges(onChange);

      expect(devices.addEventListener).toHaveBeenCalledWith('devicechange', expect.any(Function));
      const handler = vi.mocked(devices.addEventListener).mock.calls[0][1] as () => void;
      handler();

      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('returns an unsubscribe function that removes the listener', () => {
      const onChange = vi.fn();
      const unsubscribe = watchDeviceChanges(onChange);
      const handler = vi.mocked(devices.addEventListener).mock.calls[0][1];

      unsubscribe();

      expect(devices.removeEventListener).toHaveBeenCalledWith('devicechange', handler);
    });
  });
});
