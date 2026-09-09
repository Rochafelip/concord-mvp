import { describe, expect, it } from 'vitest';
import { tileColorFor } from './tileColor';

describe('tileColorFor', () => {
  it('is deterministic for the same identity', () => {
    expect(tileColorFor('u1')).toBe('bg-cyan-900');
    expect(tileColorFor('u1')).toBe(tileColorFor('u1'));
  });

  it('picks a different color for a different identity', () => {
    expect(tileColorFor('u2')).toBe('bg-blue-900');
  });
});
