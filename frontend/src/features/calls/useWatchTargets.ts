import { useState } from 'react';
import type { VoiceParticipant } from '../../types/voice';

export type FocusTarget = { type: 'camera' | 'share'; identity: string };

interface UseWatchTargetsResult {
  watchTargets: FocusTarget[];
  isManual: boolean;
  addWatch: (target: FocusTarget) => void;
  removeWatch: (target: FocusTarget) => void;
  clearManual: () => void;
}

function sameTarget(a: FocusTarget, b: FocusTarget): boolean {
  return a.type === b.type && a.identity === b.identity;
}

/**
 * Resolves the set of camera/share tiles that should occupy the call view's main watched area,
 * per docs/superpowers/specs/2026-09-09-call-grid-unification-multiwatch-design.md §3.
 *
 * `manualWatch === null` means "untouched, use the automatic default." `manualWatch === []`
 * (an explicit empty array) means "the user cleared every watch" — these two must stay
 * distinguishable, or removing the last auto-watched share would instantly reappear next render
 * since there'd be no way to tell "never touched" from "cleared to nothing."
 */
export function useWatchTargets(participants: VoiceParticipant[]): UseWatchTargetsResult {
  const [manualWatch, setManualWatch] = useState<FocusTarget[] | null>(null);

  const sharing = participants.filter((participant) => participant.screenShareTrack);
  const onCamera = participants.filter((participant) => participant.cameraEnabled);

  function isValid(target: FocusTarget): boolean {
    return target.type === 'share'
      ? sharing.some((participant) => participant.identity === target.identity)
      : onCamera.some((participant) => participant.identity === target.identity);
  }

  const isManual = manualWatch !== null;
  const validManual = (manualWatch ?? []).filter(isValid);

  const watchTargets = isManual
    ? validManual
    : sharing.length > 0
      ? [{ type: 'share' as const, identity: sharing[0].identity }]
      : [];

  function addWatch(target: FocusTarget) {
    const base = manualWatch ?? watchTargets;
    if (base.some((existing) => sameTarget(existing, target))) return;
    setManualWatch([...base, target]);
  }

  function removeWatch(target: FocusTarget) {
    const base = manualWatch ?? watchTargets;
    setManualWatch(base.filter((existing) => !sameTarget(existing, target)));
  }

  return {
    watchTargets,
    isManual,
    addWatch,
    removeWatch,
    clearManual: () => setManualWatch(null),
  };
}
