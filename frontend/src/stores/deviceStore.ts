import { create } from 'zustand';
import * as deviceManager from '../services/deviceManager';
import type { DeviceErrorKind, DeviceOption } from '../services/deviceManager';
import { voiceClient } from '../services/voiceClient';
import { useNotificationStore } from './notificationStore';

export type DeviceError = DeviceErrorKind | 'output-unsupported';

interface DeviceState {
  cameras: DeviceOption[];
  microphones: DeviceOption[];
  speakers: DeviceOption[];
  selectedCameraId: string | null;
  selectedMicrophoneId: string | null;
  selectedSpeakerId: string | null;
  error: DeviceError | null;
  refresh: () => Promise<void>;
  selectCamera: (deviceId: string) => Promise<void>;
  selectMicrophone: (deviceId: string) => Promise<void>;
  selectSpeaker: (deviceId: string) => Promise<void>;
}

const KIND_LABELS: Record<'audioinput' | 'audiooutput' | 'videoinput', string> = {
  audioinput: 'Microfone',
  audiooutput: 'Dispositivo de saída',
  videoinput: 'Câmera',
};

function pickSelected(list: DeviceOption[], kind: MediaDeviceKind): string | null {
  const preferred = deviceManager.getPreferred(kind);
  if (preferred && list.some((device) => device.deviceId === preferred)) return preferred;
  return list[0]?.deviceId ?? null;
}

function supportsAudioOutputSelection(): boolean {
  return typeof HTMLMediaElement.prototype.setSinkId === 'function';
}

export const useDeviceStore = create<DeviceState>((set) => ({
  cameras: [],
  microphones: [],
  speakers: [],
  selectedCameraId: null,
  selectedMicrophoneId: null,
  selectedSpeakerId: null,
  error: null,

  refresh: async () => {
    const lists = await deviceManager.refreshDevices();
    set({
      cameras: lists.cameras,
      microphones: lists.microphones,
      speakers: lists.speakers,
      error: lists.error,
      selectedCameraId: pickSelected(lists.cameras, 'videoinput'),
      selectedMicrophoneId: pickSelected(lists.microphones, 'audioinput'),
      selectedSpeakerId: pickSelected(lists.speakers, 'audiooutput'),
    });
  },

  selectCamera: async (deviceId) => {
    deviceManager.setPreferred('videoinput', deviceId);
    set({ selectedCameraId: deviceId });
    if (voiceClient.isInCall()) await voiceClient.setCameraDevice(deviceId);
  },

  selectMicrophone: async (deviceId) => {
    deviceManager.setPreferred('audioinput', deviceId);
    set({ selectedMicrophoneId: deviceId });
    if (voiceClient.isInCall()) await voiceClient.setMicrophoneDevice(deviceId);
  },

  selectSpeaker: async (deviceId) => {
    if (!supportsAudioOutputSelection()) {
      set({ error: 'output-unsupported', selectedSpeakerId: null });
      return;
    }
    deviceManager.setPreferred('audiooutput', deviceId);
    set({ selectedSpeakerId: deviceId });
    if (voiceClient.isInCall()) await voiceClient.setSpeakerDevice(deviceId);
  },
}));

/**
 * Reacts to devices being plugged/unplugged while connected — if the currently selected device
 * for a kind disappears, falls back to the first remaining device of that kind (applying it live
 * via the matching store action) and tells the user via the app's single-banner notification.
 * Registered once here, at module load, rather than by a component, so it's active even when no
 * device-settings UI is mounted (e.g. mid-call with the panel closed).
 */
async function handleDeviceChange(): Promise<void> {
  const before = useDeviceStore.getState();
  await before.refresh();
  const after = useDeviceStore.getState();

  await maybeFallback('videoinput', before.selectedCameraId, after.cameras, after.selectCamera);
  await maybeFallback(
    'audioinput',
    before.selectedMicrophoneId,
    after.microphones,
    after.selectMicrophone,
  );
  await maybeFallback('audiooutput', before.selectedSpeakerId, after.speakers, after.selectSpeaker);
}

async function maybeFallback(
  kind: 'audioinput' | 'audiooutput' | 'videoinput',
  previousId: string | null,
  currentList: DeviceOption[],
  select: (deviceId: string) => Promise<void>,
): Promise<void> {
  if (!previousId) return;
  if (currentList.some((device) => device.deviceId === previousId)) return; // still present
  const replacement = currentList[0];
  if (!replacement) return; // nothing to fall back to
  await select(replacement.deviceId);
  useNotificationStore
    .getState()
    .setMessage(`${KIND_LABELS[kind]} desconectado — usando ${replacement.label}.`);
}

// A real 'devicechange' DOM event never awaits its listener, so returning a Promise here is
// harmless in production — it just makes the same handler awaitable in tests.
deviceManager.watchDeviceChanges(handleDeviceChange);
