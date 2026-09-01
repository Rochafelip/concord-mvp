import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from '../../types/server';
import * as api from './api';
import { ServerSidebar } from './ServerSidebar';

vi.mock('./api');

const servers: Server[] = [
  { id: 's1', name: 'Alpha', ownerId: 'u1', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  { id: 's2', name: 'Beta', ownerId: 'u2', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
];

function renderSidebar(initialPath = '/app') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/app" element={<ServerSidebar />} />
          <Route path="/app/servers/:serverId" element={<ServerSidebar />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ServerSidebar', () => {
  beforeEach(() => {
    vi.mocked(api.listServers).mockResolvedValue(servers);
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

  it('opens the join server modal', async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole('button', { name: 'Join server' }));

    expect(await screen.findByRole('heading', { name: 'Join a server' })).toBeInTheDocument();
  });
});
