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
