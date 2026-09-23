import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../features/auth/authStore';
import { useVoiceStore } from '../stores/voiceStore';
import type { Server } from '../types/server';
import type { Channel } from '../types/channel';
import * as serversApi from '../features/servers/api';
import * as channelsApi from '../features/channels/api';
import * as callsApi from '../features/calls/api';
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
vi.mock('../features/calls/api');

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
            <Route path="friends" element={<div>friends page</div>} />
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
    vi.mocked(serversApi.getServerMembers).mockResolvedValue([]);
    vi.mocked(serversApi.getInvite).mockResolvedValue({ code: 'ABC' });
    vi.mocked(channelsApi.getChannel).mockResolvedValue(channel);
    vi.mocked(callsApi.getVoicePresence).mockResolvedValue([]);
    useAuthStore.setState({
      sessionEndedReason: null,
      isAuthenticated: true,
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

    await screen.findByRole('link', { name: /lobby/ });
    expect(screen.getByText('no server selected')).toBeInTheDocument();
  });

  it('renders nothing voice-related when there is no active call', () => {
    renderShell('/app');

    expect(screen.queryByText('lobby')).not.toBeInTheDocument();
  });

  it('renders a link to the settings page in the header', () => {
    renderShell('/app');

    expect(screen.getByRole('link', { name: 'Configurações' })).toHaveAttribute('href', '/app/settings');
  });

  it('shows the email verification banner for an unverified user', () => {
    useAuthStore.setState({
      user: {
        id: 'u1',
        username: 'me',
        displayName: 'Me',
        email: 'me@example.com',
        avatarUrl: null,
        emailVerified: false,
      },
    });

    renderShell('/app');

    expect(screen.getByRole('status')).toHaveTextContent(
      'Verifique seu e-mail para criar ou entrar em servidores e usar o chat de voz.',
    );
  });

  it('hides the email verification banner for a verified user', () => {
    useAuthStore.setState({
      user: {
        id: 'u1',
        username: 'me',
        displayName: 'Me',
        email: 'me@example.com',
        avatarUrl: null,
        emailVerified: true,
      },
    });

    renderShell('/app');

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('asks for confirmation instead of logging out on the first click', async () => {
    const user = userEvent.setup();
    renderShell('/app');

    await user.click(screen.getByRole('button', { name: 'Sair do Concord' }));

    expect(screen.getByText('Sair do Concord?')).toBeInTheDocument();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('logs out once the user confirms', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true } as Response));
    const user = userEvent.setup();
    renderShell('/app');

    await user.click(screen.getByRole('button', { name: 'Sair do Concord' }));
    await user.click(screen.getByRole('button', { name: 'Sair' }));

    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  it('stays logged in when the confirmation is dismissed', async () => {
    const user = userEvent.setup();
    renderShell('/app');

    await user.click(screen.getByRole('button', { name: 'Sair do Concord' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByText('Sair do Concord?')).not.toBeInTheDocument();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('shows the logout label once, with an icon standing in for it on small screens', () => {
    renderShell('/app');

    const button = screen.getByRole('button', { name: 'Sair do Concord' });
    expect(within(button).getAllByText('Sair')).toHaveLength(1);
    expect(button.querySelector('svg')).toBeInTheDocument();
  });

  it('opens a navigation drawer with a second copy of the server rail when the hamburger is clicked', async () => {
    vi.mocked(serversApi.listServers).mockResolvedValue([server]);
    const user = userEvent.setup();
    renderShell('/app');

    await screen.findAllByRole('link', { name: 'Alpha' });
    expect(screen.getAllByRole('link', { name: 'Alpha' })).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Abrir navegação' }));

    expect(screen.getAllByRole('link', { name: 'Alpha' })).toHaveLength(2);
  });

  it('keeps the drawer open and reveals the channel list after picking a server from it', async () => {
    vi.mocked(serversApi.listServers).mockResolvedValue([server]);
    vi.mocked(channelsApi.listChannels).mockResolvedValue([channel]);
    const user = userEvent.setup();
    renderShell('/app');

    await user.click(screen.getByRole('button', { name: 'Abrir navegação' }));
    const alphaLinks = await screen.findAllByRole('link', { name: 'Alpha' });
    await user.click(alphaLinks[1]);

    expect(await screen.findByRole('link', { name: /lobby/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fechar navegação' })).toBeInTheDocument();
  });

  it('closes the drawer after navigating to Amigos', async () => {
    vi.mocked(serversApi.listServers).mockResolvedValue([]);
    const user = userEvent.setup();
    renderShell('/app');

    await user.click(screen.getByRole('button', { name: 'Abrir navegação' }));
    const amigosLinks = await screen.findAllByRole('link', { name: 'Amigos' });
    await user.click(amigosLinks[1]);

    expect(screen.queryByRole('button', { name: 'Fechar navegação' })).not.toBeInTheDocument();
  });

  it('closes the drawer via the close button', async () => {
    vi.mocked(serversApi.listServers).mockResolvedValue([]);
    const user = userEvent.setup();
    renderShell('/app');

    await user.click(screen.getByRole('button', { name: 'Abrir navegação' }));
    await user.click(screen.getByRole('button', { name: 'Fechar navegação' }));

    expect(screen.queryByRole('button', { name: 'Fechar navegação' })).not.toBeInTheDocument();
  });
});
