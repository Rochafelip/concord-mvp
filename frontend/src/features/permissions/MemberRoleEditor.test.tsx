import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Role } from '../../types/permission';
import { ApiError } from '../../services/apiClient';
import * as api from './api';
import { MemberRoleEditor } from './MemberRoleEditor';

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
const verified: Role = { ...everyone, id: 'role-verified', name: 'Verified', position: 2, isEveryone: false };
const roles = [trusted, verified, everyone];

function renderEditor() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberRoleEditor serverId="s1" userId="u1" roles={roles} />
    </QueryClientProvider>,
  );
}

describe('MemberRoleEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.listMemberRoles).mockResolvedValue([]);
    vi.mocked(api.assignRole).mockResolvedValue(undefined);
    vi.mocked(api.unassignRole).mockResolvedValue(undefined);
  });

  it('does not fetch the member\'s roles until expanded', () => {
    renderEditor();
    expect(api.listMemberRoles).not.toHaveBeenCalled();
  });

  it('fetches and shows the checklist only after the Manage roles toggle is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(api.listMemberRoles).mockResolvedValue([trusted]);
    renderEditor();

    expect(screen.queryByRole('checkbox', { name: 'Trusted' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Manage roles' }));

    expect(api.listMemberRoles).toHaveBeenCalledWith('s1', 'u1');
    expect(await screen.findByRole('checkbox', { name: 'Trusted' })).toBeChecked();
    // @everyone is not something you can assign/unassign — it must not appear as a checkbox.
    expect(screen.queryByRole('checkbox', { name: '@everyone' })).not.toBeInTheDocument();
  });

  it('assigns a role when its checkbox is checked, and the checklist reflects it once it settles', async () => {
    const user = userEvent.setup();
    vi.mocked(api.listMemberRoles).mockImplementation(async () =>
      vi.mocked(api.assignRole).mock.calls.length > 0 ? [trusted] : [],
    );
    renderEditor();

    await user.click(screen.getByRole('button', { name: 'Manage roles' }));
    const checkbox = await screen.findByRole('checkbox', { name: 'Trusted' });
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);

    expect(api.assignRole).toHaveBeenCalledWith('s1', 'u1', 'role-trusted');
    expect(await screen.findByRole('checkbox', { name: 'Trusted' })).toBeChecked();
  });

  it('unassigns a role when its checked checkbox is unchecked', async () => {
    const user = userEvent.setup();
    vi.mocked(api.listMemberRoles).mockResolvedValue([trusted]);
    renderEditor();

    await user.click(screen.getByRole('button', { name: 'Manage roles' }));
    const checkbox = await screen.findByRole('checkbox', { name: 'Trusted' });
    expect(checkbox).toBeChecked();

    await user.click(checkbox);

    expect(api.unassignRole).toHaveBeenCalledWith('s1', 'u1', 'role-trusted');
  });

  it('disables every role checkbox while an assign/unassign is pending, and re-enables them once it settles', async () => {
    const user = userEvent.setup();
    vi.mocked(api.listMemberRoles).mockResolvedValue([]);
    let resolveAssign: () => void = () => {};
    vi.mocked(api.assignRole).mockReturnValue(
      new Promise((resolve) => {
        resolveAssign = () => resolve(undefined);
      }),
    );
    renderEditor();

    await user.click(screen.getByRole('button', { name: 'Manage roles' }));
    const trustedCheckbox = await screen.findByRole('checkbox', { name: 'Trusted' });
    const verifiedCheckbox = await screen.findByRole('checkbox', { name: 'Verified' });

    await user.click(trustedCheckbox);

    // A second click on the same (or another) checkbox must not fire a race against the
    // assign/unassign already in flight.
    await waitFor(() => expect(trustedCheckbox).toBeDisabled());
    expect(verifiedCheckbox).toBeDisabled();

    resolveAssign();

    await waitFor(() => expect(trustedCheckbox).not.toBeDisabled());
    expect(verifiedCheckbox).not.toBeDisabled();
  });

  it('shows the backend error when assigning a role is rejected', async () => {
    const user = userEvent.setup();
    vi.mocked(api.listMemberRoles).mockResolvedValue([]);
    vi.mocked(api.assignRole).mockRejectedValue(
      new ApiError('Você não pode alterar os cargos de alguém no seu nível ou acima', 403),
    );
    renderEditor();

    await user.click(screen.getByRole('button', { name: 'Manage roles' }));
    await user.click(await screen.findByRole('checkbox', { name: 'Trusted' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/não pode alterar os cargos/);
  });
});
