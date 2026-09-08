import { Maximize2, Mic, MicOff, Minimize2, MonitorUp, PhoneOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { voiceClient } from '../../services/voiceClient';
import type { VoiceParticipant } from '../../types/voice';
import { useVoiceParticipants } from './hooks';
import { VolumeControl } from './VolumeControl';

interface ScreenShareTileProps {
  participant: VoiceParticipant;
}

/**
 * Renders one participant's active screen share. Only ever rendered by ParticipantList for a
 * participant whose screenShareTrack is non-null, so — unlike ParticipantTile — there is no
 * placeholder branch: a mounted ScreenShareTile always has a track to attach. Same attach/detach-
 * via-ref pattern as ParticipantTile (see its doc comment, and design spec
 * docs/superpowers/specs/2026-09-04-phase4-screenshare-design.md §4.1) for why.
 *
 * Spans the grid's full row width (col-span-full) rather than sharing camera tiles' size —
 * screen content (text, code, slides) is illegible squeezed into a small tile.
 *
 * The root element also doubles as the Fullscreen API target (see
 * docs/superpowers/specs/2026-09-08-fullscreen-screenshare-design.md): fullscreening it hides
 * every other tile and the app shell for free, since the browser puts the fullscreened element
 * alone in the "top layer."
 */
export function ScreenShareTile({ participant }: ScreenShareTileProps) {
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

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!isFullscreen || document.fullscreenElement === containerRef.current) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsFullscreen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  async function handleEnterFullscreen() {
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

  return (
    <div
      ref={containerRef}
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 flex items-center justify-center bg-gray-900'
          : 'group relative col-span-full flex aspect-video items-center justify-center overflow-hidden rounded bg-gray-900'
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
            className="absolute left-1 top-1 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <Maximize2 size={16} className="text-white" aria-hidden="true" />
          </button>
          {!participant.isLocal && participant.screenShareHasAudio && participant.screenShareAudioEnabled && (
            <div className="absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100">
              <VolumeControl
                label={`${participant.name}'s screen`}
                onVolumeChange={(volume) => voiceClient.setScreenShareVolume(participant.identity, volume)}
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
