import { Maximize2, Mic, MicOff, Minimize2, MonitorUp, PhoneOff } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { voiceClient } from '../../services/voiceClient';
import type { VoiceParticipant } from '../../types/voice';
import { useVoiceParticipants } from './hooks';
import { VolumeControl } from './VolumeControl';

interface ScreenShareTileProps {
  participant: VoiceParticipant;
  /** Extra classes appended alongside the tile's default w-full aspect-video sizing — used when
   * this tile sits in FocusedCallView's tiered watched area instead of standing alone. */
  className?: string;
  /** When provided (and the participant isn't local — you can't "un-watch" your own share), the
   * whole tile becomes a clickable/keyboard-activatable target (role="button") that removes this
   * share from the call's watched set. Only wired on the non-fullscreen layout — see
   * docs/superpowers/specs/2026-09-09-call-grid-unification-multiwatch-design.md §5. */
  onWatchClick?: () => void;
}

/**
 * Renders one participant's active screen share. Only ever rendered by FocusedCallView for a
 * participant whose screenShareTrack is non-null and who is in the call's watched set — arriving
 * here already IS the explicit opt-in (a click on a ScreenShareThumbnail, or the sole auto-focused
 * share), so there is no separate minimized/"Watch" gate the way there used to be: the <video>
 * always attaches on mount. Same attach/detach-via-ref pattern as ParticipantTile (see its doc
 * comment, and design spec docs/superpowers/specs/2026-09-04-phase4-screenshare-design.md §4.1)
 * for why.
 *
 * Screen-share audio still starts silent for a remote share until the viewer explicitly raises
 * the volume slider (see docs/superpowers/specs/2026-09-08-screenshare-opt-in-watch-design.md) —
 * that's a separate opt-in from video visibility and is unaffected by removing the video gate.
 * The local participant's own share is never silenced.
 *
 * Fills the full width of its wrapping section (w-full) by default — screen content (text, code,
 * slides) is illegible squeezed small — but accepts a className override so FocusedCallView's
 * tiered multi-watch area can size it the same way ParticipantTile's tiles are sized.
 *
 * The fullscreen and volume overlays are hidden until the mouse enters the surrounding watched
 * area (FocusedCallView's `group/camera-grid` container), matching ParticipantTile — the hover
 * zone is the whole call area, not each card. See
 * docs/superpowers/specs/2026-09-09-call-grid-controls-hover-design.md.
 *
 * The root element also doubles as the Fullscreen API target (see
 * docs/superpowers/specs/2026-09-08-fullscreen-screenshare-design.md): fullscreening it hides
 * every other tile and the app shell for free, since the browser puts the fullscreened element
 * alone in the "top layer." onWatchClick is deliberately not wired while fullscreen — exiting the
 * watched set would abruptly kill an active fullscreen session.
 */
export function ScreenShareTile({ participant, className = '', onWatchClick }: ScreenShareTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { screenShareTrack } = participant;
  const localParticipant = useVoiceParticipants().find((candidate) => candidate.isLocal);

  useEffect(() => {
    const element = videoRef.current;
    if (!screenShareTrack || !element) return;
    screenShareTrack.attach(element);
    return () => {
      screenShareTrack.detach(element);
    };
  }, [screenShareTrack]);

  useLayoutEffect(() => {
    if (participant.isLocal || !participant.screenShareHasAudio) return;
    voiceClient.setScreenShareVolume(participant.identity, 0);
  }, [participant.isLocal, participant.identity, participant.screenShareHasAudio]);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!isFullscreen || document.fullscreenElement === containerRef.current) return;
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') setIsFullscreen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  function stopPropagation(event: MouseEvent | KeyboardEvent) {
    event.stopPropagation();
  }

  async function handleEnterFullscreen(event: MouseEvent) {
    stopPropagation(event);
    try {
      await containerRef.current?.requestFullscreen();
    } catch {
      setIsFullscreen(true);
    }
  }

  async function handleExitFullscreen() {
    if (document.fullscreenElement === containerRef.current) {
      await document.exitFullscreen();
    } else {
      setIsFullscreen(false);
    }
  }

  const clickToRemove = !participant.isLocal && !isFullscreen && onWatchClick;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!clickToRemove) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onWatchClick?.();
  }

  return (
    <div
      ref={containerRef}
      role={clickToRemove ? 'button' : undefined}
      tabIndex={clickToRemove ? 0 : undefined}
      aria-label={clickToRemove ? `Stop watching ${participant.name}'s screen` : undefined}
      onClick={clickToRemove ? onWatchClick : undefined}
      onKeyDown={handleKeyDown}
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 flex items-center justify-center bg-gray-900'
          : `relative flex w-full aspect-video items-center justify-center overflow-hidden rounded bg-gray-900 ${className}`
      }
    >
      <video ref={videoRef} muted autoPlay playsInline className="h-full w-full object-contain" />
      {!isFullscreen && (
        <>
          <span className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/50 px-1.5 py-0.5 text-caption text-white">
            <MonitorUp size={12} aria-hidden="true" />
            {participant.name}
            's screen
            {participant.isLocal ? ' (you)' : ''}
          </span>
          <button
            type="button"
            aria-label="Enter fullscreen"
            onClick={handleEnterFullscreen}
            className="absolute left-1 top-1 opacity-0 transition-opacity focus-visible:opacity-100 group-hover/camera-grid:opacity-100"
          >
            <Maximize2 size={16} className="text-white" aria-hidden="true" />
          </button>
          {!participant.isLocal && participant.screenShareHasAudio && participant.screenShareAudioEnabled && (
            <div
              className="absolute right-1 top-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/camera-grid:opacity-100"
              onClick={stopPropagation}
              onKeyDown={stopPropagation}
            >
              <VolumeControl
                label={`${participant.name}'s screen`}
                onVolumeChange={(volume) => voiceClient.setScreenShareVolume(participant.identity, volume)}
                defaultMuted
              />
            </div>
          )}
        </>
      )}
      {isFullscreen && (
        <div className="absolute right-2 top-2 flex items-center gap-1.5 rounded bg-black/60 px-2 py-1.5">
          <button
            type="button"
            aria-label="Exit fullscreen"
            onClick={handleExitFullscreen}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/10"
          >
            <Minimize2 size={18} aria-hidden="true" />
          </button>
          {localParticipant && (
            <button
              type="button"
              aria-label={localParticipant.micEnabled ? 'Mute' : 'Unmute'}
              onClick={() => voiceClient.toggleMute()}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/10"
            >
              {localParticipant.micEnabled ? (
                <Mic size={18} aria-hidden="true" />
              ) : (
                <MicOff size={18} aria-hidden="true" />
              )}
            </button>
          )}
          {!participant.isLocal && participant.screenShareHasAudio && participant.screenShareAudioEnabled && (
            <VolumeControl
              label={`${participant.name}'s screen`}
              onVolumeChange={(volume) => voiceClient.setScreenShareVolume(participant.identity, volume)}
              defaultMuted
            />
          )}
          <button
            type="button"
            aria-label="Leave call"
            onClick={() => voiceClient.disconnect()}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-danger/80"
          >
            <PhoneOff size={18} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
