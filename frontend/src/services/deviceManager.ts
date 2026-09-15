export interface DeviceOption {
  deviceId: string;
  label: string;
}

export type DeviceErrorKind = 'permission-denied' | 'not-found' | 'in-use' | 'unknown';

export interface DeviceLists {
  cameras: DeviceOption[];
  microphones: DeviceOption[];
  speakers: DeviceOption[];
  error: DeviceErrorKind | null;
}

function classifyError(error: unknown): DeviceErrorKind {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'permission-denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'not-found';
  if (name === 'NotReadableError' || name === 'TrackStartError') return 'in-use';
  return 'unknown';
}

const KIND_LABELS: Record<'audioinput' | 'audiooutput' | 'videoinput', string> = {
  audioinput: 'Microfone',
  audiooutput: 'Alto-falante',
  videoinput: 'Câmera',
};

const STORAGE_KEYS: Record<MediaDeviceKind, string> = {
  audioinput: 'concord-preferred-microphone',
  audiooutput: 'concord-preferred-speaker',
  videoinput: 'concord-preferred-camera',
};

function toOption(device: MediaDeviceInfo): DeviceOption {
  const kind = device.kind as 'audioinput' | 'audiooutput' | 'videoinput';
  return {
    deviceId: device.deviceId,
    label: device.label || `${KIND_LABELS[kind]} ${device.deviceId.slice(0, 8)}`,
  };
}

function emptyLists(error: DeviceErrorKind | null): DeviceLists {
  return { cameras: [], microphones: [], speakers: [], error };
}

/**
 * Requests permission (so device labels are populated) then enumerates and groups devices by
 * kind. Never throws — resolves to empty lists with a classified `error` when mediaDevices is
 * unsupported or the permission prompt fails, so callers can show a specific message instead of a
 * generic one.
 */
export async function refreshDevices(): Promise<DeviceLists> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return emptyLists('unknown');
  }

  try {
    await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    const devices = await navigator.mediaDevices.enumerateDevices();

    return {
      cameras: devices.filter((device) => device.kind === 'videoinput').map(toOption),
      microphones: devices.filter((device) => device.kind === 'audioinput').map(toOption),
      speakers: devices.filter((device) => device.kind === 'audiooutput').map(toOption),
      error: null,
    };
  } catch (error) {
    return emptyLists(classifyError(error));
  }
}

export function getPreferred(kind: MediaDeviceKind): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS[kind]);
  } catch {
    return null;
  }
}

export function setPreferred(kind: MediaDeviceKind, deviceId: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS[kind], deviceId);
  } catch {
    // Best-effort only (e.g. private browsing) — the in-memory choice just won't persist.
  }
}

/** Returns an unsubscribe function. No-op (and returns a no-op unsubscribe) when unsupported. */
export function watchDeviceChanges(onChange: () => void): () => void {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.addEventListener) {
    return () => {};
  }
  navigator.mediaDevices.addEventListener('devicechange', onChange);
  return () => navigator.mediaDevices.removeEventListener('devicechange', onChange);
}
