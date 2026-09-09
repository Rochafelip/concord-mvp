const STORAGE_KEY = 'concord:audio:noiseSuppressionEnabled';

export function getNoiseSuppressionPreference(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    return true; // Best-effort only (e.g. private browsing) — fail open to the default (enabled).
  }
}

export function setNoiseSuppressionPreference(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // Best-effort only (e.g. private browsing) — the in-memory choice just won't persist.
  }
}
