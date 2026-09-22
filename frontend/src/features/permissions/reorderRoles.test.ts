import { describe, expect, it } from 'vitest';
import { computeReorderedPositions } from './reorderRoles';

function role(id: string, position: number) {
  return { id, position };
}

describe('computeReorderedPositions', () => {
  it('returns no updates when the item is dropped back in the same place', () => {
    const ranked = [role('a', 3), role('b', 2), role('c', 1)];

    expect(computeReorderedPositions(ranked, 1, 1)).toEqual([]);
  });

  it('swaps positions for an adjacent move, same as the old up/down buttons did', () => {
    const ranked = [role('a', 3), role('b', 2), role('c', 1)];

    // Drag "b" (index 1) up to index 0.
    expect(computeReorderedPositions(ranked, 1, 0)).toEqual(
      expect.arrayContaining([
        { roleId: 'b', position: 3 },
        { roleId: 'a', position: 2 },
      ]),
    );
  });

  it('only includes roles whose position actually changed for a multi-step move', () => {
    const ranked = [role('a', 4), role('b', 3), role('c', 2), role('d', 1)];

    // Drag "a" (index 0) down to index 2: b and c shift up one slot, a takes c's old slot, d is untouched.
    const updates = computeReorderedPositions(ranked, 0, 2);

    expect(updates).toEqual(
      expect.arrayContaining([
        { roleId: 'b', position: 4 },
        { roleId: 'c', position: 3 },
        { roleId: 'a', position: 2 },
      ]),
    );
    expect(updates).toHaveLength(3);
    expect(updates.some((u) => u.roleId === 'd')).toBe(false);
  });
});
