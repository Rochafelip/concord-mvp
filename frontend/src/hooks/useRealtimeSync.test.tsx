import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../features/auth/authStore';
import { useNotificationStore } from '../stores/notificationStore';
import type { Server } from '../types/server';
import type { VoicePresenceEntry } from '../types/voice';
import { useRealtimeSync } from './useRealtimeSync';

const { handlers, mockConnect, mockDisconnect } = vi.hoisted(() => ({
  handlers: new Map<string, Set<(payload: unknown) => void>>(),
  mockConnect: vi.fn(),
  mockDisconnect: vi.fn(),
}));

vi.mock('../services/websocketClient', () => ({
  websocketClient: {
    connect: mockConnect,
    disconnect: mockDisconnect,
    send: vi.fn(),
    subscribe: vi.fn((type: string, handler: (payload: unknown) => void) => {
      let set = handlers.get(type);
      if (!set) {
        set = new Set();
        handlers.set(type, set);
      }
      set.add(handler);
      return () => {
        handlers.get(type)?.delete(handler);
      };
    }),
  },
}));

function emit(type: string, payload: unknown) {
  act(() => {
    handlers.get(type)?.forEach((handler) => handler(payload));
  });
}

function TestHarness() {
  useRealtimeSync();
  return <Outlet />;
}

function renderHarness(queryClient: QueryClient, initialPath: string) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/app" element={<TestHarness />}>
            <Route index element={<div data-testid="no-server">no server</div>} />
            <Route path="servers/:serverId" element={<div data-testid="server-view">server view</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('useRealtimeSync', () => {
  beforeEach(() => {
    handlers.clear();
    mockConnect.mockClear();
    mockDisconnect.mockClear();
    useAuthStore.setState({
      token: 'jwt-abc',
      user: { id: 'u1', username: 'a', displayName: 'A', email: 'a@x.com', avatarUrl: null },
    });
    useNotificationStore.setState({ message: null });
  });

  afterEach(() => {
    useAuthStore.setState({ token: null, user: null });
  });

  function newQueryClient() {
    return new QueryClient({ defaultOptions: { queries: { retry: false } } });
  }

  it('connects on mount with the current token and disconnects on unmount', () => {
    const queryClient = newQueryClient();
    const { unmount } = renderHarness(queryClient, '/app');

    expect(mockConnect).toHaveBeenCalledWith('jwt-abc');
    expect(mockDisconnect).not.toHaveBeenCalled();

    unmount();
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('disconnects when the token goes from set to null (logout)', () => {
    const queryClient = newQueryClient();
    renderHarness(queryClient, '/app');
    expect(mockConnect).toHaveBeenCalledTimes(1);

    act(() => {
      useAuthStore.setState({ token: null, user: null });
    });

    expect(mockDisconnect).toHaveBeenCalled();
    // No second connect() call with a null token.
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it('MESSAGE_CREATE appends to the cached channel messages when a cache entry already exists', () => {
    const queryClient = newQueryClient();
    queryClient.setQueryData(['channels', 'c1', 'messages'], {
      pages: [[{ id: 'm1', channelId: 'c1', content: 'hi', createdAt: '2026-01-01T00:00:00Z', author: {} }]],
      pageParams: [undefined],
    });
    renderHarness(queryClient, '/app');

    const newMessage = {
      id: 'm2',
      channelId: 'c1',
      content: 'hello',
      createdAt: '2026-01-01T00:00:01Z',
      author: { id: 'u2', username: 'b', displayName: 'B', avatarUrl: null },
    };
    emit('MESSAGE_CREATE', newMessage);

    const cached = queryClient.getQueryData<{ pages: unknown[][] }>(['channels', 'c1', 'messages']);
    expect(cached?.pages[0]).toEqual([
      { id: 'm1', channelId: 'c1', content: 'hi', createdAt: '2026-01-01T00:00:00Z', author: {} },
      newMessage,
    ]);
  });

  it('MESSAGE_CREATE does nothing when there is no cached data for that channel', () => {
    const queryClient = newQueryClient();
    renderHarness(queryClient, '/app');

    emit('MESSAGE_CREATE', { id: 'm1', channelId: 'never-opened', content: 'hi', createdAt: 'x', author: {} });

    expect(queryClient.getQueryData(['channels', 'never-opened', 'messages'])).toBeUndefined();
  });

  it('CHANNEL_CREATE invalidates the channels list for that server', () => {
    const queryClient = newQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    renderHarness(queryClient, '/app');

    emit('CHANNEL_CREATE', { id: 'ch1', serverId: 's1', name: 'general', type: 'TEXT' });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['servers', 's1', 'channels'] });
  });

  it.each(['SERVER_MEMBER_JOIN', 'SERVER_MEMBER_LEAVE'])(
    '%s invalidates the members list for that server',
    (eventType) => {
      const queryClient = newQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      renderHarness(queryClient, '/app');

      emit(eventType, { serverId: 's1', userId: 'u2' });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['servers', 's1', 'members'] });
    },
  );

  it('SERVER_OWNER_CHANGE invalidates the whole servers branch', () => {
    const queryClient = newQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    renderHarness(queryClient, '/app');

    emit('SERVER_OWNER_CHANGE', { serverId: 's1', newOwnerId: 'u2' });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['servers'] });
  });

  it('SERVER_DELETE removes the server from the cached list and navigates away when currently viewing it', async () => {
    const queryClient = newQueryClient();
    const servers: Server[] = [
      { id: 's1', name: 'Alpha', ownerId: 'u1', createdAt: 'x', updatedAt: 'x' },
      { id: 's2', name: 'Beta', ownerId: 'u1', createdAt: 'x', updatedAt: 'x' },
    ];
    queryClient.setQueryData(['servers'], servers);
    renderHarness(queryClient, '/app/servers/s1');

    expect(await screen.findByTestId('server-view')).toBeInTheDocument();

    emit('SERVER_DELETE', { serverId: 's1' });

    expect(queryClient.getQueryData<Server[]>(['servers'])).toEqual([servers[1]]);
    expect(await screen.findByTestId('no-server')).toBeInTheDocument();
    expect(useNotificationStore.getState().message).not.toBeNull();
  });

  it('SERVER_DELETE removes the server from cache but does not navigate when viewing a different server', () => {
    const queryClient = newQueryClient();
    const servers: Server[] = [
      { id: 's1', name: 'Alpha', ownerId: 'u1', createdAt: 'x', updatedAt: 'x' },
      { id: 's2', name: 'Beta', ownerId: 'u1', createdAt: 'x', updatedAt: 'x' },
    ];
    queryClient.setQueryData(['servers'], servers);
    renderHarness(queryClient, '/app/servers/s2');

    emit('SERVER_DELETE', { serverId: 's1' });

    expect(queryClient.getQueryData<Server[]>(['servers'])).toEqual([servers[1]]);
    expect(screen.getByTestId('server-view')).toBeInTheDocument();
  });

  it('ERROR sets the notification store message', () => {
    const queryClient = newQueryClient();
    renderHarness(queryClient, '/app');

    emit('ERROR', { message: 'Something went wrong' });

    expect(useNotificationStore.getState().message).toBe('Something went wrong');
  });

  it('VOICE_PRESENCE_UPDATE upserts into an already-cached voice presence list', () => {
    const queryClient = newQueryClient();
    const existing: VoicePresenceEntry[] = [
      { channelId: 'c1', userId: 'u1', displayName: 'Ana', avatarUrl: null,
        muted: false, cameraOn: false, screenSharing: false, speaking: false },
    ];
    queryClient.setQueryData(['servers', 's1', 'voice-presence'], existing);
    renderHarness(queryClient, '/app');

    emit('VOICE_PRESENCE_UPDATE', {
      serverId: 's1', channelId: 'c1',
      user: { id: 'u2', username: 'b', displayName: 'Bob', avatarUrl: null },
      muted: true, cameraOn: false, screenSharing: false, speaking: false,
    });

    const cached = queryClient.getQueryData<VoicePresenceEntry[]>(['servers', 's1', 'voice-presence']);
    expect(cached).toEqual([
      existing[0],
      { channelId: 'c1', userId: 'u2', displayName: 'Bob', avatarUrl: null,
        muted: true, cameraOn: false, screenSharing: false, speaking: false },
    ]);
  });

  it('VOICE_PRESENCE_UPDATE replaces an existing entry for the same user rather than duplicating it', () => {
    const queryClient = newQueryClient();
    const existing: VoicePresenceEntry[] = [
      { channelId: 'c1', userId: 'u1', displayName: 'Ana', avatarUrl: null,
        muted: false, cameraOn: false, screenSharing: false, speaking: false },
    ];
    queryClient.setQueryData(['servers', 's1', 'voice-presence'], existing);
    renderHarness(queryClient, '/app');

    emit('VOICE_PRESENCE_UPDATE', {
      serverId: 's1', channelId: 'c1',
      user: { id: 'u1', username: 'a', displayName: 'Ana', avatarUrl: null },
      muted: true, cameraOn: false, screenSharing: false, speaking: false,
    });

    const cached = queryClient.getQueryData<VoicePresenceEntry[]>(['servers', 's1', 'voice-presence']);
    expect(cached).toEqual([
      { channelId: 'c1', userId: 'u1', displayName: 'Ana', avatarUrl: null,
        muted: true, cameraOn: false, screenSharing: false, speaking: false },
    ]);
  });

  it('VOICE_PRESENCE_UPDATE does nothing when there is no cached voice presence for that server', () => {
    const queryClient = newQueryClient();
    renderHarness(queryClient, '/app');

    emit('VOICE_PRESENCE_UPDATE', {
      serverId: 'never-opened', channelId: 'c1',
      user: { id: 'u1', username: 'a', displayName: 'Ana', avatarUrl: null },
      muted: false, cameraOn: false, screenSharing: false, speaking: false,
    });

    expect(queryClient.getQueryData(['servers', 'never-opened', 'voice-presence'])).toBeUndefined();
  });

  it('VOICE_PRESENCE_LEAVE removes the matching entry from the cached voice presence list', () => {
    const queryClient = newQueryClient();
    const existing: VoicePresenceEntry[] = [
      { channelId: 'c1', userId: 'u1', displayName: 'Ana', avatarUrl: null,
        muted: false, cameraOn: false, screenSharing: false, speaking: false },
      { channelId: 'c1', userId: 'u2', displayName: 'Bob', avatarUrl: null,
        muted: false, cameraOn: false, screenSharing: false, speaking: false },
    ];
    queryClient.setQueryData(['servers', 's1', 'voice-presence'], existing);
    renderHarness(queryClient, '/app');

    emit('VOICE_PRESENCE_LEAVE', { serverId: 's1', channelId: 'c1', userId: 'u1' });

    const cached = queryClient.getQueryData<VoicePresenceEntry[]>(['servers', 's1', 'voice-presence']);
    expect(cached).toEqual([existing[1]]);
  });
});
