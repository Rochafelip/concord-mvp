import type { ScreenShareQuality } from '../../types/voice';

export const SCREEN_SHARE_QUALITY_PRESETS: Record<ScreenShareQuality, { width: number; height: number }> = {
  hd: { width: 1280, height: 720 },
  fhd: { width: 1920, height: 1080 },
};

const STORAGE_KEY = 'concord:screenShareQuality';

// Defaults to 'fhd', matching livekit-client's existing implicit behavior when no resolution is
// passed at all (its ScreenShareCaptureOptions.resolution doc comment: capture defaults to 1080p
// on every browser but Safari) — so a user who has never picked a quality sees no change from
// today's behavior.
export function getLastScreenShareQuality(): ScreenShareQuality {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'hd' || stored === 'fhd' ? stored : 'fhd';
  } catch {
    return 'fhd';
  }
}

export function setLastScreenShareQuality(quality: ScreenShareQuality): void {
  try {
    localStorage.setItem(STORAGE_KEY, quality);
  } catch {
    // Best-effort only (e.g. private browsing) — the picker still works this session, it just
    // won't remember the choice for next time.
  }
}

const AUDIO_STORAGE_KEY = 'concord:screenShareAudio';

// Unchecked by default (see the quality feature's design doc for the parallel reasoning) — any
// stored value other than the literal string 'true' (nothing stored, a corrupted value, or a
// thrown read) is treated as false, so there's no separate "unset" state to handle.
export function getLastScreenShareAudioPreference(): boolean {
  try {
    return localStorage.getItem(AUDIO_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setLastScreenShareAudioPreference(withAudio: boolean): void {
  try {
    localStorage.setItem(AUDIO_STORAGE_KEY, String(withAudio));
  } catch {
    // Best-effort only, same reasoning as setLastScreenShareQuality.
  }
}
