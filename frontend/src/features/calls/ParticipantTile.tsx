import { useEffect, useRef, useState } from 'react';
import { voiceClient } from '../../services/voiceClient';
import type { VoiceParticipant } from '../../types/voice';
import { ScreenShareQualityModal } from './ScreenShareQualityModal';

interface ParticipantTileProps {
  participant: VoiceParticipant;
  /** Only passed for the local participant's tile — renders the in-tile control bar. */
  onLeave?: () => void;
}

/**
 * Owns the actual <video> element for one participant's camera tile. Attaches/detaches the
 * livekit-client Track imperatively via a ref + effect — the standard way to bridge a track's
 * imperative attach(element)/detach(element) API into a React-owned DOM node. See the design
 * spec (docs/superpowers/specs/2026-09-03-phase3-camera-design.md §4.1) for why this was chosen
 * over having voiceClient manage video elements itself, the way it does for hidden audio
 * elements.
 */
export function ParticipantTile({ participant, onLeave }: ParticipantTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { videoTrack } = participant;
  const isLocal = participant.isLocal && onLeave;
  const [isQualityModalOpen, setQualityModalOpen] = useState(false);

  useEffect(() => {
    const element = videoRef.current;
    if (!videoTrack || !element) return;
    videoTrack.attach(element);
    return () => {
      videoTrack.detach(element);
    };
  }, [videoTrack]);

  return (
    <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded bg-gray-800">
      {videoTrack ? (
        <video ref={videoRef} muted autoPlay playsInline className="h-full w-full object-cover" />
      ) : (
        <span className="text-2xl font-semibold text-gray-100" aria-hidden="true">
          {participant.name.charAt(0).toUpperCase()}
        </span>
      )}

      {/* Name/mic label: bottom-left for everyone else, top-left for the local tile so it
          doesn't collide with the control bar docked at the bottom below. */}
      <span
        className={`absolute left-1 flex items-center gap-1 rounded bg-black/50 px-1.5 py-0.5 text-xs text-white ${isLocal ? 'top-1' : 'bottom-1'}`}
      >
        <span aria-hidden="true">{participant.micEnabled ? '🎤' : '🔇'}</span>
        {participant.name}
        {participant.isLocal ? ' (you)' : ''}
      </span>

      {isLocal && (
        <>
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-black/60 px-2 py-1.5">
            <button
              type="button"
              aria-label={participant.micEnabled ? 'Mute' : 'Unmute'}
              onClick={() => voiceClient.toggleMute()}
              className="rounded-full bg-white/10 p-1.5 text-sm leading-none text-white hover:bg-white/20"
            >
              {participant.micEnabled ? '🎤' : '🔇'}
            </button>
            <button
              type="button"
              aria-label={participant.cameraEnabled ? 'Camera off' : 'Camera on'}
              onClick={() => voiceClient.toggleCamera()}
              className="rounded-full bg-white/10 p-1.5 text-sm leading-none text-white hover:bg-white/20"
            >
              {participant.cameraEnabled ? '📹' : '📷'}
            </button>
            <button
              type="button"
              aria-label={participant.screenShareEnabled ? 'Stop sharing' : 'Share screen'}
              onClick={() =>
                participant.screenShareEnabled ? voiceClient.toggleScreenShare() : setQualityModalOpen(true)
              }
              className="rounded-full bg-white/10 p-1.5 text-sm leading-none text-white hover:bg-white/20"
            >
              {participant.screenShareEnabled ? '🛑' : '🖥️'}
            </button>
            <button
              type="button"
              aria-label="Leave call"
              onClick={onLeave}
              className="rounded-full bg-red-500/80 p-1.5 text-sm leading-none text-white hover:bg-red-500"
            >
              📵
            </button>
          </div>
          <ScreenShareQualityModal
            open={isQualityModalOpen}
            onClose={() => setQualityModalOpen(false)}
            onConfirm={(quality) => {
              setQualityModalOpen(false);
              voiceClient.toggleScreenShare(quality);
            }}
          />
        </>
      )}
    </div>
  );
}
