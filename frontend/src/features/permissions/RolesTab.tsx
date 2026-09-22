import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ApiError } from '../../services/apiClient';
import type { Permission, Role } from '../../types/permission';
import { computeReorderedPositions } from './reorderRoles';
import { RoleEditor } from './RoleEditor';
import { useDeleteRole, useMemberRoles, useRoles, useUpdateRolePositions } from './hooks';

interface SortableRoleRowProps {
  role: Role;
  /** The color dot + name, unchanged from the previous non-sortable row. */
  label: ReactNode;
  /** Edit/Delete role buttons, unchanged from the previous non-sortable row. */
  actions: ReactNode;
}

function SortableRoleRow({ role, label, actions }: SortableRoleRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: role.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center justify-between gap-2 rounded px-2 py-1 ${isDragging ? 'opacity-50' : ''}`}
    >
      <span className="flex items-center gap-2 text-body text-ink">
        <button
          type="button"
          aria-label={`Reorder ${role.name}`}
          {...attributes}
          {...listeners}
          className="cursor-grab text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <GripVertical size={16} aria-hidden="true" />
        </button>
        {label}
      </span>
      <span className="flex items-center gap-1">{actions}</span>
    </li>
  );
}

interface RolesTabProps {
  serverId: string;
  currentUserId: string | undefined;
  /** The owner is exempt from the hierarchy entirely (RoleService/PermissionService treat it as
   * Integer.MAX_VALUE) — never derivable from any role the owner happens to hold. */
  isOwner: boolean;
  currentUserPermissions: readonly Permission[];
}

export function RolesTab({ serverId, currentUserId, isOwner, currentUserPermissions }: RolesTabProps) {
  const { data: roles } = useRoles(serverId);
  const updatePositionsMutation = useUpdateRolePositions(serverId);
  const deleteRoleMutation = useDeleteRole(serverId);
  // Only meaningful for a non-owner: the position rule below needs the actor's own rank, which
  // is the highest `position` among their own effective roles (same source RoleService itself
  // reads from). Harmless to fetch for the owner too — it's just unused in that branch.
  const ownRolesQuery = useMemberRoles(serverId, isOwner ? undefined : currentUserId);

  const [editing, setEditing] = useState<{ role: Role | null } | null>(null);
  const [deleting, setDeleting] = useState<Role | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ranked = (roles ?? []).filter((role) => !role.isEveryone);
  const everyoneRole = (roles ?? []).find((role) => role.isEveryone) ?? null;

  const ownHighestPosition = isOwner
    ? Number.POSITIVE_INFINITY
    : Math.max(0, ...(ownRolesQuery.data ?? []).map((role) => role.position));
  // A non-owner ranked 0 (only @everyone) has no position strictly below them to create into —
  // RoleService.requireBelowActor rejects every position in that case, by design (see the design
  // doc and RoleService's own comment on this: MANAGE_ROLES belongs on a role above @everyone).
  const canCreate = isOwner || ownHighestPosition > 0;
  // The list is sorted by position desc, so ranked[0] holds the server-wide highest position —
  // that's only a safe target for the owner, who is exempt from the hierarchy check. Anyone else
  // must land strictly below their OWN highest role, not the server's.
  const nextPosition = Number.isFinite(ownHighestPosition)
    ? ownHighestPosition - 1
    : (ranked[0]?.position ?? 0) + 1;

  const reorderError = updatePositionsMutation.error;
  const deleteError = deleteRoleMutation.error;
  const errorMessage =
    (reorderError instanceof ApiError ? reorderError.message : null) ??
    (deleteError instanceof ApiError ? deleteError.message : null);

  if (editing != null) {
    return (
      <RoleEditor
        serverId={serverId}
        role={editing.role}
        nextPosition={nextPosition}
        currentUserPermissions={currentUserPermissions}
        onDone={() => setEditing(null)}
      />
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over == null || active.id === over.id) return;

    const oldIndex = ranked.findIndex((role) => role.id === active.id);
    const newIndex = ranked.findIndex((role) => role.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const updates = computeReorderedPositions(ranked, oldIndex, newIndex);
    if (updates.length > 0) updatePositionsMutation.mutate(updates);
  }

  function confirmDelete() {
    if (deleting == null) return;
    deleteRoleMutation.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
  }

  return (
    <div className="space-y-4">
      <ErrorBanner message={errorMessage} />

      <div className="flex justify-end">
        <Button
          onClick={() => setEditing({ role: null })}
          disabled={!canCreate}
          title={canCreate ? undefined : 'You need a role above @everyone to create new roles.'}
        >
          Create role
        </Button>
      </div>

      <ul className="space-y-1">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ranked.map((role) => role.id)} strategy={verticalListSortingStrategy}>
            {ranked.map((role) => (
              <SortableRoleRow
                key={role.id}
                role={role}
                label={
                  <>
                    <span
                      aria-hidden="true"
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: role.color ?? '#99A1AF' }}
                    />
                    {role.name}
                  </>
                }
                actions={
                  <>
                    <Button variant="secondary" onClick={() => setEditing({ role })}>
                      Edit
                    </Button>
                    <Button variant="danger" onClick={() => setDeleting(role)}>
                      Delete role
                    </Button>
                  </>
                }
              />
            ))}
          </SortableContext>
        </DndContext>

        {everyoneRole != null && (
          <li className="flex items-center justify-between gap-2 border-t border-border px-2 pt-2 text-muted">
            <span className="flex items-center gap-2 text-body">
              <span aria-hidden="true" className="h-3 w-3 rounded-full bg-muted" />
              {everyoneRole.name}
            </span>
            <span className="text-caption">everyone has this role</span>
          </li>
        )}
      </ul>

      {deleting != null && (
        <ConfirmDialog
          open
          title={`Delete ${deleting.name}?`}
          message="Members will lose whatever this role grants them immediately. This can't be undone."
          confirmLabel="Delete"
          destructive
          pending={deleteRoleMutation.isPending}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
