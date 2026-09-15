import { ConnectionQuality } from 'livekit-client';
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { Avatar } from '../../components/Avatar';
import { Spinner } from '../../components/Spinner';
import { voiceClient } from '../../services/voiceClient';
import { disconnectVoiceParticipant } from './api';
import type { VoiceParticipant } from '../../types/voice';
import { QUALITY_ICON } from './connectionQuality';
import { MicStatusIcon } from './MicStatusIcon';

import { VolumeControl } from './VolumeControl';

interface ParticipantTileProps {
  participant: VoiceParticipant;
  /** Looked up by identity from voice presence data; undefined/null falls back to an initial letter. */
  avatarUrl?: string | null;
  /** From voice presence, looked up by identity in ParticipantList — defaults to false so tiles render correctly before the first presence fetch resolves. */
  deafened?: boolean;
  /** Extra classes appended alongside the tile's default sizing — ParticipantGrid's
   * 1- and 2-participant tiers use this to let a tile fill more space than a fixed grid track. */
  className?: string;
  /** Set to false to suppress the hover volume-control overlay — used when the tile is wrapped
   * in its own click target (e.g. FocusableStrip's focus-picker entries), since nesting a range
   * input inside a button is invalid HTML and would fight the wrapper's click handling. Defaults
   * to true so every existing caller is unaffected. */
  showVolumeControl?: boolean;
  /** When provided, the whole tile becomes a clickable/keyboard-activatable target (role="button",
   * not a real <button> — VolumeControl's <input type="range"> can't legally nest inside one) that
   * adds this camera to the call's watched set. See
   * docs/superpowers/specs/2026-09-09-call-grid-unification-multiwatch-design.md §2. */
  onWatchClick?: () => void;
  canDisconnect?: boolean;
  channelId?: string | null;
}

const CONNECTION_ISSUE_QUALITIES: ConnectionQuality[] = [ConnectionQuality.Poor, ConnectionQuality.Lost];

/**
 * Owns the actual <video> element for one participant's camera tile. Attaches/detaches the
 * livekit-client Track imperatively via a ref + effect — the standard way to bridge a track's
 * imperative attach(element)/detach(element) API into a React-owned DOM node. See the design
 * spec (docs/superpowers/specs/2026-09-03-phase3-camera-design.md §4.1) for why this was chosen
 * over having voiceClient manage video elements itself, the way it does for hidden audio
 * elements.
 *
 * The local participant's own controls (mic/camera/screen-share-audio/leave) live in
 * CallControlBar, rendered once by CallView, not here — see
 * docs/superpowers/specs/2026-09-08-call-view-control-bar-redesign-design.md.
 *
 * The tile background and control-bar chrome (black/white overlays) stay literal colors
 * rather than tokens — they sit on top of live video and must read the same in both themes.
 *
 * Remote volume controls are scoped to each participant tile: hovering a tile reveals its volume
 * icon, and VolumeControl reveals the slider only when the pointer is over that icon.
 */
export function ParticipantTile({
  participant,
  avatarUrl,
  deafened = false,
  className = '',
  showVolumeControl = true,
  onWatchClick,
  canDisconnect = false,
  channelId = null,
}: ParticipantTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const { videoTrack } = participant;
  // livekit-client mutes the camera publication rather than unpublishing it when the camera is
  // turned off, so `videoTrack` stays non-null after that — `cameraEnabled` (isMuted-aware) is
  // what actually reflects on/off state, so it gates the video/avatar switch too.
  const showVideo = videoTrack && participant.cameraEnabled;
  // Camera toggled on but the track hasn't attached yet — without this, that window is
  // indistinguishable from "camera off" (both fall through to the avatar branch).
  const isConnecting = participant.cameraEnabled && !videoTrack;
  const hasConnectionIssue = !participant.isLocal && CONNECTION_ISSUE_QUALITIES.includes(participant.connectionQuality);
  const quality = QUALITY_ICON[participant.connectionQuality];

  useEffect(() => {
    const element = videoRef.current;
    if (!showVideo || !videoTrack || !element) return;
    videoTrack.attach(element);
    return () => {
      videoTrack.detach(element);
    };
  }, [showVideo, videoTrack]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!onWatchClick) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onWatchClick();
  }

  function stopPropagation(event: MouseEvent | KeyboardEvent) {
    event.stopPropagation();
  }

  function handleContextMenu(event: MouseEvent<HTMLDivElement>) {
    if (participant.isLocal || !canDisconnect || !channelId) return;
    event.preventDefault();
    setContextMenuOpen(true);
  }

  useEffect(() => {
    if (!contextMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!contextMenuRef.current?.contains(event.target as Node)) setContextMenuOpen(false);
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') setContextMenuOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenuOpen]);

  return (
    <div
      className={`group/participant-tile relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded ${className} ${
        showVideo ? 'bg-gray-800' : 'bg-gray-800'
      } ${participant.speaking ? 'ring-2 ring-brand/50' : ''}`}
      role={onWatchClick ? 'button' : undefined}
      tabIndex={onWatchClick ? 0 : undefined}
      aria-label={onWatchClick ? `Focus on ${participant.name}'s camera` : undefined}
      onClick={onWatchClick}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
    >
      {showVideo ? (
        <video ref={videoRef} muted autoPlay playsInline className="block h-full w-full object-cover" />
      ) : (
        <Avatar displayName={participant.name} avatarUrl={avatarUrl} size="lg" />
      )}

      {isConnecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <Spinner />
        </div>
      )}

      {hasConnectionIssue && (
        <span
          className="absolute left-1 top-1 rounded bg-black/50 p-1"
          title={participant.connectionQuality}
          aria-label={`Connection: ${participant.connectionQuality}`}
        >
          <quality.Icon size={12} className={quality.className} aria-hidden="true" />
        </span>
      )}

      <span className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/50 px-1.5 py-0.5 text-sm text-white">
        <MicStatusIcon micEnabled={participant.micEnabled} deafened={deafened} />
        {participant.name}
        {participant.isLocal ? ' (you)' : ''}
      </span>

      {!participant.isLocal && showVolumeControl && (
        <div
          className="pointer-events-none absolute right-1 top-1 opacity-0 transition-opacity group-hover/participant-tile:pointer-events-auto group-hover/participant-tile:opacity-100 group-focus-within/participant-tile:pointer-events-auto group-focus-within/participant-tile:opacity-100"
          onClick={stopPropagation}
          onKeyDown={stopPropagation}
        >
          <VolumeControl
            label={participant.name}
            initialVolume={voiceClient.getParticipantVolume(participant.identity)}
            onVolumeChange={(volume) => voiceClient.setParticipantVolume(participant.identity, volume)}
          />
        </div>
      )}
      {contextMenuOpen && canDisconnect && !participant.isLocal && channelId && (
        <div ref={contextMenuRef} className="absolute right-2 top-2 z-20 min-w-44 rounded border border-border bg-surface p-1 shadow-lg" onClick={stopPropagation}>
          <button
            type="button"
            className="w-full rounded px-2 py-1.5 text-left text-caption text-danger hover:bg-danger/10"
            onClick={() => {
              void disconnectVoiceParticipant(channelId, participant.identity);
              setContextMenuOpen(false);
            }}
          >
            Disconnect from voice
          </button>
        </div>
      )}
    </div>
  );
}
