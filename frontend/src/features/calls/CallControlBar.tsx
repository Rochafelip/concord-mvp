import { AudioLines, AudioLinesOff, Mic, MicOff, PhoneOff, Video, VideoOff, Volume2, VolumeX } from 'lucide-react';
import { useState } from 'react';
import { voiceClient } from '../../services/voiceClient';
import { getNoiseSuppressionPreference, setNoiseSuppressionPreference } from '../settings/audio/noiseSuppressionPreference';
import { useVoiceParticipants } from './hooks';

interface CallControlBarProps {
  onLeave: () => void;
}

/**
 * Floating, centered control bar for the local participant's own call controls — rendered once
 * by CallView, replacing the local tile's former in-tile control bar. See
 * docs/superpowers/specs/2026-09-08-call-view-control-bar-redesign-design.md §5.
 */
export function CallControlBar({ onLeave }: CallControlBarProps) {
  const localParticipant = useVoiceParticipants().find((participant) => participant.isLocal);
  const [suppressionEnabled, setSuppressionEnabled] = useState(getNoiseSuppressionPreference);

  if (!localParticipant) return null;

  function handleToggleNoiseSuppression() {
    const next = !suppressionEnabled;
    setSuppressionEnabled(next);
    setNoiseSuppressionPreference(next);
    void voiceClient.setNoiseSuppressionEnabled(next);
  }

  return (
    <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-1.5 rounded-full bg-black/60 px-2 py-1.5">
      <button
        type="button"
        aria-label={localParticipant.micEnabled ? 'Mute' : 'Unmute'}
        onClick={() => voiceClient.toggleMute()}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        {localParticipant.micEnabled ? (
          <Mic size={16} aria-hidden="true" />
        ) : (
          <MicOff size={16} aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        aria-label={suppressionEnabled ? 'Disable noise suppression' : 'Enable noise suppression'}
        onClick={handleToggleNoiseSuppression}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        {suppressionEnabled ? (
          <AudioLines size={16} aria-hidden="true" />
        ) : (
          <AudioLinesOff size={16} aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        aria-label={localParticipant.cameraEnabled ? 'Camera off' : 'Camera on'}
        onClick={() => voiceClient.toggleCamera()}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        {localParticipant.cameraEnabled ? (
          <Video size={16} aria-hidden="true" />
        ) : (
          <VideoOff size={16} aria-hidden="true" />
        )}
      </button>
      {localParticipant.screenShareEnabled && localParticipant.screenShareHasAudio && (
        <button
          type="button"
          aria-label={
            localParticipant.screenShareAudioEnabled ? 'Mute shared screen audio' : 'Unmute shared screen audio'
          }
          onClick={() => voiceClient.toggleScreenShareAudio()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        >
          {localParticipant.screenShareAudioEnabled ? (
            <Volume2 size={16} aria-hidden="true" />
          ) : (
            <VolumeX size={16} aria-hidden="true" />
          )}
        </button>
      )}
      <button
        type="button"
        aria-label="Leave call"
        onClick={onLeave}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-danger/80 text-white hover:bg-danger"
      >
        <PhoneOff size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
