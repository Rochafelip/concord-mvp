import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Role } from '../../types/permission';
import { ApiError } from '../../services/apiClient';
import * as api from './api';
import { RolesTab } from './RolesTab';

vi.mock('./api');

const everyone: Role = {
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
const trusted: Role = { ...everyone, id: 'role-trusted', name: 'Trusted', position: 1, isEveryone: false };
const moderator: Role = { ...everyone, id: 'role-mod', name: 'Moderator', position: 3, isEveryone: false };
const admin: Role = { ...everyone, id: 'role-admin', name: 'Admin', position: 5, isEveryone: false };

// listRoles already returns them ordered by position desc, ties by name — the same order the UI
// should render in.
const roles = [admin, moderator, trusted, everyone];

function rowFor(name: string) {
  const row = screen.getByText(name).closest('li');
  if (row == null) throw new Error(`no <li> row found for ${name}`);
  return row as HTMLElement;
}

/**
 * dnd-kit's keyboard sensor picks the next slot by comparing each sortable row's
 * getBoundingClientRect() — which jsdom always reports as all-zero. Stacking the rows at
 * distinct, increasing `top` offsets (matching their rendered order) gives the coordinate
 * getter real geometry to compare, the same way a real browser layout would.
 */
function mockStackedRowRects() {
  screen.getAllByRole('listitem').forEach((row, index) => {
    vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({
      top: index * 40,
      bottom: index * 40 + 40,
      left: 0,
      right: 200,
      width: 200,
      height: 40,
      x: 0,
      y: index * 40,
      toJSON: () => {},
    } as DOMRect);
  });
}

function renderTab(overrides: { isOwner?: boolean; currentUserId?: string } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RolesTab
        serverId="s1"
        currentUserId={overrides.currentUserId ?? 'owner-1'}
        isOwner={overrides.isOwner ?? true}
        currentUserPermissions={['ADMINISTRATOR']}
      />
    </QueryClientProvider>,
  );
}

describe('RolesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.listRoles).mockResolvedValue(roles);
    vi.mocked(api.createRole).mockResolvedValue(admin);
    vi.mocked(api.updateRole).mockResolvedValue(admin);
    vi.mocked(api.deleteRole).mockResolvedValue(undefined);
    vi.mocked(api.updateRolePositions).mockResolvedValue(roles);
    // Irrelevant for the owner (exempt from hierarchy), only consulted for a non-owner actor.
    vi.mocked(api.listMemberRoles).mockResolvedValue([everyone]);
  });

  it('renders roles top-to-bottom in the order the API returns, @everyone last without move/delete', async () => {
    renderTab();

    const names = (await screen.findAllByRole('listitem')).map((li) => li.textContent);
    expect(names[0]).toContain('Admin');
    expect(names[1]).toContain('Moderator');
    expect(names[2]).toContain('Trusted');
    expect(names[3]).toContain('@everyone');

    const everyoneRow = rowFor('@everyone');
    expect(within(everyoneRow).queryByRole('button', { name: 'Delete role' })).not.toBeInTheDocument();
    expect(within(everyoneRow).queryByRole('button', { name: 'Reorder @everyone' })).not.toBeInTheDocument();
  });

  it('gives every non-everyone role a drag handle to reorder it', async () => {
    renderTab();
    await screen.findAllByRole('listitem');

    expect(within(rowFor('Admin')).getByRole('button', { name: 'Reorder Admin' })).toBeInTheDocument();
    expect(within(rowFor('Moderator')).getByRole('button', { name: 'Reorder Moderator' })).toBeInTheDocument();
    expect(within(rowFor('Trusted')).getByRole('button', { name: 'Reorder Trusted' })).toBeInTheDocument();
  });

  it('dragging a role via the keyboard swaps its position with the role above it in one batched call', async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findAllByRole('listitem');
    mockStackedRowRects();

    // Admin, Moderator, Trusted are rows 0/1/2 — picking up Moderator (row 1) and moving it
    // up one slot swaps it with Admin, the same result the old "Move up" button gave.
    within(rowFor('Moderator')).getByRole('button', { name: 'Reorder Moderator' }).focus();
    await user.keyboard('[Space]');
    await user.keyboard('[ArrowUp]');
    await user.keyboard('[Space]');

    expect(api.updateRolePositions).toHaveBeenCalledWith('s1', [
      { roleId: 'role-mod', position: 5 },
      { roleId: 'role-admin', position: 3 },
    ]);
  });

  it('opens the editor in create mode with the position one above the current highest', async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findAllByRole('listitem');

    await user.click(screen.getByRole('button', { name: 'Create role' }));
    await user.type(screen.getByLabelText('Name'), 'New Role');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(api.createRole).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ name: 'New Role', position: 6 }),
    );
  });

  it('opens the editor prefilled when Edit is clicked, and Cancel returns to the list', async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findAllByRole('listitem');

    await user.click(within(rowFor('Moderator')).getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Name')).toHaveValue('Moderator');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Create role' })).toBeInTheDocument();
  });

  it('positions a new role one below the actor\'s own highest role when the actor is not the owner', async () => {
    const user = userEvent.setup();
    vi.mocked(api.listMemberRoles).mockResolvedValue([moderator]); // moderator is at position 3
    renderTab({ isOwner: false, currentUserId: 'u1' });
    await screen.findAllByRole('listitem');

    await user.click(await screen.findByRole('button', { name: 'Create role' }));
    await user.type(screen.getByLabelText('Name'), 'New Role');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(api.createRole).toHaveBeenCalledWith('s1', expect.objectContaining({ position: 2 }));
  });

  it('disables Create role for a non-owner whose own rank is 0 (only @everyone)', async () => {
    vi.mocked(api.listMemberRoles).mockResolvedValue([everyone]);
    renderTab({ isOwner: false, currentUserId: 'u1' });
    await screen.findAllByRole('listitem');

    expect(await screen.findByRole('button', { name: 'Create role' })).toBeDisabled();
  });

  it('deletes a role from its row after confirming', async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findAllByRole('listitem');

    await user.click(within(rowFor('Trusted')).getByRole('button', { name: 'Delete role' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(api.deleteRole).toHaveBeenCalledWith('role-trusted');
  });

  it('shows the backend error when a move is rejected, without crashing the list', async () => {
    const user = userEvent.setup();
    vi.mocked(api.updateRolePositions).mockRejectedValue(
      new ApiError('Você não pode gerenciar um cargo no seu nível ou acima dele: Moderator', 403),
    );
    renderTab();
    await screen.findAllByRole('listitem');
    mockStackedRowRects();

    within(rowFor('Moderator')).getByRole('button', { name: 'Reorder Moderator' }).focus();
    await user.keyboard('[Space]');
    await user.keyboard('[ArrowUp]');
    await user.keyboard('[Space]');

    expect(await screen.findByRole('alert')).toHaveTextContent(/não pode gerenciar um cargo/);
  });

  it('shows the backend error when a delete is rejected', async () => {
    const user = userEvent.setup();
    vi.mocked(api.deleteRole).mockRejectedValue(new ApiError('Você não tem permissão para esta ação', 403));
    renderTab();
    await screen.findAllByRole('listitem');

    await user.click(within(rowFor('Trusted')).getByRole('button', { name: 'Delete role' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/não tem permissão/);
  });
});
