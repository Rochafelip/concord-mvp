import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ALL_PERMISSIONS } from '../../types/permission';
import { PermissionCheckboxGroup } from './PermissionCheckboxGroup';
import { PERMISSION_GROUPS } from './permissionLabels';

describe('PermissionCheckboxGroup', () => {
  it('covers every permission exactly once across the four groups', () => {
    const grouped = PERMISSION_GROUPS.flatMap((group) => group.permissions);
    expect(new Set(grouped)).toEqual(new Set(ALL_PERMISSIONS));
    expect(grouped).toHaveLength(ALL_PERMISSIONS.length);
  });

  it('renders all permissions grouped into four labeled sections', () => {
    render(
      <PermissionCheckboxGroup value={[]} currentUserPermissions={['ADMINISTRATOR']} onChange={() => {}} />,
    );

    expect(screen.getByText('Server management')).toBeInTheDocument();
    expect(screen.getByText('Members')).toBeInTheDocument();
    expect(screen.getByText('Text channels')).toBeInTheDocument();
    expect(screen.getByText('Voice channels')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Manage Roles' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Disconnect Members' })).toBeInTheDocument();
  });

  it('checks the boxes present in value', () => {
    render(
      <PermissionCheckboxGroup
        value={['SEND_MESSAGES', 'CONNECT']}
        currentUserPermissions={['ADMINISTRATOR']}
        onChange={() => {}}
      />,
    );

    expect(screen.getByRole('checkbox', { name: 'Send Messages' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Connect' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'View Channel' })).not.toBeChecked();
  });

  it('calls onChange with the permission added when checking an unchecked box', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PermissionCheckboxGroup
        value={['SEND_MESSAGES']}
        currentUserPermissions={['ADMINISTRATOR']}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole('checkbox', { name: 'View Channel' }));

    expect(onChange).toHaveBeenCalledWith(['SEND_MESSAGES', 'VIEW_CHANNEL']);
  });

  it('calls onChange with the permission removed when unchecking a checked box', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PermissionCheckboxGroup
        value={['SEND_MESSAGES', 'VIEW_CHANNEL']}
        currentUserPermissions={['ADMINISTRATOR']}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole('checkbox', { name: 'View Channel' }));

    expect(onChange).toHaveBeenCalledWith(['SEND_MESSAGES']);
  });

  it('disables a permission the current user does not hold and lacks ADMINISTRATOR for', () => {
    render(
      <PermissionCheckboxGroup
        value={[]}
        currentUserPermissions={['MANAGE_ROLES', 'VIEW_CHANNEL']}
        onChange={() => {}}
      />,
    );

    expect(screen.getByRole('checkbox', { name: 'Manage Roles' })).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: 'View Channel' })).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: 'Ban Members' })).toBeDisabled();
  });

  it('keeps a checked-but-unheld permission enabled so it can still be unchecked (revoking is always allowed)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PermissionCheckboxGroup
        value={['BAN_MEMBERS']}
        currentUserPermissions={['MANAGE_ROLES']}
        onChange={onChange}
      />,
    );

    const banMembers = screen.getByRole('checkbox', { name: 'Ban Members' });
    expect(banMembers).toBeChecked();
    expect(banMembers).toBeEnabled();

    await user.click(banMembers);

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('enables every checkbox when the current user holds ADMINISTRATOR', () => {
    render(
      <PermissionCheckboxGroup value={[]} currentUserPermissions={['ADMINISTRATOR']} onChange={() => {}} />,
    );

    expect(screen.getByRole('checkbox', { name: 'Ban Members' })).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: 'Move Members' })).toBeEnabled();
  });

  it('shows a hint when Administrator is checked, without disabling the other boxes', () => {
    render(
      <PermissionCheckboxGroup
        value={['ADMINISTRATOR']}
        currentUserPermissions={['ADMINISTRATOR']}
        onChange={() => {}}
      />,
    );

    expect(screen.getByText(/administrator grants every permission/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Send Messages' })).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: 'Send Messages' })).not.toBeChecked();
  });

  it('tags permissions that are not enforced yet', () => {
    render(
      <PermissionCheckboxGroup value={[]} currentUserPermissions={['ADMINISTRATOR']} onChange={() => {}} />,
    );

    const banMembers = screen.getByRole('checkbox', { name: 'Ban Members' });
    const banMembersRow = banMembers.closest('label');
    expect(banMembersRow).not.toBeNull();
    expect(banMembersRow!.textContent).toMatch(/not enforced yet/i);

    const sendMessages = screen.getByRole('checkbox', { name: 'Send Messages' });
    const sendMessagesRow = sendMessages.closest('label');
    expect(sendMessagesRow!.textContent).not.toMatch(/not enforced yet/i);
  });
});
