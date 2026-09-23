import { AudioLines, AudioLinesOff, Mic, MicOff, PhoneOff, PictureInPicture2, RefreshCw, Settings, Video, VideoOff, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { voiceClient } from '../../services/voiceClient';
import { useDeviceStore } from '../../stores/deviceStore';
import { useVoiceStore } from '../../stores/voiceStore';
import { getNoiseSuppressionPreference, setNoiseSuppressionPreference } from '../settings/audio/noiseSuppressionPreference';
import { DeviceSettingsPanel } from './DeviceSettingsPanel';
import { useVoiceParticipants } from './hooks';
import { useCallPip } from './pip/useCallPip';

const MOBILE_QUERY = '(max-width: 640px)';

/** Same guarded-matchMedia pattern as ServerLayout's mobile check — jsdom has no matchMedia. */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  return isMobile;
}

interface CallControlBarProps {
  onLeave: () => void;
  /**
   * USE_VIDEO in this voice channel, resolved by CallView. Cosmetic: without it the LiveKit token
   * omits the camera source, so LiveKit rejects the track regardless of what this bar shows.
   */
  canUseVideo?: boolean;
}

/**
 * Floating, centered control bar for the local participant's own call controls — rendered once
 * by CallView, replacing the local tile's former in-tile control bar. See
 * docs/superpowers/specs/2026-09-08-call-view-control-bar-redesign-design.md §5.
 */
export function CallControlBar({ onLeave, canUseVideo = false }: CallControlBarProps) {
  const participants = useVoiceParticipants();
  const localParticipant = participants.find((participant) => participant.isLocal);
  const whisperingTo = useVoiceStore((state) => state.whisperingTo);
  const [suppressionEnabled, setSuppressionEnabled] = useState(getNoiseSuppressionPreference);
  const [showDeviceSelector, setShowDeviceSelector] = useState(false);
  const isMobile = useIsMobile();
  const { isSupported: pipSupported, pipWindow, open: openPip } = useCallPip();

  if (!localParticipant) return null;

  const whisperingToName = whisperingTo
    ? participants.find((participant) => participant.identity === whisperingTo)?.name
    : null;

  function handleToggleNoiseSuppression() {
    const next = !suppressionEnabled;
    setSuppressionEnabled(next);
    setNoiseSuppressionPreference(next);
    void voiceClient.setNoiseSuppressionEnabled(next);
  }

  async function handleFlipCamera() {
    const deviceId = await voiceClient.flipCamera();
    if (deviceId) useDeviceStore.getState().syncActiveCamera(deviceId);
  }

  return (
    <>
      {whisperingToName && (
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-body text-white">
          🐦 Whispering to {whisperingToName}
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-2 bottom-[max(0.75rem,env(safe-area-inset-bottom))] flex flex-wrap items-center justify-center gap-1.5 rounded-2xl bg-black/70 px-2 py-1.5 opacity-0 transition-opacity group-hover/call-area:pointer-events-auto group-hover/call-area:opacity-100 group-focus-within/call-area:pointer-events-auto group-focus-within/call-area:opacity-100 sm:inset-x-0 sm:bottom-4 sm:rounded-full">
      <button
        type="button"
        aria-label={localParticipant.micEnabled ? 'Mute' : 'Unmute'}
        title={localParticipant.micEnabled ? 'Mute' : 'Unmute'}
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
        title={suppressionEnabled ? 'Disable noise suppression' : 'Enable noise suppression'}
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
        aria-label="Selecionar dispositivos"
        title="Select devices"
        onClick={() => setShowDeviceSelector(true)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <Settings size={16} aria-hidden="true" />
      </button>
      {canUseVideo && (
        <button
          type="button"
          aria-label={localParticipant.cameraEnabled ? 'Camera off' : 'Camera on'}
          title={localParticipant.cameraEnabled ? 'Turn camera off' : 'Turn camera on'}
          onClick={() => voiceClient.toggleCamera()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        >
          {localParticipant.cameraEnabled ? (
            <Video size={16} aria-hidden="true" />
          ) : (
            <VideoOff size={16} aria-hidden="true" />
          )}
        </button>
      )}
      {canUseVideo && isMobile && localParticipant.cameraEnabled && (
        <button
          type="button"
          aria-label="Flip camera"
          title="Flip camera"
          onClick={() => void handleFlipCamera()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        >
          <RefreshCw size={16} aria-hidden="true" />
        </button>
      )}
      {localParticipant.screenShareEnabled && localParticipant.screenShareHasAudio && (
        <button
          type="button"
          aria-label={
            localParticipant.screenShareAudioEnabled ? 'Mute shared screen audio' : 'Unmute shared screen audio'
          }
          title={localParticipant.screenShareAudioEnabled ? 'Mute shared screen audio' : 'Unmute shared screen audio'}
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
      {pipSupported && !pipWindow && (
        <button
          type="button"
          aria-label="Destacar chamada"
          title="Destacar chamada"
          onClick={() => void openPip()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        >
          <PictureInPicture2 size={16} aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        aria-label="Leave call"
        title="Leave call"
        onClick={onLeave}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-danger/80 text-white hover:bg-danger"
      >
        <PhoneOff size={16} aria-hidden="true" />
      </button>
    </div>
    <DeviceSettingsPanel isOpen={showDeviceSelector} onClose={() => setShowDeviceSelector(false)} />
  </>
  );
}
