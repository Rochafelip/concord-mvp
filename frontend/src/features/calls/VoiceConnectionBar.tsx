import type { ConnectionQuality } from 'livekit-client';
import {
  Headphones,
  Mic,
  MicOff,
  PhoneOff,
  Signal,
  SignalHigh,
  SignalLow,
  SignalMedium,
  SignalZero,
  Volume2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { voiceClient } from '../../services/voiceClient';
import { useChannel } from '../channels/hooks';
import { useServer } from '../servers/hooks';
import { useVoiceParticipants, useVoiceStatus } from './hooks';

const QUALITY_ICON: Record<ConnectionQuality, { Icon: typeof Signal; className: string }> = {
  excellent: { Icon: SignalHigh, className: 'text-success' },
  good: { Icon: SignalMedium, className: 'text-warning' },
  poor: { Icon: SignalLow, className: 'text-danger' },
  lost: { Icon: SignalZero, className: 'text-danger' },
  unknown: { Icon: Signal, className: 'text-muted' },
};

export function VoiceConnectionBar() {
  const { status, channelId, isDeafened } = useVoiceStatus();
  const { data: channel } = useChannel(channelId ?? undefined);
  const { data: server } = useServer(channel?.serverId);
  const localParticipant = useVoiceParticipants().find((participant) => participant.isLocal);

  if (status === 'disconnected' || !channelId) return null;

  const quality = localParticipant && QUALITY_ICON[localParticipant.connectionQuality];

  return (
    <div className="flex flex-shrink-0 items-center justify-between gap-3 border-t bg-surface px-4 py-2">
      <Link
        to={`/app/servers/${channel?.serverId}/channels/${channelId}`}
        className="flex min-w-0 flex-col gap-0.5 hover:opacity-80"
      >
        <span className="flex items-center gap-1.5 truncate text-body font-medium text-ink">
          <Volume2 size={16} aria-hidden="true" />
          {status === 'connecting' ? 'Connecting…' : (channel?.name ?? '…')}
          {quality && localParticipant && (
            <span
              title={localParticipant.connectionQuality}
              aria-label={`Connection: ${localParticipant.connectionQuality}`}
            >
              <quality.Icon size={14} className={quality.className} aria-hidden="true" />
            </span>
          )}
        </span>
        {server && <span className="truncate text-caption text-muted">{server.name}</span>}
      </Link>

      {localParticipant && (
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <button
            type="button"
            aria-label={localParticipant.micEnabled ? 'Mute' : 'Unmute'}
            onClick={() => voiceClient.toggleMute()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar text-ink hover:bg-border"
          >
            {localParticipant.micEnabled ? (
              <Mic size={18} aria-hidden="true" />
            ) : (
              <MicOff size={18} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            aria-label={isDeafened ? 'Undeafen' : 'Deafen'}
            onClick={() => voiceClient.toggleDeafen()}
            className={`flex h-10 w-10 items-center justify-center rounded-full bg-sidebar hover:bg-border ${
              isDeafened ? 'text-danger' : 'text-ink'
            }`}
          >
            <Headphones size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Leave call"
            onClick={() => voiceClient.disconnect()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-danger/90 text-white hover:bg-danger"
          >
            <PhoneOff size={18} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
