const ENABLED_STORAGE_KEY = 'concord:audio:micSensitivityEnabled';
const THRESHOLD_STORAGE_KEY = 'concord:audio:micSensitivityThresholdDb';

export const MIC_SENSITIVITY_DEFAULT_THRESHOLD_DB = -50;
export const MIC_SENSITIVITY_MIN_THRESHOLD_DB = -60;
export const MIC_SENSITIVITY_MAX_THRESHOLD_DB = 0;

// Opt-in, not opt-out: same reasoning as noiseSuppressionPreference.ts — the gate is a
// TrackProcessor that reroutes the mic through a separate Web Audio graph, which in several
// browsers breaks the native echo canceller for that track.
export function getMicSensitivityEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_STORAGE_KEY) === 'true';
  } catch {
    return false; // Best-effort only (e.g. private browsing) — fail closed to disabled.
  }
}

export function setMicSensitivityEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(ENABLED_STORAGE_KEY, String(enabled));
  } catch {
    // Best-effort only (e.g. private browsing) — the in-memory choice just won't persist.
  }
}

export function getMicSensitivityThresholdDb(): number {
  try {
    const stored = localStorage.getItem(THRESHOLD_STORAGE_KEY);
    if (stored === null) return MIC_SENSITIVITY_DEFAULT_THRESHOLD_DB;
    const parsed = Number(stored);
    return Number.isFinite(parsed) ? parsed : MIC_SENSITIVITY_DEFAULT_THRESHOLD_DB;
  } catch {
    return MIC_SENSITIVITY_DEFAULT_THRESHOLD_DB;
  }
}

export function setMicSensitivityThresholdDb(thresholdDb: number): void {
  try {
    localStorage.setItem(THRESHOLD_STORAGE_KEY, String(thresholdDb));
  } catch {
    // Best-effort only (e.g. private browsing) — the in-memory choice just won't persist.
  }
}
