import { hasPermission, type Permission } from '../../types/permission';
import { NOT_ENFORCED_YET, PERMISSION_GROUPS, permissionLabel } from './permissionLabels';

interface PermissionCheckboxGroupProps {
  value: readonly Permission[];
  /** The current user's own effective permissions — grants beyond this are disabled client-side
   * as a convenience; the backend refuses them regardless (RoleService.requireActorHolds). */
  currentUserPermissions: readonly Permission[];
  onChange: (permissions: Permission[]) => void;
}

export function PermissionCheckboxGroup({ value, currentUserPermissions, onChange }: PermissionCheckboxGroupProps) {
  // Only blocks *granting* a permission you don't hold (RoleService.requireActorHolds only
  // rejects bits newly added to the set) — a box already checked stays togglable so a
  // MANAGE_ROLES-only admin can still strip a permission the role holds that they personally
  // don't, which the backend allows.
  const canToggle = (permission: Permission) =>
    hasPermission(currentUserPermissions, permission) || value.includes(permission);

  function toggle(permission: Permission, checked: boolean) {
    onChange(checked ? [...value, permission] : value.filter((p) => p !== permission));
  }

  return (
    <div className="space-y-4">
      {PERMISSION_GROUPS.map((group) => (
        <fieldset key={group.label} className="space-y-2">
          <legend className="text-body font-medium text-muted">{group.label}</legend>
          <div className="space-y-1">
            {group.permissions.map((permission) => (
              <label key={permission} className="flex items-center gap-2 text-body text-ink">
                <input
                  type="checkbox"
                  aria-label={permissionLabel(permission)}
                  checked={value.includes(permission)}
                  disabled={!canToggle(permission)}
                  onChange={(event) => toggle(permission, event.target.checked)}
                />
                {permissionLabel(permission)}
                {NOT_ENFORCED_YET.has(permission) && (
                  <span className="text-caption text-muted">(Not enforced yet)</span>
                )}
              </label>
            ))}
          </div>
          {group.label === 'Server management' && value.includes('ADMINISTRATOR') && (
            <p className="text-caption text-muted">
              Administrator grants every permission, including future ones.
            </p>
          )}
        </fieldset>
      ))}
    </div>
  );
}
