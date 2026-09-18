import {
  HeadphoneOff,
  Headphones,
  Mic,
  MicOff,
  MonitorUp,
  MonitorX,
  PhoneOff,
  Volume2,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Tooltip } from '../../components/Tooltip';
import { voiceClient } from '../../services/voiceClient';
import { useChannel } from '../channels/hooks';
import { hasPermission } from '../../types/permission';
import { useServer } from '../servers/hooks';
import { QUALITY_ICON } from './connectionQuality';
import { ScreenShareQualityModal } from './ScreenShareQualityModal';
import { useVoiceParticipants, useVoiceStatus } from './hooks';

export function VoiceConnectionBar() {
  const { status, channelId, isDeafened } = useVoiceStatus();
  const { data: channel } = useChannel(channelId ?? undefined);
  const { data: server } = useServer(channel?.serverId);
  const navigate = useNavigate();
  const localParticipant = useVoiceParticipants().find((participant) => participant.isLocal);
  const [isQualityModalOpen, setQualityModalOpen] = useState(false);

  // Cosmetic only: without SHARE_SCREEN the LiveKit token omits the screen_share source, so
  // LiveKit itself rejects the track even if this button were somehow reachable.
  const canShareScreen = hasPermission(channel?.permissions, 'SHARE_SCREEN');

  if (status !== 'connected' || !channelId) return null;

  const quality = localParticipant && QUALITY_ICON[localParticipant.connectionQuality];

  function handleLeave() {
    voiceClient.disconnect();
    if (channel?.serverId) {
      navigate(`/app/servers/${channel.serverId}`);
    }
  }

  return (
    <div className="flex flex-shrink-0 items-center gap-3 border-t bg-surface px-4 py-2">
      <Link
        to={`/app/servers/${channel?.serverId}/channels/${channelId}`}
        className="flex min-w-0 flex-col gap-0.5 hover:opacity-80"
      >
        <span className="flex items-center gap-1.5 truncate text-body font-medium text-ink">
          <Volume2 size={16} aria-hidden="true" />
          {channel?.name ?? '…'}
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
          <Tooltip content={localParticipant.micEnabled ? 'Mute' : 'Unmute'}>
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
          </Tooltip>
          <Tooltip content={isDeafened ? 'Undeafen' : 'Deafen'}>
            <button
              type="button"
              aria-label={isDeafened ? 'Undeafen' : 'Deafen'}
              onClick={() => voiceClient.toggleDeafen()}
              className={`flex h-10 w-10 items-center justify-center rounded-full bg-sidebar hover:bg-border ${
                isDeafened ? 'text-danger' : 'text-ink'
              }`}
            >
              {isDeafened ? (
                <HeadphoneOff data-testid="deafen-icon-off" size={18} aria-hidden="true" />
              ) : (
                <Headphones data-testid="deafen-icon-on" size={18} aria-hidden="true" />
              )}
            </button>
          </Tooltip>
          {canShareScreen && (
            <Tooltip content={localParticipant.screenShareEnabled ? 'Stop sharing' : 'Share screen'}>
              <button
                type="button"
                aria-label={localParticipant.screenShareEnabled ? 'Stop sharing' : 'Share screen'}
                onClick={() =>
                  localParticipant.screenShareEnabled ? voiceClient.toggleScreenShare() : setQualityModalOpen(true)
                }
                className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar text-ink hover:bg-border"
              >
                {localParticipant.screenShareEnabled ? (
                  <MonitorX size={18} aria-hidden="true" />
                ) : (
                  <MonitorUp size={18} aria-hidden="true" />
                )}
              </button>
            </Tooltip>
          )}
          <Tooltip content="Leave call">
            <button
              type="button"
              aria-label="Leave call"
              onClick={handleLeave}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-danger/90 text-white hover:bg-danger"
            >
              <PhoneOff size={18} aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      )}
      <ScreenShareQualityModal
        open={isQualityModalOpen}
        onClose={() => setQualityModalOpen(false)}
        onConfirm={(options) => {
          setQualityModalOpen(false);
          voiceClient.toggleScreenShare(options);
        }}
      />
    </div>
  );
}
