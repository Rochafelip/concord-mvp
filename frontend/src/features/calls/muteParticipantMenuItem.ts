import type { ContextMenuItem } from '../../components/ContextMenu';
import { voiceClient } from '../../services/voiceClient';

/**
 * "Silenciar" — one-way local mute for a voice/video participant, reused by every context menu
 * that offers voice actions (ChannelSidebar's voice list, ParticipantTile, OffCameraRoster).
 * Unmuting goes through the existing VolumeControl slider on the tile, which already treats a
 * volume of 0 as muted and restores to a sensible default — no separate "remembered level" is
 * tracked here, so this stays a plain one-way action instead of a stateful toggle.
 */
export function muteParticipantMenuItem(identity: string): ContextMenuItem {
  return {
    label: 'Silenciar',
    onSelect: () => voiceClient.setParticipantVolume(identity, 0),
  };
}
