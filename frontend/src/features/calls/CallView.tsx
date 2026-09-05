import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { voiceClient } from '../../services/voiceClient';
import { useVoiceStore } from '../../stores/voiceStore';
import type { Channel } from '../../types/channel';
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
  const { mutate: joinVoiceChannel } = useJoinVoiceChannel();
  const navigate = useNavigate();

  useEffect(() => {
    const voiceState = useVoiceStore.getState();
    if (voiceState.channelId === channel.id && voiceState.status !== 'disconnected') {
      return;
    }
    joinVoiceChannel(channel.id);
  }, [channel.id, joinVoiceChannel]);

  function handleLeave() {
    voiceClient.disconnect();
    navigate(`/app/servers/${channel.serverId}`);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-shrink-0 border-b border-gray-200 px-4 py-3">
        <span className="font-semibold text-gray-900">🔊 {channel.name}</span>
      </div>
      <ParticipantList onLeave={handleLeave} />
    </div>
  );
}
