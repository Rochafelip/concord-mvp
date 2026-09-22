import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Role } from '../../types/permission';
import type { Server, ServerMember } from '../../types/server';
import { useAuthStore } from '../auth/authStore';
import * as permissionsApi from '../permissions/api';
import * as api from './api';
import { ServerSettingsPanel } from './ServerSettingsPanel';

vi.mock('./api');
vi.mock('../permissions/api');
// UserProfileCard needs a `../friends/api` mock this file doesn't set up — its own behavior is
// covered by UserProfileCard.test.tsx.
vi.mock('../users/UserProfileCard', () => ({
  UserProfileCard: ({ children }: { children: React.ReactNode }) => children,
}));

const server: Server = {
  id: 's1',
  name: 'Alpha',
  ownerId: 'owner-1',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  // Invite is gated on MANAGE_INVITES, the Roles tab on MANAGE_ROLES; transfer/delete stay owner-only.
  permissions: ['MANAGE_INVITES', 'MANAGE_ROLES'],
};

const members: ServerMember[] = [
  { user: { id: 'owner-1', username: 'owner', displayName: 'Owner', avatarUrl: null }, joinedAt: '2026-01-01' },
  { user: { id: 'member-1', username: 'member', displayName: 'Member', avatarUrl: null }, joinedAt: '2026-01-01' },
];

const everyoneRole: Role = {
  id: 'role-everyone',
  serverId: 's1',
  name: '@everyone',
  description: null,
  color: null,
  position: 0,
  isEveryone: true,
  permissions: ['VIEW_CHANNEL'],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

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

function loginAsOwner() {
  useAuthStore.setState({
    isAuthenticated: true,
    user: { id: 'owner-1', username: 'owner', displayName: 'Owner', email: 'o@x.com', avatarUrl: null },
  });
}

describe('ServerSettingsPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(api.getServer).mockResolvedValue(server);
    vi.mocked(api.getServerMembers).mockResolvedValue(members);
    vi.mocked(api.getInvite).mockResolvedValue({ code: 'ABC123' });
    vi.mocked(api.leaveServer).mockReset();
    vi.mocked(permissionsApi.listRoles).mockResolvedValue([everyoneRole]);
    vi.mocked(permissionsApi.listMemberRoles).mockResolvedValue([]);
  });

  it('shows the owner invite/delete actions on Overview, and disables Leave Server with an explanation', async () => {
    loginAsOwner();
    renderPanel();

    expect(await screen.findByText('ABC123')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Regenerate code' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete server' })).toBeInTheDocument();

    const leaveButton = screen.getByRole('button', { name: 'Leave server' });
    expect(leaveButton).toBeDisabled();
    expect(screen.getByText(/can't leave directly/i)).toBeInTheDocument();
  });

  it('lets a plain member leave, and hides the invite section and the Roles tab', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'member-1', username: 'member', displayName: 'Member', email: 'm@x.com', avatarUrl: null },
    });
    // Neither MANAGE_INVITES nor MANAGE_ROLES.
    vi.mocked(api.getServer).mockResolvedValue({ ...server, permissions: [] });
    vi.mocked(api.leaveServer).mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderPanel();

    await screen.findByRole('heading', { name: 'Alpha settings' });

    expect(screen.queryByRole('button', { name: 'Regenerate code' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete server' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Roles' })).not.toBeInTheDocument();

    const leaveButton = screen.getByRole('button', { name: 'Leave server' });
    expect(leaveButton).toBeEnabled();

    await user.click(leaveButton);

    expect(api.leaveServer).toHaveBeenCalledWith('s1');
  });

  it('shows Make owner for other members on the Members tab', async () => {
    loginAsOwner();
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText('ABC123');

    await user.click(screen.getByRole('button', { name: 'Members' }));

    expect(await screen.findByRole('button', { name: 'Make owner' })).toBeInTheDocument();
  });

  it('shows the Roles tab when MANAGE_ROLES is held, rendering RolesTab inside it', async () => {
    loginAsOwner();
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText('ABC123');

    await user.click(screen.getByRole('button', { name: 'Roles' }));

    expect(await screen.findByRole('button', { name: 'Create role' })).toBeInTheDocument();
    expect(screen.getByText('@everyone')).toBeInTheDocument();
  });

  it('offers Manage roles for an ordinary member but not for the owner row or the current user\'s own row', async () => {
    loginAsOwner();
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText('ABC123');

    await user.click(screen.getByRole('button', { name: 'Members' }));
    await screen.findByText('Member');

    // Only one row can offer it here: not the owner's own row, and not (in this fixture) any
    // other owner row, since there is only one owner and they are the acting user.
    expect(screen.getAllByRole('button', { name: 'Manage roles' })).toHaveLength(1);
  });
});
