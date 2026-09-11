import { Volume2 } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { voiceClient } from '../../services/voiceClient';
import { ApiError } from '../../services/apiClient';
import { useVoiceStore } from '../../stores/voiceStore';
import type { Channel } from '../../types/channel';
import { CallControlBar } from './CallControlBar';
import { ParticipantList } from './ParticipantList';
import { useJoinVoiceChannel } from './hooks';

interface CallViewProps {
  channel: Channel;
}

/**
 * Rendered by ChannelRoute for VOICE channels. Joins on mount and re-joins whenever
 * `channel.id` changes — React Router does not remount this component on a param-only
 * navigation, so switching between two voice channels re-fires the join effect below rather
 * than a fresh mount. voiceClient.connect() itself disconnects any previously connected room
 * before connecting the new one, so no explicit disconnect is needed here between channels.
 *
 * Deliberately does NOT disconnect on unmount: navigating away from this screen (to a text
 * channel, another server, etc.) must not end the call — it keeps running in the background
 * until the user explicitly leaves, via handleLeave below or VoiceConnectionBar's Leave button.
 */
export function CallView({ channel }: CallViewProps) {
  const joinVoiceMutation = useJoinVoiceChannel();
  const navigate = useNavigate();

  useEffect(() => {
    const voiceState = useVoiceStore.getState();
    if (voiceState.channelId === channel.id && voiceState.status !== 'disconnected') {
      return;
    }
    joinVoiceMutation.mutate(channel.id);
  }, [channel.id, joinVoiceMutation]);

  function handleLeave() {
    voiceClient.disconnect();
    navigate(`/app/servers/${channel.serverId}`, { replace: true });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 flex-shrink-0 items-center gap-1.5 border-b bg-surface px-4">
        <Volume2 size={16} className="text-muted" aria-hidden="true" />
        <span className="text-heading font-semibold text-ink">{channel.name}</span>
      </div>
      <div className="relative flex flex-1 flex-col overflow-hidden bg-gray-950">
        {joinVoiceMutation.error && (
          <div className="absolute left-4 right-4 top-4 z-10 rounded border border-warning/40 bg-warning/15 p-3 text-body text-ink">
            {joinVoiceMutation.error instanceof ApiError
              ? joinVoiceMutation.error.message
              : 'Não foi possível entrar no chat de voz. Verifique sua conta e tente novamente.'}
          </div>
        )}
        <ParticipantList serverId={channel.serverId} />
        <CallControlBar onLeave={handleLeave} />
      </div>
    </div>
  );
}
