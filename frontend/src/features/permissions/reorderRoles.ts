import { arrayMove } from '@dnd-kit/sortable';

interface RankedRole {
  id: string;
  position: number;
}

interface PositionUpdate {
  roleId: string;
  position: number;
}

/**
 * The set of position values never changes on a drag — only which role holds which value does.
 * Reassigns the original (sorted-desc) position values to whichever role now sits at each index,
 * and returns only the roles whose value actually changed, since `useUpdateRolePositions`
 * batches them into a single PUT and there is no reason to send no-ops.
 */
export function computeReorderedPositions(
  ranked: RankedRole[],
  oldIndex: number,
  newIndex: number,
): PositionUpdate[] {
  const positions = ranked.map((role) => role.position);
  const reordered = arrayMove(ranked, oldIndex, newIndex);

  return reordered
    .map((role, index) => ({ roleId: role.id, position: positions[index], changed: role.position !== positions[index] }))
    .filter((update) => update.changed)
    .map(({ roleId, position }) => ({ roleId, position }));
}
