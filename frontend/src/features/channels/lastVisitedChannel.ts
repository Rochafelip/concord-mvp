const STORAGE_PREFIX = 'concord:lastTextChannel:';

// Best-effort per-server memory of the last TEXT channel a user looked at, so ServerIndexRoute
// can restore it instead of always jumping to the server's first text channel. Follows the same
// prefixed-key, try/catch convention as screenShareQuality.ts.
export function getLastVisitedTextChannelId(serverId: string): string | null {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${serverId}`);
  } catch {
    return null;
  }
}

export function setLastVisitedTextChannelId(serverId: string, channelId: string): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${serverId}`, channelId);
  } catch {
    // Best-effort only (e.g. private browsing) — auto-select just falls back to the first text
    // channel next time instead of remembering this one.
  }
}
