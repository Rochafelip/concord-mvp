import { HeadphoneOff, Mic, MicOff } from 'lucide-react';

interface MicStatusIconProps {
  micEnabled: boolean;
  deafened?: boolean;
  size?: number;
}

/**
 * The three-way mic/deafened icon shown in a participant's name pill, shared between
 * ParticipantTile (camera grid) and OffCameraRoster (off-camera strip) so both read identically.
 */
export function MicStatusIcon({ micEnabled, deafened = false, size = 12 }: MicStatusIconProps) {
  if (deafened) {
    return <HeadphoneOff data-testid="deaf-status-on" size={size} aria-hidden="true" />;
  }
  return micEnabled ? (
    <Mic data-testid="mic-status-on" size={size} aria-hidden="true" />
  ) : (
    <MicOff data-testid="mic-status-off" size={size} aria-hidden="true" />
  );
}
