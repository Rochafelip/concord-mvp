import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server, ServerMember } from '../../types/server';
import { useAuthStore } from '../auth/authStore';
import * as api from './api';
import { ServerSettingsPanel } from './ServerSettingsPanel';

vi.mock('./api');

const server: Server = {
  id: 's1',
  name: 'Alpha',
  ownerId: 'owner-1',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

const members: ServerMember[] = [
  { user: { id: 'owner-1', username: 'owner', displayName: 'Owner', avatarUrl: null }, joinedAt: '2026-01-01' },
  { user: { id: 'member-1', username: 'member', displayName: 'Member', avatarUrl: null }, joinedAt: '2026-01-01' },
];

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ServerSettingsPanel serverId="s1" open onClose={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ServerSettingsPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(api.getServer).mockResolvedValue(server);
    vi.mocked(api.getServerMembers).mockResolvedValue(members);
    vi.mocked(api.getInvite).mockResolvedValue({ code: 'ABC123' });
    vi.mocked(api.leaveServer).mockReset();
  });

  it('shows the owner invite/transfer/delete actions and disables Leave Server with an explanation', async () => {
    useAuthStore.setState({
      token: 't',
      user: { id: 'owner-1', username: 'owner', displayName: 'Owner', email: 'o@x.com', avatarUrl: null },
    });
    renderPanel();

    expect(await screen.findByText('ABC123')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Regenerate code' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Make owner' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete server' })).toBeInTheDocument();

    const leaveButton = screen.getByRole('button', { name: 'Leave server' });
    expect(leaveButton).toBeDisabled();
    expect(screen.getByText(/can't leave directly/i)).toBeInTheDocument();
  });

  it('lets a non-owner leave and hides owner-only actions', async () => {
    useAuthStore.setState({
      token: 't',
      user: { id: 'member-1', username: 'member', displayName: 'Member', email: 'm@x.com', avatarUrl: null },
    });
    vi.mocked(api.leaveServer).mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderPanel();

    await screen.findByText('Member');

    expect(screen.queryByRole('button', { name: 'Regenerate code' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete server' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Make owner' })).not.toBeInTheDocument();

    const leaveButton = screen.getByRole('button', { name: 'Leave server' });
    expect(leaveButton).toBeEnabled();

    await user.click(leaveButton);

    expect(api.leaveServer).toHaveBeenCalledWith('s1');
  });
});
