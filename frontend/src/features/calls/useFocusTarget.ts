import { useState } from 'react';
import type { VoiceParticipant } from '../../types/voice';

export type FocusTarget = { type: 'camera' | 'share'; identity: string };

interface UseFocusTargetResult {
  focusTarget: FocusTarget | null;
  isManual: boolean;
  setFocus: (target: FocusTarget) => void;
  clearFocus: () => void;
}

/**
 * Resolves what should occupy the call view's main focused slot, per
 * docs/superpowers/specs/2026-09-09-call-focus-mode-design.md §1: a still-valid manual pin, else
 * the first currently-sharing participant (by array order, not "most recent" — no extra
 * timestamp tracking needed), else null (Phase 1's automatic grid applies). An invalid pin (its
 * participant left, turned off their camera, or stopped sharing) is simply ignored — no effect
 * needed to "clean it up," since this is a pure derivation re-run on every call.
 */
export function useFocusTarget(participants: VoiceParticipant[]): UseFocusTargetResult {
  const [manualFocus, setManualFocus] = useState<FocusTarget | null>(null);

  const sharing = participants.filter((participant) => participant.screenShareTrack);
  const onCamera = participants.filter((participant) => participant.cameraEnabled);

  const manualIsValid =
    manualFocus != null &&
    (manualFocus.type === 'share'
      ? sharing.some((participant) => participant.identity === manualFocus.identity)
      : onCamera.some((participant) => participant.identity === manualFocus.identity));

  const autoFocus: FocusTarget | null = sharing.length > 0 ? { type: 'share', identity: sharing[0].identity } : null;

  return {
    focusTarget: manualIsValid ? manualFocus : autoFocus,
    isManual: manualIsValid,
    setFocus: setManualFocus,
    clearFocus: () => setManualFocus(null),
  };
}
