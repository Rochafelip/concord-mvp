import { describe, expect, it } from 'vitest';
import { hasPermission } from './permission';

/**
 * The permission vocabulary lives in two places — the Java enum that owns the bit indexes and the
 * TypeScript union the UI gates on. Nothing but this test stops them drifting, and a drift only
 * shows up in production as a button that is hidden (or shown) for the wrong people.
 */
/**
 * The names here must match the backend's Permission enum exactly. That comparison lives in the
 * backend, in PermissionVocabularySyncTest, which parses this very file — it needs filesystem
 * access, and tsconfig.app.json deliberately keeps Node's globals out of the app's type space.
 */

describe('hasPermission', () => {
  it('is true when the permission is present', () => {
    expect(hasPermission(['VIEW_CHANNEL', 'SEND_MESSAGES'], 'SEND_MESSAGES')).toBe(true);
  });

  it('is false when it is absent', () => {
    expect(hasPermission(['VIEW_CHANNEL'], 'SEND_MESSAGES')).toBe(false);
  });

  it('treats ADMINISTRATOR as holding everything, matching the backend', () => {
    expect(hasPermission(['ADMINISTRATOR'], 'BAN_MEMBERS')).toBe(true);
  });

  it('is false for undefined, so a response from before this feature hides nothing by accident', () => {
    expect(hasPermission(undefined, 'SEND_MESSAGES')).toBe(false);
  });
});
