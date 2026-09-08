import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLastVisitedTextChannelId, setLastVisitedTextChannelId } from './lastVisitedChannel';

describe('lastVisitedChannel', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when nothing is stored for the server', () => {
    expect(getLastVisitedTextChannelId('server-1')).toBeNull();
  });

  it('returns the stored channel id for that server', () => {
    localStorage.setItem('concord:lastTextChannel:server-1', 'channel-a');

    expect(getLastVisitedTextChannelId('server-1')).toBe('channel-a');
  });

  it('keeps different servers independent', () => {
    setLastVisitedTextChannelId('server-1', 'channel-a');
    setLastVisitedTextChannelId('server-2', 'channel-b');

    expect(getLastVisitedTextChannelId('server-1')).toBe('channel-a');
    expect(getLastVisitedTextChannelId('server-2')).toBe('channel-b');
  });

  it('persists the visited channel id', () => {
    setLastVisitedTextChannelId('server-1', 'channel-a');

    expect(localStorage.getItem('concord:lastTextChannel:server-1')).toBe('channel-a');
  });

  it('returns null when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(getLastVisitedTextChannelId('server-1')).toBeNull();
  });

  it('does not throw when localStorage.setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => setLastVisitedTextChannelId('server-1', 'channel-a')).not.toThrow();
  });
});
