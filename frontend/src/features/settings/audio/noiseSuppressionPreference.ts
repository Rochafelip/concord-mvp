const STORAGE_KEY = 'concord:audio:noiseSuppressionEnabled';

// Opt-in, not opt-out: the RNNoise TrackProcessor reroutes the mic through a separate Web Audio
// graph (see noiseSuppression.ts's createNoiseSuppressionProcessor), which in several browsers
// breaks the native echo canceller for that track — without headphones, that sends the other
// party's own leaked audio back to them. Defaulting to enabled meant every caller hit this
// silently; explicit opt-in trades that for only affecting people who chose it.
export function getNoiseSuppressionPreference(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false; // Best-effort only (e.g. private browsing) — fail closed to the default (disabled).
  }
}

export function setNoiseSuppressionPreference(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // Best-effort only (e.g. private browsing) — the in-memory choice just won't persist.
  }
}
