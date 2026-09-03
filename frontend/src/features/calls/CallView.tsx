import { useEffect } from 'react';
import { voiceClient } from '../../services/voiceClient';
import type { Channel } from '../../types/channel';
import { ParticipantList } from './ParticipantList';
import { VoiceControls } from './VoiceControls';
import { useJoinVoiceChannel } from './hooks';

interface CallViewProps {
  channel: Channel;
}

/**
 * Rendered by ChannelRoute for VOICE channels. Joins on mount and re-joins whenever
 * `channel.id` changes — React Router does not remount this component on a param-only
 * navigation, so switching between two voice channels re-fires the join effect below rather
 * than a fresh mount. voiceClient.connect() itself disconnects any previously connected room
 * before connecting the new one, so no explicit disconnect is needed here between channels —
 * only on a true unmount (leaving the voice UI entirely), handled by the second effect.
 */
export function CallView({ channel }: CallViewProps) {
  const { mutate: joinVoiceChannel } = useJoinVoiceChannel();

  useEffect(() => {
    joinVoiceChannel(channel.id);
  }, [channel.id, joinVoiceChannel]);

  useEffect(() => {
    return () => voiceClient.disconnect();
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-shrink-0 border-b border-gray-200 px-4 py-3">
        <span className="font-semibold text-gray-900">🔊 {channel.name}</span>
      </div>
      <ParticipantList />
      <VoiceControls />
    </div>
  );
}
