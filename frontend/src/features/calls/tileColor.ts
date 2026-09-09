// Literal colors (not theme tokens), same as ParticipantTile's other overlay chrome — must read
// the same in both themes, and must contrast with the white text/icons drawn on top.
const TILE_COLORS = [
  'bg-rose-900',
  'bg-orange-900',
  'bg-amber-900',
  'bg-emerald-900',
  'bg-cyan-900',
  'bg-blue-900',
  'bg-violet-900',
  'bg-fuchsia-900',
] as const;

/** Deterministic per-participant tile background: same identity always picks the same color. */
export function tileColorFor(identity: string): string {
  let hash = 0;
  for (let index = 0; index < identity.length; index++) {
    hash = (hash * 31 + identity.charCodeAt(index)) | 0;
  }
  return TILE_COLORS[Math.abs(hash) % TILE_COLORS.length];
}
