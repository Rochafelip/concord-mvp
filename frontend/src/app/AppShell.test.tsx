import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../features/auth/authStore';
import { useVoiceStore } from '../stores/voiceStore';
import type { Server } from '../types/server';
import type { Channel } from '../types/channel';
import * as serversApi from '../features/servers/api';
import * as channelsApi from '../features/channels/api';
import { AppShell } from './AppShell';

vi.mock('../services/websocketClient', () => ({
  websocketClient: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn(),
    subscribe: vi.fn(() => () => {}),
  },
}));

vi.mock('../services/voiceClient', () => ({
  voiceClient: { disconnect: vi.fn(), toggleMute: vi.fn(), toggleDeafen: vi.fn() },
}));

vi.mock('../features/servers/api');
vi.mock('../features/channels/api');

const channel: Channel = {
  id: 'c1',
  serverId: 's1',
  name: 'lobby',
  type: 'VOICE',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

const server: Server = {
  id: 's1',
  name: 'Alpha',
  ownerId: 'owner-1',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

function renderShell(initialPath: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/app" element={<AppShell />}>
            <Route index element={<div>no server selected</div>} />
            <Route path="servers/:serverId" element={<div>server view</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AppShell', () => {
  beforeEach(() => {
    vi.mocked(serversApi.listServers).mockResolvedValue([]);
    vi.mocked(serversApi.getServer).mockResolvedValue(server);
    vi.mocked(channelsApi.getChannel).mockResolvedValue(channel);
    useAuthStore.setState({
      token: 'tok',
      user: {
        id: 'u1',
        username: 'me',
        displayName: 'Me',
        email: 'me@example.com',
        avatarUrl: null,
      },
    });
    useVoiceStore.setState({ status: 'disconnected', channelId: null, participants: [], error: null, isDeafened: false });
  });

  it('shows the active voice call bar even on the serverless /app root route', async () => {
    useVoiceStore.setState({ status: 'connected', channelId: 'c1' });
    renderShell('/app');

    await screen.findByText('lobby');
    expect(screen.getByText('no server selected')).toBeInTheDocument();
  });

  it('renders nothing voice-related when there is no active call', () => {
    renderShell('/app');

    expect(screen.queryByText('lobby')).not.toBeInTheDocument();
  });
});
