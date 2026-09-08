import { MicOff, MonitorUp, Plus, Settings, Trash2, Video, Volume2 } from 'lucide-react';
import { useState, type MouseEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Avatar } from '../../components/Avatar';
import { useVoicePresence } from '../calls/hooks';
import { useIsServerOwner, useServer } from '../servers/hooks';
import { ServerSettingsPanel } from '../servers/ServerSettingsPanel';
import type { Channel } from '../../types/channel';
import { CreateChannelModal } from './CreateChannelModal';
import { useChannels, useDeleteChannel } from './hooks';

function channelLinkClassName(isSelected: boolean) {
  return `flex items-center gap-1.5 rounded px-2 py-1 text-body ${
    isSelected ? 'bg-brand/10 text-brand' : 'text-muted hover:bg-border/40'
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
  const deleteChannelMutation = useDeleteChannel(serverId);

  function handleDeleteChannel(event: MouseEvent<HTMLButtonElement>, channel: Channel) {
    event.preventDefault();
    event.stopPropagation();
    if (window.confirm(`Delete channel "${channel.name}"? This cannot be undone.`)) {
      deleteChannelMutation.mutate(channel.id);
    }
  }

  if (!serverId) return null;

  const onboardingChannels = (channels ?? []).filter((channel) => channel.type === 'ONBOARDING');
  const textChannels = (channels ?? []).filter((channel) => channel.type === 'TEXT');
  const voiceChannels = (channels ?? []).filter((channel) => channel.type === 'VOICE');

  return (
    <aside className="flex w-56 flex-shrink-0 flex-col border-r bg-sidebar">
      <div className="flex items-center justify-between border-b px-3 py-3">
        <span className="truncate font-semibold text-ink">{server?.name ?? 'Loading…'}</span>
        <button
          type="button"
          aria-label="Server settings"
          onClick={() => setSettingsOpen(true)}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded text-muted hover:text-ink"
        >
          <Settings size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
        <div>
          <h3 className="px-1 text-caption font-semibold uppercase text-muted">Onboarding</h3>
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
            <h3 className="text-caption font-semibold uppercase text-muted">Text channels</h3>
            {isOwner && (
              <button
                type="button"
                aria-label="Create channel"
                onClick={() => setCreateOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded text-muted hover:text-ink"
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            )}
          </div>
          <ul className="mt-1 space-y-0.5">
            {textChannels.map((channel) => (
              <li key={channel.id} className="group flex items-center">
                <Link
                  to={`/app/servers/${serverId}/channels/${channel.id}`}
                  aria-current={channel.id === channelId ? 'page' : undefined}
                  className={`flex-1 ${channelLinkClassName(channel.id === channelId)}`}
                >
                  <span aria-hidden="true">#</span>
                  {channel.name}
                </Link>
                {isOwner && (
                  <button
                    type="button"
                    aria-label="Delete channel"
                    onClick={(event) => handleDeleteChannel(event, channel)}
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded text-muted opacity-0 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="px-1 text-caption font-semibold uppercase text-muted">Voice channels</h3>
          <ul className="mt-1 space-y-0.5">
            {voiceChannels.map((channel) => {
              const participants = (voicePresence ?? []).filter((entry) => entry.channelId === channel.id);
              return (
                <li key={channel.id}>
                  <div className="group flex items-center">
                    <Link
                      to={`/app/servers/${serverId}/channels/${channel.id}`}
                      aria-current={channel.id === channelId ? 'page' : undefined}
                      className={`flex-1 ${channelLinkClassName(channel.id === channelId)}`}
                    >
                      <Volume2 size={14} aria-hidden="true" />
                      {channel.name}
                    </Link>
                    {isOwner && (
                      <button
                        type="button"
                        aria-label="Delete channel"
                        onClick={(event) => handleDeleteChannel(event, channel)}
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded text-muted opacity-0 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  {participants.length > 0 && (
                    <ul className="ml-5 mt-0.5 space-y-0.5">
                      {participants.map((participant) => (
                        <li key={participant.userId} className="flex items-center gap-1.5 px-1 py-0.5">
                          <Avatar
                            displayName={participant.displayName}
                            avatarUrl={participant.avatarUrl}
                            className={`h-5 w-5 flex-shrink-0 text-caption ${participant.speaking ? 'ring-2 ring-success' : ''}`}
                          />
                          <span className="truncate text-caption text-muted">{participant.displayName}</span>
                          <span className="ml-auto flex flex-shrink-0 items-center gap-1 text-muted">
                            {participant.muted && <MicOff aria-label="Muted" size={14} />}
                            {participant.cameraOn && <Video aria-label="Camera on" size={14} />}
                            {participant.screenSharing && <MonitorUp aria-label="Sharing screen" size={14} />}
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

      <CreateChannelModal serverId={serverId} open={createOpen} onClose={() => setCreateOpen(false)} />
      <ServerSettingsPanel serverId={serverId} open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </aside>
  );
}
