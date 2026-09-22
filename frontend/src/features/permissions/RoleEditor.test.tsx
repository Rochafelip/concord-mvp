import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Role } from '../../types/permission';
import { ApiError } from '../../services/apiClient';
import * as api from './api';
import { RoleEditor } from './RoleEditor';

vi.mock('./api');

const existingRole: Role = {
  id: 'role-1',
  serverId: 's1',
  name: 'Moderator',
  description: 'Keeps things civil',
  color: '#E4572E',
  position: 3,
  isEveryone: false,
  permissions: ['SEND_MESSAGES', 'VIEW_CHANNEL'],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const everyoneRole: Role = {
  ...existingRole,
  id: 'role-everyone',
  name: '@everyone',
  isEveryone: true,
  position: 0,
};

function renderEditor(props: Partial<React.ComponentProps<typeof RoleEditor>> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onDone = vi.fn();
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <RoleEditor
        serverId="s1"
        role={null}
        nextPosition={4}
        currentUserPermissions={['ADMINISTRATOR']}
        onDone={onDone}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { ...utils, onDone };
}

describe('RoleEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.createRole).mockResolvedValue(existingRole);
    vi.mocked(api.updateRole).mockResolvedValue(existingRole);
    vi.mocked(api.deleteRole).mockResolvedValue(undefined);
  });

  it('creates a role with the computed position and no unchecked permissions', async () => {
    const user = userEvent.setup();
    const { onDone } = renderEditor();

    await user.type(screen.getByLabelText('Name'), 'New Role');
    await user.click(screen.getByRole('checkbox', { name: 'Send Messages' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(api.createRole).toHaveBeenCalledWith('s1', {
      name: 'New Role',
      description: null,
      color: null,
      position: 4,
      permissions: ['SEND_MESSAGES'],
    });
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it('prefills the form from the role being edited', () => {
    renderEditor({ role: existingRole });

    expect(screen.getByLabelText('Name')).toHaveValue('Moderator');
    expect(screen.getByLabelText('Description')).toHaveValue('Keeps things civil');
    expect(screen.getByLabelText('Color')).toHaveValue('#E4572E');
    expect(screen.getByRole('checkbox', { name: 'Send Messages' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'View Channel' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Manage Messages' })).not.toBeChecked();
  });

  it('sends only the name when only the name changed', async () => {
    const user = userEvent.setup();
    renderEditor({ role: existingRole });

    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Head Moderator');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(api.updateRole).toHaveBeenCalledWith('role-1', { name: 'Head Moderator' });
  });

  it('sends only permissions when only a permission changed', async () => {
    const user = userEvent.setup();
    renderEditor({ role: existingRole });

    await user.click(screen.getByRole('checkbox', { name: 'Manage Messages' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(api.updateRole).toHaveBeenCalledWith('role-1', {
      permissions: ['SEND_MESSAGES', 'VIEW_CHANNEL', 'MANAGE_MESSAGES'],
    });
  });

  it('blocks submit with an inline error when the name is empty', async () => {
    const user = userEvent.setup();
    renderEditor({ role: existingRole });

    await user.clear(screen.getByLabelText('Name'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/name is required/i);
    expect(api.updateRole).not.toHaveBeenCalled();
  });

  it('blocks submit with an inline error when the color is not a valid hex code', async () => {
    const user = userEvent.setup();
    renderEditor({ role: existingRole });

    await user.clear(screen.getByLabelText('Color'));
    await user.type(screen.getByLabelText('Color'), 'red');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/#rrggbb/i);
    expect(api.updateRole).not.toHaveBeenCalled();
  });

  it('disables the name field entirely when editing @everyone', () => {
    renderEditor({ role: everyoneRole });

    expect(screen.getByLabelText('Name')).toBeDisabled();
  });

  it('hides the delete button for @everyone and shows it for other roles', () => {
    renderEditor({ role: everyoneRole });
    expect(screen.queryByRole('button', { name: 'Delete role' })).not.toBeInTheDocument();

    renderEditor({ role: existingRole });
    expect(screen.getByRole('button', { name: 'Delete role' })).toBeInTheDocument();
  });

  it('deletes the role after confirming, then calls onDone', async () => {
    const user = userEvent.setup();
    const { onDone } = renderEditor({ role: existingRole });

    await user.click(screen.getByRole('button', { name: 'Delete role' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(api.deleteRole).toHaveBeenCalledWith('role-1');
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it('calls onDone without saving when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const { onDone } = renderEditor({ role: existingRole });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(api.updateRole).not.toHaveBeenCalled();
    expect(api.createRole).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalled();
  });

  it('shows the backend error message when the mutation is rejected', async () => {
    const user = userEvent.setup();
    vi.mocked(api.updateRole).mockRejectedValue(
      new ApiError('Você não pode conceder permissões que não possui: MANAGE_ROLES', 403),
    );
    renderEditor({ role: existingRole });

    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Renamed');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/não pode conceder permissões/);
  });
});
