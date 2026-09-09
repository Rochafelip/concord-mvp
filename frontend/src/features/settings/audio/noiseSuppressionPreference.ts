const STORAGE_KEY = 'concord:audio:noiseSuppressionEnabled';

export function getNoiseSuppressionPreference(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== 'false';
}

export function setNoiseSuppressionPreference(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(enabled));
}
