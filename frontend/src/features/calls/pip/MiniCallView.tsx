import { LogOut, Mic, MicOff } from 'lucide-react';
import { voiceClient } from '../../../services/voiceClient';
import { useVoiceParticipants } from '../hooks';
import { ParticipantTile } from '../ParticipantTile';
import { ScreenShareTile } from '../ScreenShareTile';

interface MiniCallViewProps {
  /** Navigates the main window back to the call's channel, focuses it, and closes this PiP
   * window. Implemented by the caller (VoiceConnectionBar) — it's the one that actually owns
   * the pipWindow reference and the router's navigate(), not this component. */
  onReturn: () => void;
}

/**
 * The content rendered inside the Document Picture-in-Picture window — see
 * docs/superpowers/specs/2026-09-23-call-pip-design.md. Reads straight from the same global
 * voiceStore every other call component uses; no state of its own beyond what ParticipantTile/
 * ScreenShareTile already keep.
 */
export function MiniCallView({ onReturn }: MiniCallViewProps) {
  const participants = useVoiceParticipants();
  const localParticipant = participants.find((participant) => participant.isLocal);
  const sharing =
    participants.find((participant) => participant.isLocal && participant.screenShareEnabled) ??
    participants.find((participant) => participant.screenShareEnabled);
  const withCameraOn = participants.filter((participant) => participant.cameraEnabled);

  return (
    <div className="flex h-full flex-col bg-gray-950">
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {sharing ? (
          <ScreenShareTile participant={sharing} showFullscreenButton={false} className="h-full w-full" />
        ) : (
          <p className="text-caption text-white/60">No one is sharing their screen</p>
        )}
      </div>

      {withCameraOn.length > 0 && (
        <div className="flex flex-shrink-0 gap-1 overflow-x-auto bg-black/40 p-1">
          {withCameraOn.map((participant) => (
            <ParticipantTile
              key={participant.identity}
              participant={participant}
              showVolumeControl={false}
              className="h-14 w-14 flex-shrink-0"
            />
          ))}
        </div>
      )}

      <div className="flex flex-shrink-0 items-center justify-center gap-2 bg-black/60 p-1.5">
        {localParticipant && (
          <button
            type="button"
            aria-label={localParticipant.micEnabled ? 'Mute' : 'Unmute'}
            onClick={() => voiceClient.toggleMute()}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white hover:bg-white/10"
          >
            {localParticipant.micEnabled ? (
              <Mic size={14} aria-hidden="true" />
            ) : (
              <MicOff size={14} aria-hidden="true" />
            )}
          </button>
        )}
        <button
          type="button"
          aria-label="Voltar à chamada"
          onClick={onReturn}
          className="rounded-full px-3 py-1 text-caption text-white hover:bg-white/10"
        >
          Voltar à chamada
        </button>
        <button
          type="button"
          aria-label="Sair da chamada"
          onClick={() => voiceClient.disconnect()}
          className="flex h-8 w-8 items-center justify-center rounded-full text-white hover:bg-danger/80"
        >
          <LogOut size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
