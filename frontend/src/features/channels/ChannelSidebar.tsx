import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Avatar } from '../../components/Avatar';
import { VoiceConnectionBar } from '../calls/VoiceConnectionBar';
import { useVoicePresence } from '../calls/hooks';
import { useIsServerOwner, useServer } from '../servers/hooks';
import { ServerSettingsPanel } from '../servers/ServerSettingsPanel';
import { CreateChannelModal } from './CreateChannelModal';
import { useChannels } from './hooks';

function channelLinkClassName(isSelected: boolean) {
  return `flex items-center gap-1.5 rounded px-2 py-1 text-sm ${
    isSelected ? 'bg-indigo-100 text-indigo-900' : 'text-gray-700 hover:bg-gray-200'
  }`;
}

/**
 * Rendered for the currently-selected server (:serverId from the URL, same
 * URL-as-source-of-truth pattern as ServerSidebar). Lists channels grouped by type and hosts
 * the server header (name + settings gear) since that's the natural place for it.
 */
export function ChannelSidebar() {
  const { serverId, channelId } = useParams<{ serverId: string; channelId?: string }>();
  const { data: server } = useServer(serverId);
  const { data: channels } = useChannels(serverId);
  const { data: voicePresence } = useVoicePresence(serverId);
  const isOwner = useIsServerOwner(serverId);
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (!serverId) return null;

  const onboardingChannels = (channels ?? []).filter((channel) => channel.type === 'ONBOARDING');
  const textChannels = (channels ?? []).filter((channel) => channel.type === 'TEXT');
  const voiceChannels = (channels ?? []).filter((channel) => channel.type === 'VOICE');

  return (
    <aside className="flex w-56 flex-shrink-0 flex-col border-r border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-3">
        <span className="truncate font-semibold text-gray-900">{server?.name ?? 'Loading…'}</span>
        <button
          type="button"
          aria-label="Server settings"
          onClick={() => setSettingsOpen(true)}
          className="flex-shrink-0 text-gray-500 hover:text-gray-900"
        >
          ⚙
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
        <div>
          <h3 className="px-1 text-xs font-semibold uppercase text-gray-500">Onboarding</h3>
          <ul className="mt-1 space-y-0.5">
            {onboardingChannels.map((channel) => (
              <li key={channel.id}>
                <Link
                  to={`/app/servers/${serverId}/channels/${channel.id}`}
                  aria-current={channel.id === channelId ? 'page' : undefined}
                  className={channelLinkClassName(channel.id === channelId)}
                >
                  <span aria-hidden="true">👋</span>
                  {channel.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold uppercase text-gray-500">Text channels</h3>
            {isOwner && (
              <button
                type="button"
                aria-label="Create channel"
                onClick={() => setCreateOpen(true)}
                className="text-lg leading-none text-gray-500 hover:text-gray-900"
              >
                +
              </button>
            )}
          </div>
          <ul className="mt-1 space-y-0.5">
            {textChannels.map((channel) => (
              <li key={channel.id}>
                <Link
                  to={`/app/servers/${serverId}/channels/${channel.id}`}
                  aria-current={channel.id === channelId ? 'page' : undefined}
                  className={channelLinkClassName(channel.id === channelId)}
                >
                  <span aria-hidden="true">#</span>
                  {channel.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="px-1 text-xs font-semibold uppercase text-gray-500">Voice channels</h3>
          <ul className="mt-1 space-y-0.5">
            {voiceChannels.map((channel) => {
              const participants = (voicePresence ?? []).filter((entry) => entry.channelId === channel.id);
              return (
                <li key={channel.id}>
                  <Link
                    to={`/app/servers/${serverId}/channels/${channel.id}`}
                    aria-current={channel.id === channelId ? 'page' : undefined}
                    className={channelLinkClassName(channel.id === channelId)}
                  >
                    <span aria-hidden="true">🔊</span>
                    {channel.name}
                  </Link>
                  {participants.length > 0 && (
                    <ul className="ml-5 mt-0.5 space-y-0.5">
                      {participants.map((participant) => (
                        <li key={participant.userId} className="flex items-center gap-1.5 px-1 py-0.5">
                          <Avatar
                            displayName={participant.displayName}
                            avatarUrl={participant.avatarUrl}
                            className={`h-5 w-5 flex-shrink-0 text-xs ${participant.speaking ? 'ring-2 ring-green-500' : ''}`}
                          />
                          <span className="truncate text-xs text-gray-600">{participant.displayName}</span>
                          <span className="ml-auto flex flex-shrink-0 gap-0.5 text-xs">
                            {participant.muted && <span aria-label="Muted">🔇</span>}
                            {participant.cameraOn && <span aria-label="Camera on">📹</span>}
                            {participant.screenSharing && <span aria-label="Sharing screen">🖥️</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <VoiceConnectionBar />

      <CreateChannelModal serverId={serverId} open={createOpen} onClose={() => setCreateOpen(false)} />
      <ServerSettingsPanel serverId={serverId} open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </aside>
  );
}
