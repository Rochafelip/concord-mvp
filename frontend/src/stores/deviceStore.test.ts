import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDeviceManager = vi.hoisted(() => ({
  refreshDevices: vi.fn(),
  getPreferred: vi.fn<(kind: MediaDeviceKind) => string | null>(() => null),
  setPreferred: vi.fn(),
  watchDeviceChanges: vi.fn(),
}));
vi.mock('../services/deviceManager', () => mockDeviceManager);

const mockVoiceClient = vi.hoisted(() => ({
  isInCall: vi.fn(() => false),
  setMicrophoneDevice: vi.fn().mockResolvedValue(undefined),
  setSpeakerDevice: vi.fn().mockResolvedValue(undefined),
  setCameraDevice: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../services/voiceClient', () => ({ voiceClient: mockVoiceClient }));

const mockSetMessage = vi.hoisted(() => vi.fn());
vi.mock('./notificationStore', () => ({
  useNotificationStore: { getState: () => ({ setMessage: mockSetMessage }) },
}));

// Imported after mocks so the module-level `deviceManager.watchDeviceChanges(...)` subscription
// (run once, at import time) captures the mocked function.
const { useDeviceStore } = await import('./deviceStore');

function emptyLists(error: 'permission-denied' | 'not-found' | 'in-use' | 'unknown' | null = null) {
  return { cameras: [], microphones: [], speakers: [], error };
}

function deviceChangeHandler(): () => void {
  const call = mockDeviceManager.watchDeviceChanges.mock.calls[0];
  if (!call) throw new Error('watchDeviceChanges was never called');
  return call[0] as () => void;
}

describe('deviceStore', () => {
  beforeEach(() => {
    mockDeviceManager.refreshDevices.mockReset().mockResolvedValue(emptyLists());
    mockDeviceManager.getPreferred.mockReset().mockReturnValue(null);
    mockDeviceManager.setPreferred.mockReset();
    mockVoiceClient.isInCall.mockReset().mockReturnValue(false);
    mockVoiceClient.setMicrophoneDevice.mockClear();
    mockVoiceClient.setSpeakerDevice.mockClear();
    mockVoiceClient.setCameraDevice.mockClear();
    mockSetMessage.mockClear();
    Object.defineProperty(HTMLMediaElement.prototype, 'setSinkId', {
      value: vi.fn().mockResolvedValue(undefined),
      configurable: true,
    });
    useDeviceStore.setState({
      cameras: [],
      microphones: [],
      speakers: [],
      selectedCameraId: null,
      selectedMicrophoneId: null,
      selectedSpeakerId: null,
      error: null,
    });
  });

  it('subscribes to device changes once at module load', () => {
    expect(mockDeviceManager.watchDeviceChanges).toHaveBeenCalledTimes(1);
    expect(mockDeviceManager.watchDeviceChanges).toHaveBeenCalledWith(expect.any(Function));
  });

  describe('refresh', () => {
    it('populates the device lists and selects the stored preference when present', async () => {
      mockDeviceManager.refreshDevices.mockResolvedValue({
        cameras: [{ deviceId: 'cam-1', label: 'Cam 1' }],
        microphones: [
          { deviceId: 'mic-1', label: 'Mic 1' },
          { deviceId: 'mic-2', label: 'Mic 2' },
        ],
        speakers: [{ deviceId: 'spk-1', label: 'Speaker 1' }],
        error: null,
      });
      mockDeviceManager.getPreferred.mockImplementation((kind: string) =>
        kind === 'audioinput' ? 'mic-2' : null,
      );

      await useDeviceStore.getState().refresh();

      const state = useDeviceStore.getState();
      expect(state.cameras).toEqual([{ deviceId: 'cam-1', label: 'Cam 1' }]);
      expect(state.selectedCameraId).toBe('cam-1'); // no preference -> first available
      expect(state.selectedMicrophoneId).toBe('mic-2'); // preference present in list
      expect(state.selectedSpeakerId).toBe('spk-1');
      expect(state.error).toBeNull();
    });

    it('leaves selection null when a list is empty', async () => {
      mockDeviceManager.refreshDevices.mockResolvedValue(emptyLists());

      await useDeviceStore.getState().refresh();

      const state = useDeviceStore.getState();
      expect(state.selectedCameraId).toBeNull();
      expect(state.selectedMicrophoneId).toBeNull();
      expect(state.selectedSpeakerId).toBeNull();
    });

    it('surfaces the classified error from deviceManager', async () => {
      mockDeviceManager.refreshDevices.mockResolvedValue(emptyLists('permission-denied'));

      await useDeviceStore.getState().refresh();

      expect(useDeviceStore.getState().error).toBe('permission-denied');
    });
  });

  describe('selectCamera / selectMicrophone', () => {
    it('persists the preference but does not touch voiceClient when not in a call', async () => {
      mockVoiceClient.isInCall.mockReturnValue(false);

      await useDeviceStore.getState().selectCamera('cam-2');

      expect(mockDeviceManager.setPreferred).toHaveBeenCalledWith('videoinput', 'cam-2');
      expect(useDeviceStore.getState().selectedCameraId).toBe('cam-2');
      expect(mockVoiceClient.setCameraDevice).not.toHaveBeenCalled();
    });

    it('applies the switch live via voiceClient when in a call', async () => {
      mockVoiceClient.isInCall.mockReturnValue(true);

      await useDeviceStore.getState().selectMicrophone('mic-3');

      expect(mockDeviceManager.setPreferred).toHaveBeenCalledWith('audioinput', 'mic-3');
      expect(useDeviceStore.getState().selectedMicrophoneId).toBe('mic-3');
      expect(mockVoiceClient.setMicrophoneDevice).toHaveBeenCalledWith('mic-3');
    });
  });

  describe('syncActiveCamera', () => {
    it('persists the preference and updates the selection without calling voiceClient', () => {
      mockVoiceClient.isInCall.mockReturnValue(true);

      useDeviceStore.getState().syncActiveCamera('front-cam');

      expect(mockDeviceManager.setPreferred).toHaveBeenCalledWith('videoinput', 'front-cam');
      expect(useDeviceStore.getState().selectedCameraId).toBe('front-cam');
      expect(mockVoiceClient.setCameraDevice).not.toHaveBeenCalled();
    });
  });

  describe('selectSpeaker', () => {
    it('applies the switch live via voiceClient when in a call and setSinkId is supported', async () => {
      mockVoiceClient.isInCall.mockReturnValue(true);

      await useDeviceStore.getState().selectSpeaker('spk-2');

      expect(mockDeviceManager.setPreferred).toHaveBeenCalledWith('audiooutput', 'spk-2');
      expect(useDeviceStore.getState().selectedSpeakerId).toBe('spk-2');
      expect(mockVoiceClient.setSpeakerDevice).toHaveBeenCalledWith('spk-2');
    });

    it('sets an output-unsupported error and does not persist or call voiceClient when setSinkId is missing', async () => {
      // @ts-expect-error -- simulating a browser (Firefox/Safari) without setSinkId support
      delete HTMLMediaElement.prototype.setSinkId;

      await useDeviceStore.getState().selectSpeaker('spk-2');

      expect(useDeviceStore.getState().error).toBe('output-unsupported');
      expect(useDeviceStore.getState().selectedSpeakerId).toBeNull();
      expect(mockDeviceManager.setPreferred).not.toHaveBeenCalled();
      expect(mockVoiceClient.setSpeakerDevice).not.toHaveBeenCalled();
    });
  });

  describe('devicechange fallback', () => {
    it('auto-switches to the first available replacement and notifies when the selected device disappears', async () => {
      useDeviceStore.setState({ selectedMicrophoneId: 'mic-1' });
      mockVoiceClient.isInCall.mockReturnValue(true);
      mockDeviceManager.refreshDevices.mockResolvedValue({
        cameras: [],
        microphones: [{ deviceId: 'mic-2', label: 'Mic 2' }],
        speakers: [],
        error: null,
      });

      await deviceChangeHandler()();

      const state = useDeviceStore.getState();
      expect(state.selectedMicrophoneId).toBe('mic-2');
      expect(mockDeviceManager.setPreferred).toHaveBeenCalledWith('audioinput', 'mic-2');
      expect(mockVoiceClient.setMicrophoneDevice).toHaveBeenCalledWith('mic-2');
      expect(mockSetMessage).toHaveBeenCalledWith(expect.stringContaining('Microfone'));
    });

    it('clears the selection without notifying when no replacement is available', async () => {
      useDeviceStore.setState({ selectedMicrophoneId: 'mic-1' });
      mockDeviceManager.refreshDevices.mockResolvedValue(emptyLists());

      await deviceChangeHandler()();

      expect(useDeviceStore.getState().selectedMicrophoneId).toBeNull();
      expect(mockVoiceClient.setMicrophoneDevice).not.toHaveBeenCalled();
      expect(mockSetMessage).not.toHaveBeenCalled();
    });

    it('does nothing when the previously selected device is still present', async () => {
      useDeviceStore.setState({ selectedMicrophoneId: 'mic-1' });
      mockDeviceManager.refreshDevices.mockResolvedValue({
        cameras: [],
        microphones: [{ deviceId: 'mic-1', label: 'Mic 1' }],
        speakers: [],
        error: null,
      });

      await deviceChangeHandler()();

      expect(useDeviceStore.getState().selectedMicrophoneId).toBe('mic-1');
      expect(mockVoiceClient.setMicrophoneDevice).not.toHaveBeenCalled();
      expect(mockSetMessage).not.toHaveBeenCalled();
    });
  });
});
