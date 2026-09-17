import { HeadphoneOff, MicOff, MonitorUp, Plus, Settings, Trash2, Video, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Avatar } from '../../components/Avatar';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { disconnectVoiceParticipant } from '../calls/api';
import { useVoicePresence } from '../calls/hooks';
import { ScreenShareHoverPreview } from '../calls/ScreenShareHoverPreview';
import { useVoiceStore } from '../../stores/voiceStore';
import { useAuthStore } from '../auth/authStore';
import { useHasPermission, useServer } from '../servers/hooks';
import { ServerSettingsPanel } from '../servers/ServerSettingsPanel';
import type { Channel, ChannelType } from '../../types/channel';
import { CreateChannelModal } from './CreateChannelModal';
import { useChannels, useDeleteChannel } from './hooks';

interface ChannelSidebarProps {
  onNavigate?: () => void;
}

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
export function ChannelSidebar({ onNavigate }: ChannelSidebarProps) {
  const { serverId, channelId } = useParams<{ serverId: string; channelId?: string }>();
  const { data: server } = useServer(serverId);
  const { data: channels } = useChannels(serverId);
  const { data: voicePresence } = useVoicePresence(serverId);
  // Channels the user cannot see never arrive from the backend, so there is nothing to filter
  // here — these two only decide which controls to draw.
  const canManageChannels = useHasPermission(serverId, 'MANAGE_CHANNELS');
  const canDisconnect = useHasPermission(serverId, 'DISCONNECT_MEMBERS');
  const currentUserId = useAuthStore((state) => state.user?.id);
  // Only relevant for the hover-preview gate below: previewing a channel you're already
  // connected to would join a second, identically-identified LiveKit session to the same room.
  const activeVoiceChannelId = useVoiceStore((state) => state.channelId);
  const [createType, setCreateType] = useState<Exclude<ChannelType, 'ONBOARDING'> | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [voiceContextUser, setVoiceContextUser] = useState<{ channelId: string; userId: string; displayName: string } | null>(null);
  const [hoveredPreview, setHoveredPreview] = useState<{ channelId: string; identity: string; displayName: string } | null>(null);
  const [channelPendingDeletion, setChannelPendingDeletion] = useState<Channel | null>(null);
  const voiceContextMenuRef = useRef<HTMLDivElement>(null);
  const hoverPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteChannelMutation = useDeleteChannel(serverId);

  // A short delay before opening the preview avoids connecting a LiveKit session for every row the
  // mouse merely passes over while scrolling the list.
  const HOVER_PREVIEW_DELAY_MS = 400;

  function handlePreviewHoverStart(previewChannelId: string, identity: string, displayName: string) {
    if (hoverPreviewTimerRef.current) clearTimeout(hoverPreviewTimerRef.current);
    hoverPreviewTimerRef.current = setTimeout(() => {
      setHoveredPreview({ channelId: previewChannelId, identity, displayName });
    }, HOVER_PREVIEW_DELAY_MS);
  }

  function handlePreviewHoverEnd() {
    if (hoverPreviewTimerRef.current) {
      clearTimeout(hoverPreviewTimerRef.current);
      hoverPreviewTimerRef.current = null;
    }
    setHoveredPreview(null);
  }

  useEffect(() => () => {
    if (hoverPreviewTimerRef.current) clearTimeout(hoverPreviewTimerRef.current);
  }, []);

  function handleDeleteChannel(event: MouseEvent<HTMLButtonElement>, channel: Channel) {
    // The trash icon sits inside the channel's <Link>, so the click must not navigate.
    event.preventDefault();
    event.stopPropagation();
    setChannelPendingDeletion(channel);
  }

  function confirmDeleteChannel() {
    if (!channelPendingDeletion) return;
    deleteChannelMutation.mutate(channelPendingDeletion.id, {
      onSettled: () => setChannelPendingDeletion(null),
    });
  }

  function handleVoiceParticipantContextMenu(event: MouseEvent<HTMLDivElement>, channelId: string, userId: string, displayName: string) {
    if (!canDisconnect || userId === currentUserId) return;
    event.preventDefault();
    setVoiceContextUser({ channelId, userId, displayName });
  }

  useEffect(() => {
    if (!voiceContextUser) return;

    function handlePointerDown(event: PointerEvent) {
      if (!voiceContextMenuRef.current?.contains(event.target as Node)) {
        setVoiceContextUser(null);
      }
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') setVoiceContextUser(null);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [voiceContextUser]);

  function handleChannelClick() {
    onNavigate?.();
  }

  if (!serverId) return null;

  const onboardingChannels = (channels ?? []).filter((channel) => channel.type === 'ONBOARDING');
  const textChannels = (channels ?? []).filter((channel) => channel.type === 'TEXT');
  const voiceChannels = (channels ?? []).filter((channel) => channel.type === 'VOICE');

  return (
    <aside className="flex h-full flex-col border-r bg-sidebar">
      <div className="flex h-16 flex-shrink-0 items-center justify-between border-b px-3">
        <span className="truncate text-heading font-semibold text-ink">{server?.name ?? 'Loading…'}</span>
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
                  onClick={handleChannelClick}
                  aria-current={channel.id === channelId ? 'page' : undefined}
                  className={channelLinkClassName(channel.id === channelId)}
                >
                  <span aria-hidden="true">👋</span>
                  {channel.name}
                  {Number(channel.unreadCount) > 0 && (
                    <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-medium text-white">
                      {Number(channel.unreadCount) > 99 ? '99+' : Number(channel.unreadCount)}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="flex items-center justify-between px-1">
            <h3 className="text-caption font-semibold uppercase text-muted">Text channels</h3>
            {canManageChannels && (
              <button
                type="button"
                aria-label="Create text channel"
                onClick={() => setCreateType('TEXT')}
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
                  onClick={handleChannelClick}
                  aria-current={channel.id === channelId ? 'page' : undefined}
                  className={`flex-1 ${channelLinkClassName(channel.id === channelId)}`}
                >
                  <span aria-hidden="true">#</span>
                  {channel.name}
                  {Number(channel.unreadCount) > 0 && (
                    <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-medium text-white">
                      {Number(channel.unreadCount) > 99 ? '99+' : Number(channel.unreadCount)}
                    </span>
                  )}
                </Link>
                {canManageChannels && (
                  <button
                    type="button"
                    aria-label={`Delete text channel ${channel.name}`}
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
          <div className="flex items-center justify-between px-1">
            <h3 className="text-caption font-semibold uppercase text-muted">Voice channels</h3>
            {canManageChannels && (
              <button
                type="button"
                aria-label="Create voice channel"
                onClick={() => setCreateType('VOICE')}
                className="flex h-8 w-8 items-center justify-center rounded text-muted hover:text-ink"
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            )}
          </div>
          <ul className="mt-1 space-y-0.5">
            {voiceChannels.map((channel) => {
              const participants = (voicePresence ?? []).filter((entry) => entry.channelId === channel.id);
              return (
                <li key={channel.id}>
                  <div className="group flex items-center">
                    <Link
                      to={`/app/servers/${serverId}/channels/${channel.id}`}
                      onClick={onNavigate}
                      aria-current={channel.id === channelId ? 'page' : undefined}
                      className={`flex-1 ${channelLinkClassName(channel.id === channelId)}`}
                    >
                      <Volume2 size={14} aria-hidden="true" />
                      {channel.name}
                    </Link>
                    {canManageChannels && (
                      <button
                        type="button"
                        aria-label={`Delete voice channel ${channel.name}`}
                        onClick={(event) => handleDeleteChannel(event, channel)}
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded text-muted opacity-0 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  {participants.length > 0 && (
                    <ul className="ml-5 mt-0.5 space-y-0.5">
                      {participants.map((participant) => {
                        // Only offer a hover preview when there's actually something to preview,
                        // it's not the viewer's own share, and the viewer isn't already connected
                        // to this channel — joining a second, identically-identified LiveKit
                        // session into a room you're already in would collide (see
                        // useScreenSharePreview's doc comment).
                        const canPreview =
                          participant.screenSharing &&
                          participant.userId !== currentUserId &&
                          activeVoiceChannelId !== channel.id;
                        const isPreviewing =
                          hoveredPreview?.channelId === channel.id && hoveredPreview.identity === participant.userId;

                        return (
                        <li
                          key={participant.userId}
                          className="relative flex items-center gap-1.5 px-1 py-0.5"
                          onMouseEnter={
                            canPreview
                              ? () => handlePreviewHoverStart(channel.id, participant.userId, participant.displayName)
                              : undefined
                          }
                          onMouseLeave={canPreview ? handlePreviewHoverEnd : undefined}
                        >
                          <div
                            className="flex min-w-0 flex-1 items-center gap-1.5"
                            onContextMenu={(event) => handleVoiceParticipantContextMenu(event, channel.id, participant.userId, participant.displayName)}
                          >
                          <Avatar
                            displayName={participant.displayName}
                            avatarUrl={participant.avatarUrl}
                            className={`h-5 w-5 flex-shrink-0 text-caption ${participant.speaking ? 'ring-2 ring-success' : ''}`}
                          />
                          <span className="truncate text-caption text-muted">{participant.displayName}</span>
                          </div>
                          {canDisconnect && participant.userId !== currentUserId && voiceContextUser?.userId === participant.userId && voiceContextUser.channelId === channel.id && (
                            <div ref={voiceContextMenuRef} className="absolute right-0 top-full z-20 min-w-44 rounded border border-border bg-surface p-1 shadow-lg">
                              <button
                                type="button"
                                className="w-full rounded px-2 py-1.5 text-left text-caption text-danger hover:bg-danger/10"
                                onClick={() => {
                                  void disconnectVoiceParticipant(channel.id, participant.userId);
                                  setVoiceContextUser(null);
                                }}
                              >
                                Disconnect from voice
                              </button>
                            </div>
                          )}
                          <span className="ml-auto flex flex-shrink-0 items-center gap-1 text-muted">
                            {participant.deafened ? (
                              <HeadphoneOff aria-label="Deafened" size={14} />
                            ) : (
                              participant.muted && <MicOff aria-label="Muted" size={14} />
                            )}
                            {participant.cameraOn && <Video aria-label="Camera on" size={14} />}
                            {participant.screenSharing && <MonitorUp aria-label="Sharing screen" size={14} />}
                          </span>
                          {isPreviewing && (
                            <ScreenShareHoverPreview
                              channelId={channel.id}
                              identity={participant.userId}
                              displayName={participant.displayName}
                            />
                          )}
                        </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {createType && (
        <CreateChannelModal
          serverId={serverId}
          open
          type={createType}
          onClose={() => setCreateType(null)}
        />
      )}
      <ConfirmDialog
        open={channelPendingDeletion != null}
        title="Delete channel"
        message={`Delete "${channelPendingDeletion?.name}"? This cannot be undone.`}
        confirmLabel="Delete channel"
        pendingLabel="Deleting…"
        destructive
        pending={deleteChannelMutation.isPending}
        onConfirm={confirmDeleteChannel}
        onClose={() => setChannelPendingDeletion(null)}
      />
      <ServerSettingsPanel serverId={serverId} open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </aside>
  );
}
