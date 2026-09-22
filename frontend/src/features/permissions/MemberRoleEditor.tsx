import { useState } from 'react';
import { Button } from '../../components/Button';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ApiError } from '../../services/apiClient';
import type { Role } from '../../types/permission';
import { useAssignRole, useMemberRoles, useUnassignRole } from './hooks';

interface MemberRoleEditorProps {
  serverId: string;
  userId: string;
  /** The server's full role list, fetched once by the parent rather than per row. */
  roles: Role[];
}

/**
 * Collapsed by default: `useMemberRoles` is only enabled once expanded, so opening the Members
 * tab never fires one roles request per member.
 */
export function MemberRoleEditor({ serverId, userId, roles }: MemberRoleEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const memberRolesQuery = useMemberRoles(serverId, expanded ? userId : undefined);
  const assignMutation = useAssignRole(serverId);
  const unassignMutation = useUnassignRole(serverId);

  const assignable = roles.filter((role) => !role.isEveryone);
  const memberRoleIds = new Set((memberRolesQuery.data ?? []).map((role) => role.id));

  const mutationError = assignMutation.error ?? unassignMutation.error;
  const errorMessage = mutationError instanceof ApiError ? mutationError.message : null;
  // Both mutations are shared across every role's checkbox, so this is deliberately not
  // per-role: a pending assign/unassign disables all of them, closing the window for a second
  // click (on the same or another role) to fire a race against the one already in flight.
  const isMutating = assignMutation.isPending || unassignMutation.isPending;

  function toggle(roleId: string, checked: boolean) {
    if (checked) {
      assignMutation.mutate({ userId, roleId });
    } else {
      unassignMutation.mutate({ userId, roleId });
    }
  }

  return (
    <div>
      <Button variant="secondary" onClick={() => setExpanded((value) => !value)}>
        Manage roles
      </Button>
      <ErrorBanner message={errorMessage} />
      {expanded && (
        <ul className="mt-2 space-y-1">
          {assignable.map((role) => (
            <li key={role.id}>
              <label className="flex items-center gap-2 text-body text-ink">
                <input
                  type="checkbox"
                  aria-label={role.name}
                  checked={memberRoleIds.has(role.id)}
                  disabled={isMutating}
                  onChange={(event) => toggle(role.id, event.target.checked)}
                />
                {role.name}
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
