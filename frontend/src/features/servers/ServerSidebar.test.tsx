import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from '../../types/server';
import type { Friend } from '../../types/friend';
import * as api from './api';
import * as friendsApi from '../friends/api';
import { ServerSidebar } from './ServerSidebar';

vi.mock('./api');
vi.mock('../friends/api');

const servers: Server[] = [
  { id: 's1', name: 'Alpha', ownerId: 'u1', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  { id: 's2', name: 'Beta', ownerId: 'u2', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
];

const friends: Friend[] = [
  { friendshipId: 'f1', user: { id: 'u3', username: 'lety', displayName: 'Lety', avatarUrl: null }, online: true, since: '2026-01-01' },
];

function renderSidebar(initialPath = '/app', onNavigate?: () => void) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/app" element={<ServerSidebar onNavigate={onNavigate} />} />
          <Route path="/app/servers/:serverId" element={<ServerSidebar onNavigate={onNavigate} />} />
          <Route path="/app/dm/:friendUserId" element={<ServerSidebar onNavigate={onNavigate} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ServerSidebar', () => {
  beforeEach(() => {
    vi.mocked(api.listServers).mockResolvedValue(servers);
    vi.mocked(friendsApi.listFriends).mockResolvedValue(friends);
  });

  it("renders every server the user belongs to", async () => {
    renderSidebar();

    expect(await screen.findByRole('link', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Beta' })).toBeInTheDocument();
  });

  it('highlights the currently selected server, derived from the URL', async () => {
    renderSidebar('/app/servers/s2');

    const selected = await screen.findByRole('link', { name: 'Beta' });
    const notSelected = screen.getByRole('link', { name: 'Alpha' });

    expect(selected).toHaveAttribute('aria-current', 'page');
    expect(notSelected).not.toHaveAttribute('aria-current');
  });

  it('opens the create server modal', async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole('button', { name: 'Create server' }));

    expect(await screen.findByRole('heading', { name: 'Create a server' })).toBeInTheDocument();
  });

  it('has no manual join-by-code entry point — joining only happens via invite links', async () => {
    renderSidebar();
    await screen.findByRole('link', { name: 'Alpha' });

    expect(screen.queryByRole('button', { name: 'Join server' })).not.toBeInTheDocument();
  });

  it('opens a profile card for a friend, offering a way to their DM conversation', async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(await screen.findByRole('button', { name: 'Lety' }));

    const messageLink = await screen.findByRole('link', { name: /enviar mensagem/i });
    expect(messageLink).toHaveAttribute('href', '/app/dm/u3');
  });

  it('highlights the currently open DM, derived from the URL', async () => {
    renderSidebar('/app/dm/u3');

    const selected = await screen.findByRole('button', { name: 'Lety' });
    expect(selected).toHaveClass('bg-brand', 'text-white');
  });

  it('shows a retry indicator when the server list fails to load, instead of silently rendering as empty', async () => {
    vi.mocked(api.listServers).mockRejectedValue(new Error('network error'));
    renderSidebar();
    await screen.findByRole('button', { name: 'Lety' });

    expect(
      screen.getByRole('button', { name: 'Falha ao carregar servidores/amigos. Tentar novamente' }),
    ).toBeInTheDocument();
  });

  it('retries the failed query when the retry indicator is clicked', async () => {
    vi.mocked(api.listServers).mockRejectedValueOnce(new Error('network error'));
    const user = userEvent.setup();
    renderSidebar();
    const retryButton = await screen.findByRole(
      'button',
      { name: 'Falha ao carregar servidores/amigos. Tentar novamente' },
    );

    vi.mocked(api.listServers).mockResolvedValue(servers);
    await user.click(retryButton);

    expect(await screen.findByRole('link', { name: 'Alpha' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Falha ao carregar servidores/amigos. Tentar novamente' }),
    ).not.toBeInTheDocument();
  });

  it('calls onNavigate when navigating to Amigos', async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    renderSidebar('/app', onNavigate);

    await user.click(await screen.findByRole('link', { name: 'Amigos' }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('does not call onNavigate when selecting a server, so a drawer can stay open to pick a channel next', async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    renderSidebar('/app', onNavigate);

    await user.click(await screen.findByRole('link', { name: 'Alpha' }));

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('calls onNavigate when sending a message from a friend popover, not when merely opening it', async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    renderSidebar('/app', onNavigate);

    await user.click(await screen.findByRole('button', { name: 'Lety' }));
    expect(onNavigate).not.toHaveBeenCalled();

    await user.click(await screen.findByRole('link', { name: /enviar mensagem/i }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
