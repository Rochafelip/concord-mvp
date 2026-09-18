import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../features/auth/authStore';
import { useNotificationStore } from '../stores/notificationStore';
import type { Channel } from '../types/channel';
import type { Server } from '../types/server';
import type { VoicePresenceEntry } from '../types/voice';
import { useVoiceStore } from '../stores/voiceStore';
import { voiceClient } from '../services/voiceClient';
import { getWsTicket } from '../features/auth/api';
import { getVoiceToken } from '../features/calls/api';
import { notify, playChime } from '../services/desktopNotifications';
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

vi.mock('../services/voiceClient', () => ({
  voiceClient: {
    disconnect: vi.fn(),
    beginConnect: vi.fn(() => 1),
    connect: vi.fn(() => Promise.resolve()),
  },
}));

// Partial: the voice-presence tests below rely on the module's real toVoicePresenceEntry.
vi.mock('../features/calls/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../features/calls/api')>()),
  getVoiceToken: vi.fn(() => Promise.resolve({ token: 'fresh-token', url: 'wss://livekit.test' })),
}));

vi.mock('../features/auth/api', () => ({
  getWsTicket: vi.fn(() => Promise.resolve({ ticket: 'ticket-abc' })),
}));

vi.mock('../services/desktopNotifications', () => ({
  notify: vi.fn(),
  playChime: vi.fn(),
  requestPermission: vi.fn(),
}));

function emit(type: string, payload: unknown) {
  act(() => {
    handlers.get(type)?.forEach((handler) => handler(payload));
  });
}

// Simulates the tab being backgrounded (Discord-style desktop notification trigger): both
// document.hidden and document.hasFocus() flip together, the way a real browser would.
function setBackgrounded(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
  vi.spyOn(document, 'hasFocus').mockReturnValue(!hidden);
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
            <Route
              path="servers/:serverId/channels/:channelId"
              element={<div data-testid="channel-view">channel view</div>}
            />
            <Route path="friends" element={<div data-testid="friends-view">friends view</div>} />
            <Route path="dm/:friendUserId" element={<div data-testid="dm-view">dm view</div>} />
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
    vi.mocked(voiceClient.disconnect).mockClear();
    vi.mocked(voiceClient.connect).mockClear();
    vi.mocked(voiceClient.beginConnect).mockClear();
    vi.mocked(getVoiceToken).mockClear();
    vi.mocked(getWsTicket).mockClear();
    vi.mocked(notify).mockClear();
    vi.mocked(playChime).mockClear();
    setBackgrounded(false);
    useVoiceStore.setState({ status: 'disconnected', channelId: null, participants: [], error: null, isDeafened: false });
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'u1', username: 'a', displayName: 'A', email: 'a@x.com', avatarUrl: null },
    });
    useNotificationStore.setState({
      message: null,
      unreadServerIds: [],
      unreadFriendIds: [],
      preferences: { messageNotifications: true, onboardingNotifications: true },
    });
  });

  afterEach(() => {
    useAuthStore.setState({ isAuthenticated: false, user: null });
  });

  function newQueryClient() {
    return new QueryClient({ defaultOptions: { queries: { retry: false } } });
  }

  it('connects on mount with a ticket-provider function that resolves via getWsTicket, and disconnects on unmount', async () => {
    const queryClient = newQueryClient();
    const { unmount } = renderHarness(queryClient, '/app');

    expect(mockConnect).toHaveBeenCalledWith(expect.any(Function));
    const getTicket = mockConnect.mock.calls[0][0] as () => Promise<string>;
    await expect(getTicket()).resolves.toBe('ticket-abc');
    expect(getWsTicket).toHaveBeenCalled();
    expect(mockDisconnect).not.toHaveBeenCalled();

    unmount();
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('disconnects when the session ends (logout)', () => {
    const queryClient = newQueryClient();
    renderHarness(queryClient, '/app');
    expect(mockConnect).toHaveBeenCalledTimes(1);

    act(() => {
      useAuthStore.setState({ isAuthenticated: false, user: null });
    });

    expect(mockDisconnect).toHaveBeenCalled();
    // No second connect() call once unauthenticated.
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

  it('MESSAGE_CREATE marks the message server as unread', () => {
    const queryClient = newQueryClient();
    queryClient.setQueryData<Channel[]>(['servers', 's1', 'channels'], [{
      id: 'c1',
      serverId: 's1',
      name: 'general',
      type: 'TEXT',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    }]);
    renderHarness(queryClient, '/app');

    emit('MESSAGE_CREATE', {
      id: 'm2',
      channelId: 'c1',
      content: 'Olá!',
      createdAt: '2026-01-01T00:00:01Z',
      author: { id: 'u2', username: 'b', displayName: 'B', avatarUrl: null },
    });

    expect(useNotificationStore.getState().unreadServerIds).toEqual(['s1']);
    expect(useNotificationStore.getState().message).toBeNull();
  });

  it('MESSAGE_CREATE shows a desktop notification and plays a chime when the window is backgrounded', () => {
    const queryClient = newQueryClient();
    queryClient.setQueryData<Channel[]>(['servers', 's1', 'channels'], [{
      id: 'c1',
      serverId: 's1',
      name: 'geral',
      type: 'TEXT',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    }]);
    queryClient.setQueryData<Server[]>(['servers'], [
      { id: 's1', name: 'Meu Servidor', ownerId: 'u1', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    ]);
    setBackgrounded(true);
    renderHarness(queryClient, '/app');

    emit('MESSAGE_CREATE', {
      id: 'm2',
      channelId: 'c1',
      content: 'Olá!',
      createdAt: '2026-01-01T00:00:01Z',
      author: { id: 'u2', username: 'b', displayName: 'Bruna', avatarUrl: null },
    });

    expect(playChime).toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Bruna', body: expect.stringContaining('Olá!') }),
    );
    expect(vi.mocked(notify).mock.calls[0][0].body).toContain('geral');
    expect(vi.mocked(notify).mock.calls[0][0].body).toContain('Meu Servidor');
  });

  it('MESSAGE_CREATE does not show a desktop notification when the window has focus', () => {
    const queryClient = newQueryClient();
    queryClient.setQueryData<Channel[]>(['servers', 's1', 'channels'], [{
      id: 'c1',
      serverId: 's1',
      name: 'geral',
      type: 'TEXT',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    }]);
    setBackgrounded(false);
    renderHarness(queryClient, '/app');

    emit('MESSAGE_CREATE', {
      id: 'm2',
      channelId: 'c1',
      content: 'Olá!',
      createdAt: '2026-01-01T00:00:01Z',
      author: { id: 'u2', username: 'b', displayName: 'Bruna', avatarUrl: null },
    });

    expect(notify).not.toHaveBeenCalled();
    expect(playChime).not.toHaveBeenCalled();
  });

  it('MESSAGE_CREATE does not show a desktop notification when message notifications are disabled', () => {
    const queryClient = newQueryClient();
    queryClient.setQueryData<Channel[]>(['servers', 's1', 'channels'], [{
      id: 'c1',
      serverId: 's1',
      name: 'geral',
      type: 'TEXT',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    }]);
    useNotificationStore.setState({
      preferences: { ...useNotificationStore.getState().preferences, messageNotifications: false },
    });
    setBackgrounded(true);
    renderHarness(queryClient, '/app');

    emit('MESSAGE_CREATE', {
      id: 'm2',
      channelId: 'c1',
      content: 'Olá!',
      createdAt: '2026-01-01T00:00:01Z',
      author: { id: 'u2', username: 'b', displayName: 'Bruna', avatarUrl: null },
    });

    expect(notify).not.toHaveBeenCalled();
    expect(playChime).not.toHaveBeenCalled();
  });

  it('MESSAGE_CREATE navigates to the message channel when the desktop notification is clicked', () => {
    const queryClient = newQueryClient();
    queryClient.setQueryData<Channel[]>(['servers', 's1', 'channels'], [{
      id: 'c1',
      serverId: 's1',
      name: 'geral',
      type: 'TEXT',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    }]);
    setBackgrounded(true);
    renderHarness(queryClient, '/app');

    emit('MESSAGE_CREATE', {
      id: 'm2',
      channelId: 'c1',
      content: 'Olá!',
      createdAt: '2026-01-01T00:00:01Z',
      author: { id: 'u2', username: 'b', displayName: 'Bruna', avatarUrl: null },
    });

    const onClick = vi.mocked(notify).mock.calls[0][0].onClick;
    act(() => onClick());

    expect(screen.getByTestId('channel-view')).toBeInTheDocument();
  });

  it('MESSAGE_CREATE identifies onboarding notifications and does not notify the sender', () => {
    const queryClient = newQueryClient();
    queryClient.setQueryData<Channel>(['channels', 'onboarding-1'], {
      id: 'onboarding-1',
      serverId: 's1',
      name: 'onboarding',
      type: 'ONBOARDING',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    });
    renderHarness(queryClient, '/app');

    emit('MESSAGE_CREATE', {
      id: 'm2',
      channelId: 'onboarding-1',
      content: 'B entrou no servidor',
      createdAt: '2026-01-01T00:00:01Z',
      author: { id: 'u2', username: 'b', displayName: 'B', avatarUrl: null },
    });
    expect(useNotificationStore.getState().unreadServerIds).toEqual(['s1']);
    expect(useNotificationStore.getState().message).toBeNull();

    useNotificationStore.setState({ message: null, unreadServerIds: [] });
    emit('MESSAGE_CREATE', {
      id: 'm3',
      channelId: 'onboarding-1',
      content: 'Minha própria mensagem',
      createdAt: '2026-01-01T00:00:02Z',
      author: { id: 'u1', username: 'a', displayName: 'A', avatarUrl: null },
    });
    expect(useNotificationStore.getState().message).toBeNull();
  });

  it('MESSAGE_CREATE ignores a redelivery of a message id already in the cache', () => {
    const queryClient = newQueryClient();
    const existing = { id: 'm1', channelId: 'c1', content: 'hi', createdAt: '2026-01-01T00:00:00Z', author: {} };
    queryClient.setQueryData(['channels', 'c1', 'messages'], {
      pages: [[existing]],
      pageParams: [undefined],
    });
    renderHarness(queryClient, '/app');

    emit('MESSAGE_CREATE', existing);

    const cached = queryClient.getQueryData<{ pages: unknown[][] }>(['channels', 'c1', 'messages']);
    expect(cached?.pages[0]).toEqual([existing]);
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

  it('CHANNEL_DELETE removes the channel from the cached channels list', () => {
    const queryClient = newQueryClient();
    const channels: Channel[] = [
      { id: 'c1', serverId: 's1', name: 'general', type: 'TEXT', createdAt: 'x', updatedAt: 'x' },
      { id: 'c2', serverId: 's1', name: 'lobby', type: 'VOICE', createdAt: 'x', updatedAt: 'x' },
    ];
    queryClient.setQueryData(['servers', 's1', 'channels'], channels);
    renderHarness(queryClient, '/app');

    emit('CHANNEL_DELETE', { channelId: 'c1', serverId: 's1' });

    expect(queryClient.getQueryData<Channel[]>(['servers', 's1', 'channels'])).toEqual([channels[1]]);
  });

  it('CHANNEL_DELETE navigates to the server root when the deleted channel is the one currently open', async () => {
    const queryClient = newQueryClient();
    renderHarness(queryClient, '/app/servers/s1/channels/c1');

    expect(await screen.findByTestId('channel-view')).toBeInTheDocument();

    emit('CHANNEL_DELETE', { channelId: 'c1', serverId: 's1' });

    expect(await screen.findByTestId('server-view')).toBeInTheDocument();
  });

  it('CHANNEL_DELETE does not navigate when a different channel is currently open', async () => {
    const queryClient = newQueryClient();
    renderHarness(queryClient, '/app/servers/s1/channels/c2');

    expect(await screen.findByTestId('channel-view')).toBeInTheDocument();

    emit('CHANNEL_DELETE', { channelId: 'c1', serverId: 's1' });

    expect(screen.getByTestId('channel-view')).toBeInTheDocument();
  });

  it('CHANNEL_DELETE disconnects from voice when the deleted channel is the one currently connected to', () => {
    const queryClient = newQueryClient();
    useVoiceStore.setState({ status: 'connected', channelId: 'c2', participants: [], error: null, isDeafened: false });
    renderHarness(queryClient, '/app');

    emit('CHANNEL_DELETE', { channelId: 'c2', serverId: 's1' });

    expect(voiceClient.disconnect).toHaveBeenCalledTimes(1);
  });

  it('CHANNEL_DELETE does not disconnect from voice when a different channel is deleted', () => {
    const queryClient = newQueryClient();
    useVoiceStore.setState({ status: 'connected', channelId: 'c2', participants: [], error: null, isDeafened: false });
    renderHarness(queryClient, '/app');

    emit('CHANNEL_DELETE', { channelId: 'c1', serverId: 's1' });

    expect(voiceClient.disconnect).not.toHaveBeenCalled();
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

  it('PERMISSIONS_UPDATE refetches everything scoped to that server', () => {
    const queryClient = newQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    renderHarness(queryClient, '/app/servers/s1/channels/c1');

    emit('PERMISSIONS_UPDATE', { serverId: 's1' });

    // TanStack matches query keys by prefix, so ['servers','s1'] covers that server's channels,
    // members and roles in one call. ['channels'] covers the single-channel queries that
    // ChatWindow and VoiceConnectionBar hold, which are keyed by channel id rather than server.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['servers', 's1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['channels'] });
  });

  it('PERMISSIONS_UPDATE rejoins an active call so LiveKit issues a grant with the new permissions', async () => {
    // The LiveKit grant is fixed when the token is minted (D20), so the only way to pick up a
    // permission change mid-call is to fetch a fresh token and reconnect with it.
    const queryClient = newQueryClient();
    queryClient.setQueryData<Channel>(['channels', 'c1'], {
      id: 'c1', serverId: 's1', name: 'lobby', type: 'VOICE', createdAt: 'x', updatedAt: 'x',
    });
    useVoiceStore.setState({ channelId: 'c1', status: 'connected' });
    renderHarness(queryClient, '/app/servers/s1/channels/c1');

    emit('PERMISSIONS_UPDATE', { serverId: 's1' });
    await act(async () => { await Promise.resolve(); });

    expect(getVoiceToken).toHaveBeenCalledWith('c1');
    expect(voiceClient.connect).toHaveBeenCalledWith('c1', 'fresh-token', 'wss://livekit.test', 1);
  });

  it('PERMISSIONS_UPDATE leaves a call in another server alone', async () => {
    const queryClient = newQueryClient();
    queryClient.setQueryData<Channel>(['channels', 'other-channel'], {
      id: 'other-channel', serverId: 's2', name: 'lobby', type: 'VOICE', createdAt: 'x', updatedAt: 'x',
    });
    useVoiceStore.setState({ channelId: 'other-channel', status: 'connected' });
    renderHarness(queryClient, '/app/servers/s1/channels/c1');

    emit('PERMISSIONS_UPDATE', { serverId: 's1' });
    await act(async () => { await Promise.resolve(); });

    expect(voiceClient.connect).not.toHaveBeenCalled();
  });

  it('PERMISSIONS_UPDATE does not touch a call that is not connected', async () => {
    const queryClient = newQueryClient();
    useVoiceStore.setState({ channelId: null, status: 'disconnected' });
    renderHarness(queryClient, '/app/servers/s1/channels/c1');

    emit('PERMISSIONS_UPDATE', { serverId: 's1' });
    await act(async () => { await Promise.resolve(); });

    expect(voiceClient.connect).not.toHaveBeenCalled();
  });

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
        muted: false, cameraOn: false, screenSharing: false, speaking: false, deafened: false },
    ];
    queryClient.setQueryData(['servers', 's1', 'voice-presence'], existing);
    renderHarness(queryClient, '/app');

    emit('VOICE_PRESENCE_UPDATE', {
      serverId: 's1', channelId: 'c1',
      user: { id: 'u2', username: 'b', displayName: 'Bob', avatarUrl: null },
      muted: true, cameraOn: false, screenSharing: false, speaking: false, deafened: false,
    });

    const cached = queryClient.getQueryData<VoicePresenceEntry[]>(['servers', 's1', 'voice-presence']);
    expect(cached).toEqual([
      existing[0],
      { channelId: 'c1', userId: 'u2', displayName: 'Bob', avatarUrl: null,
        muted: true, cameraOn: false, screenSharing: false, speaking: false, deafened: false },
    ]);
  });

  it('VOICE_PRESENCE_UPDATE replaces an existing entry for the same user rather than duplicating it', () => {
    const queryClient = newQueryClient();
    const existing: VoicePresenceEntry[] = [
      { channelId: 'c1', userId: 'u1', displayName: 'Ana', avatarUrl: null,
        muted: false, cameraOn: false, screenSharing: false, speaking: false, deafened: false },
    ];
    queryClient.setQueryData(['servers', 's1', 'voice-presence'], existing);
    renderHarness(queryClient, '/app');

    emit('VOICE_PRESENCE_UPDATE', {
      serverId: 's1', channelId: 'c1',
      user: { id: 'u1', username: 'a', displayName: 'Ana', avatarUrl: null },
      muted: true, cameraOn: false, screenSharing: false, speaking: false, deafened: false,
    });

    const cached = queryClient.getQueryData<VoicePresenceEntry[]>(['servers', 's1', 'voice-presence']);
    expect(cached).toEqual([
      { channelId: 'c1', userId: 'u1', displayName: 'Ana', avatarUrl: null,
        muted: true, cameraOn: false, screenSharing: false, speaking: false, deafened: false },
    ]);
  });

  it('VOICE_PRESENCE_UPDATE keeps an existing participant at its original position in the list', () => {
    const queryClient = newQueryClient();
    const existing: VoicePresenceEntry[] = [
      { channelId: 'c1', userId: 'u1', displayName: 'Ana', avatarUrl: null,
        muted: false, cameraOn: false, screenSharing: false, speaking: false, deafened: false },
      { channelId: 'c1', userId: 'u2', displayName: 'Bob', avatarUrl: null,
        muted: false, cameraOn: false, screenSharing: false, speaking: false, deafened: false },
      { channelId: 'c1', userId: 'u3', displayName: 'Cid', avatarUrl: null,
        muted: false, cameraOn: false, screenSharing: false, speaking: false, deafened: false },
    ];
    queryClient.setQueryData(['servers', 's1', 'voice-presence'], existing);
    renderHarness(queryClient, '/app');

    // Toggling speaking on the FIRST entry must not move it to the end of the list.
    emit('VOICE_PRESENCE_UPDATE', {
      serverId: 's1', channelId: 'c1',
      user: { id: 'u1', username: 'a', displayName: 'Ana', avatarUrl: null },
      muted: false, cameraOn: false, screenSharing: false, speaking: true, deafened: false,
    });

    const cached = queryClient.getQueryData<VoicePresenceEntry[]>(['servers', 's1', 'voice-presence']);
    expect(cached?.map((entry) => entry.userId)).toEqual(['u1', 'u2', 'u3']);
    expect(cached?.[0].speaking).toBe(true);
  });

  it('VOICE_PRESENCE_UPDATE does nothing when there is no cached voice presence for that server', () => {
    const queryClient = newQueryClient();
    renderHarness(queryClient, '/app');

    emit('VOICE_PRESENCE_UPDATE', {
      serverId: 'never-opened', channelId: 'c1',
      user: { id: 'u1', username: 'a', displayName: 'Ana', avatarUrl: null },
      muted: false, cameraOn: false, screenSharing: false, speaking: false, deafened: false,
    });

    expect(queryClient.getQueryData(['servers', 'never-opened', 'voice-presence'])).toBeUndefined();
  });

  it('VOICE_PRESENCE_LEAVE removes the matching entry from the cached voice presence list', () => {
    const queryClient = newQueryClient();
    const existing: VoicePresenceEntry[] = [
      { channelId: 'c1', userId: 'u1', displayName: 'Ana', avatarUrl: null,
        muted: false, cameraOn: false, screenSharing: false, speaking: false, deafened: false },
      { channelId: 'c1', userId: 'u2', displayName: 'Bob', avatarUrl: null,
        muted: false, cameraOn: false, screenSharing: false, speaking: false, deafened: false },
    ];
    queryClient.setQueryData(['servers', 's1', 'voice-presence'], existing);
    renderHarness(queryClient, '/app');

    emit('VOICE_PRESENCE_LEAVE', { serverId: 's1', channelId: 'c1', userId: 'u1' });

    const cached = queryClient.getQueryData<VoicePresenceEntry[]>(['servers', 's1', 'voice-presence']);
    expect(cached).toEqual([existing[1]]);
  });

  it('USER_PROFILE_UPDATE refreshes the display name in the auth and voice presence caches', () => {
    const queryClient = newQueryClient();
    queryClient.setQueryData(['servers', 's1', 'voice-presence'], [
      {
        channelId: 'c1',
        userId: 'u1',
        displayName: 'Nome antigo',
        avatarUrl: null,
        muted: false,
        cameraOn: false,
        screenSharing: false,
        speaking: false,
        deafened: false,
      },
    ]);
    renderHarness(queryClient, '/app');

    emit('USER_PROFILE_UPDATE', {
      user: { id: 'u1', username: 'a', displayName: 'Novo nome', avatarUrl: null },
    });

    expect(useAuthStore.getState().user?.displayName).toBe('Novo nome');
    expect(queryClient.getQueryData<VoicePresenceEntry[]>(['servers', 's1', 'voice-presence'])).toEqual([
      {
        channelId: 'c1',
        userId: 'u1',
        displayName: 'Novo nome',
        avatarUrl: null,
        muted: false,
        cameraOn: false,
        screenSharing: false,
        speaking: false,
        deafened: false,
      },
    ]);
  });

  it('DM_MESSAGE_CREATE appends to the cached conversation when a cache entry already exists', () => {
    const queryClient = newQueryClient();
    queryClient.setQueryData(['dm', 'u2', 'messages'], {
      pages: [[{ id: 'm1', author: { id: 'u2' }, recipientId: 'u1', content: 'hi', createdAt: '2026-01-01T00:00:00Z' }]],
      pageParams: [undefined],
    });
    renderHarness(queryClient, '/app');

    const incoming = {
      id: 'm2',
      author: { id: 'u2', username: 'b', displayName: 'B', avatarUrl: null },
      recipientId: 'u1',
      content: 'hello',
      createdAt: '2026-01-01T00:00:01Z',
    };
    emit('DM_MESSAGE_CREATE', incoming);

    const cached = queryClient.getQueryData<{ pages: unknown[][] }>(['dm', 'u2', 'messages']);
    expect(cached?.pages[0]).toEqual([
      { id: 'm1', author: { id: 'u2' }, recipientId: 'u1', content: 'hi', createdAt: '2026-01-01T00:00:00Z' },
      incoming,
    ]);
  });

  it('DM_MESSAGE_CREATE from someone else marks that friend unread when not viewing that conversation', () => {
    const queryClient = newQueryClient();
    renderHarness(queryClient, '/app');

    emit('DM_MESSAGE_CREATE', {
      id: 'm1',
      author: { id: 'u2', username: 'b', displayName: 'B', avatarUrl: null },
      recipientId: 'u1',
      content: 'oi',
      createdAt: '2026-01-01T00:00:00Z',
    });

    expect(useNotificationStore.getState().unreadFriendIds).toEqual(['u2']);
  });

  it('DM_MESSAGE_CREATE from the conversation currently open does not mark it unread', () => {
    const queryClient = newQueryClient();
    renderHarness(queryClient, '/app/dm/u2');

    emit('DM_MESSAGE_CREATE', {
      id: 'm1',
      author: { id: 'u2', username: 'b', displayName: 'B', avatarUrl: null },
      recipientId: 'u1',
      content: 'oi',
      createdAt: '2026-01-01T00:00:00Z',
    });

    expect(useNotificationStore.getState().unreadFriendIds).toEqual([]);
  });

  it('DM_MESSAGE_CREATE echoed back to its own sender does not mark anything unread', () => {
    const queryClient = newQueryClient();
    renderHarness(queryClient, '/app');

    emit('DM_MESSAGE_CREATE', {
      id: 'm1',
      author: { id: 'u1', username: 'a', displayName: 'A', avatarUrl: null },
      recipientId: 'u2',
      content: 'oi',
      createdAt: '2026-01-01T00:00:00Z',
    });

    expect(useNotificationStore.getState().unreadFriendIds).toEqual([]);
  });

  it('FRIEND_UPDATE invalidates the friends queries and marks the other user unread', async () => {
    const queryClient = newQueryClient();
    queryClient.setQueryData(['friends'], []);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    renderHarness(queryClient, '/app');

    emit('FRIEND_UPDATE', { userId: 'u2', otherUserId: 'u1' });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['friends'] });
    expect(useNotificationStore.getState().unreadFriendIds).toEqual(['u2']);
  });

  it('FRIEND_UPDATE does not mark anything unread while already viewing the friends page', () => {
    const queryClient = newQueryClient();
    renderHarness(queryClient, '/app/friends');

    emit('FRIEND_UPDATE', { userId: 'u2', otherUserId: 'u1' });

    expect(useNotificationStore.getState().unreadFriendIds).toEqual([]);
  });
});
