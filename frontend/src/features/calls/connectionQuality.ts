import type { ConnectionQuality } from 'livekit-client';
import { Signal, SignalHigh, SignalLow, SignalMedium, SignalZero } from 'lucide-react';

/** Icon + text color for each LiveKit connection quality level, shared between VoiceConnectionBar
 * (the local participant's own quality, in the app-shell bar) and ParticipantTile (a remote
 * participant's quality, badged on their tile — see
 * docs/superpowers/specs/2026-09-09-call-grid-layout-design.md §5). */
export const QUALITY_ICON: Record<ConnectionQuality, { Icon: typeof Signal; className: string }> = {
  excellent: { Icon: SignalHigh, className: 'text-success' },
  good: { Icon: SignalMedium, className: 'text-warning' },
  poor: { Icon: SignalLow, className: 'text-danger' },
  lost: { Icon: SignalZero, className: 'text-danger' },
  unknown: { Icon: Signal, className: 'text-muted' },
};
