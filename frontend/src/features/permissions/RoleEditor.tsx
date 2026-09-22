import { useState } from 'react';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorBanner } from '../../components/ErrorBanner';
import { TextInput } from '../../components/TextInput';
import { ApiError } from '../../services/apiClient';
import type { Permission, Role } from '../../types/permission';
import type { CreateRolePayload, UpdateRolePayload } from './api';
import { useCreateRole, useDeleteRole, useUpdateRole } from './hooks';
import { PermissionCheckboxGroup } from './PermissionCheckboxGroup';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const SWATCH_FALLBACK = '#99A1AF';

interface RoleEditorProps {
  serverId: string;
  /** null means "creating a new role". */
  role: Role | null;
  /** Where a new role lands in the hierarchy. Ignored when editing. */
  nextPosition: number;
  currentUserPermissions: readonly Permission[];
  onDone: () => void;
}

export function RoleEditor({ serverId, role, nextPosition, currentUserPermissions, onDone }: RoleEditorProps) {
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [color, setColor] = useState(role?.color ?? '');
  const [permissions, setPermissions] = useState<Permission[]>(role?.permissions ?? []);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const createRoleMutation = useCreateRole(serverId);
  const updateRoleMutation = useUpdateRole(serverId);
  const deleteRoleMutation = useDeleteRole(serverId);

  const mutationError = createRoleMutation.error ?? updateRoleMutation.error ?? deleteRoleMutation.error;
  const errorMessage = formError ?? (mutationError instanceof ApiError ? mutationError.message : null);

  function handleSave() {
    setFormError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('Name is required.');
      return;
    }
    const trimmedColor = color.trim();
    if (trimmedColor && !HEX_COLOR.test(trimmedColor)) {
      setFormError('Color must be in #RRGGBB format.');
      return;
    }

    if (role == null) {
      const payload: CreateRolePayload = {
        name: trimmedName,
        description: description.trim() || null,
        color: trimmedColor || null,
        position: nextPosition,
        permissions,
      };
      createRoleMutation.mutate(payload, { onSuccess: onDone });
      return;
    }

    // Partial update: only fields that actually changed go in, so an untouched `permissions`
    // (for example) stays out entirely rather than re-sent as-is — RoleService only skips the
    // "can't grant what you don't hold" check when the field is absent (see the design doc).
    const payload: UpdateRolePayload = {};
    if (trimmedName !== role.name) payload.name = trimmedName;
    if (description.trim() !== (role.description ?? '')) payload.description = description.trim() || null;
    if (trimmedColor !== (role.color ?? '')) payload.color = trimmedColor || null;
    if (!samePermissionSet(permissions, role.permissions)) payload.permissions = permissions;

    updateRoleMutation.mutate({ roleId: role.id, ...payload }, { onSuccess: onDone });
  }

  function handleDelete() {
    if (role == null) return;
    deleteRoleMutation.mutate(role.id, { onSuccess: onDone });
  }

  const swatchValue = HEX_COLOR.test(color.trim()) ? color.trim() : SWATCH_FALLBACK;

  return (
    <div className="space-y-4">
      <ErrorBanner message={errorMessage} />

      <TextInput
        id="role-name"
        label="Name"
        value={name}
        maxLength={50}
        disabled={role?.isEveryone}
        onChange={(event) => setName(event.target.value)}
      />

      <label className="block space-y-1 text-body font-medium text-muted">
        Description
        <textarea
          value={description}
          maxLength={200}
          onChange={(event) => setDescription(event.target.value)}
          className="w-full rounded border border-border bg-surface px-3 py-2 text-body text-ink"
        />
      </label>

      <div className="flex items-end gap-2">
        <TextInput
          id="role-color"
          label="Color"
          value={color}
          maxLength={7}
          onChange={(event) => setColor(event.target.value)}
        />
        <input
          type="color"
          aria-label="Pick color"
          value={swatchValue}
          onChange={(event) => setColor(event.target.value)}
          className="h-10 w-10 rounded border border-border"
        />
      </div>

      <PermissionCheckboxGroup
        value={permissions}
        currentUserPermissions={currentUserPermissions}
        onChange={setPermissions}
      />

      <div className="flex justify-between gap-2">
        <div>
          {role != null && !role.isEveryone && (
            <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
              Delete role
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onDone}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={createRoleMutation.isPending || updateRoleMutation.isPending}>
            Save
          </Button>
        </div>
      </div>

      {role != null && (
        <ConfirmDialog
          open={confirmingDelete}
          title={`Delete ${role.name}?`}
          message="Members will lose whatever this role grants them immediately. This can't be undone."
          confirmLabel="Delete"
          destructive
          pending={deleteRoleMutation.isPending}
          onConfirm={handleDelete}
          onClose={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}

function samePermissionSet(a: Permission[], b: Permission[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((item) => setB.has(item));
}
