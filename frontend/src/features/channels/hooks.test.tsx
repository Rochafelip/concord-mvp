import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Channel } from '../../types/channel';
import * as api from './api';
import { useMarkChannelAsRead } from './hooks';

vi.mock('./api');

function channel(overrides: Partial<Channel> = {}): Channel {
  return {
    id: 'c1',
    serverId: 's1',
    name: 'general',
    type: 'TEXT',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    unreadCount: 3,
    ...overrides,
  };
}

describe('useMarkChannelAsRead', () => {
  beforeEach(() => {
    vi.mocked(api.markChannelAsRead).mockReset();
  });

  it('does not clobber an unread count bumped by a concurrent MESSAGE_CREATE while the request is in flight', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData<Channel>(['channels', 'c1'], channel());

    let resolveMarkAsRead: () => void = () => {};
    vi.mocked(api.markChannelAsRead).mockReturnValue(
      new Promise((resolve) => {
        resolveMarkAsRead = () => resolve(undefined);
      }),
    );

    const { result } = renderHook(() => useMarkChannelAsRead(), {
      wrapper: ({ children }) => (
        <MemoryRouter>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </MemoryRouter>
      ),
    });

    result.current.mutate({ channelId: 'c1' });

    // onMutate ran synchronously: optimistic zero is in place before the request resolves.
    await waitFor(() =>
      expect(queryClient.getQueryData<Channel>(['channels', 'c1'])?.unreadCount).toBe(0),
    );

    // A message arrives for this channel (e.g. the user switched away) and the realtime handler
    // increments the cache, same as useRealtimeSync's MESSAGE_CREATE handler does.
    queryClient.setQueryData<Channel>(['channels', 'c1'], (old) =>
      old ? { ...old, unreadCount: (old.unreadCount ?? 0) + 1 } : old,
    );

    resolveMarkAsRead();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryData<Channel>(['channels', 'c1'])?.unreadCount).toBe(1);
  });
});
