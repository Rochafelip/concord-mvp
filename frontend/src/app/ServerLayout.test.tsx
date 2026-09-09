import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../features/auth/authStore';
import * as callsApi from '../features/calls/api';
import * as channelsApi from '../features/channels/api';
import * as serversApi from '../features/servers/api';
import type { Server } from '../types/server';
import { ServerLayout } from './ServerLayout';

vi.mock('../features/channels/api');
vi.mock('../features/servers/api');
vi.mock('../features/calls/api');

const server: Server = {
  id: 's1',
  name: 'Alpha',
  ownerId: 'owner-1',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

function renderLayout() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/app/servers/s1']}>
        <Routes>
          <Route path="/app/servers/:serverId" element={<ServerLayout />}>
            <Route index element={<div>channel content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ServerLayout', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(channelsApi.listChannels).mockResolvedValue([]);
    vi.mocked(serversApi.getServer).mockResolvedValue(server);
    vi.mocked(serversApi.getServerMembers).mockResolvedValue([]);
    vi.mocked(serversApi.getInvite).mockResolvedValue({ code: 'ABC' });
    vi.mocked(callsApi.getVoicePresence).mockResolvedValue([]);
    useAuthStore.setState({
      token: 't',
      user: { id: 'owner-1', username: 'o', displayName: 'O', email: 'o@x.com', avatarUrl: null },
    });
  });

  it('renders the channel sidebar alongside the routed content', async () => {
    renderLayout();

    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('channel content')).toBeInTheDocument();
  });

  it('exposes a draggable separator for resizing the sidebar', async () => {
    renderLayout();

    await screen.findByText('Alpha');
    expect(screen.getByRole('separator', { name: 'Resize channel sidebar' })).toBeInTheDocument();
  });
});
