import { useEffect, useState } from 'react';
import { Room, RoomEvent, Track, type RemoteParticipant, type RemoteTrack } from 'livekit-client';
import { getVoicePreviewToken } from './api';

export type ScreenSharePreviewStatus = 'connecting' | 'ready' | 'unavailable';

interface UseScreenSharePreviewResult {
  status: ScreenSharePreviewStatus;
  track: RemoteTrack | null;
}

/**
 * Connects a throwaway, read-only LiveKit room purely to preview one participant's screen share
 * from outside the call — the sidebar's hover preview. Deliberately never touches the app's real
 * `voiceClient`/`voiceStore`: it always opens its own separate `Room` (joining the same room under
 * the same identity while already connected there would collide), and tears it down again on
 * unmount or whenever `channelId`/`identity` changes.
 *
 * Subscribes to nothing automatically (`autoSubscribe: false`) and manually subscribes only the
 * target's `ScreenShare` publication — never `ScreenShareAudio` — so a hover preview is always
 * silent and never pulls down any other participant's media.
 */
export function useScreenSharePreview(channelId: string, identity: string): UseScreenSharePreviewResult {
  const [status, setStatus] = useState<ScreenSharePreviewStatus>('connecting');
  const [track, setTrack] = useState<RemoteTrack | null>(null);

  // Resets synchronously during render rather than in the effect below (React's blessed pattern
  // for "state that depends on a prop and must reset when that prop changes") — an effect may not
  // call setState in its own body, only inside its async/event-driven continuations.
  const targetKey = `${channelId}:${identity}`;
  const [previousTargetKey, setPreviousTargetKey] = useState(targetKey);
  if (targetKey !== previousTargetKey) {
    setPreviousTargetKey(targetKey);
    setStatus('connecting');
    setTrack(null);
  }

  useEffect(() => {
    let cancelled = false;
    let room: Room | null = null;

    function subscribeIfTarget(participant: RemoteParticipant) {
      if (participant.identity !== identity) return;
      participant.getTrackPublication(Track.Source.ScreenShare)?.setSubscribed(true);
    }

    function handleTrackSubscribed(remoteTrack: RemoteTrack, _publication: unknown, participant: RemoteParticipant) {
      if (cancelled || participant.identity !== identity || remoteTrack.source !== Track.Source.ScreenShare) return;
      setTrack(remoteTrack);
      setStatus('ready');
    }

    function handleParticipantGone(participant: RemoteParticipant) {
      if (cancelled || participant.identity !== identity) return;
      setTrack(null);
      setStatus('unavailable');
    }

    (async () => {
      try {
        const { token, url } = await getVoicePreviewToken(channelId);
        if (cancelled) return;

        room = new Room();
        room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
        room.on(RoomEvent.ParticipantConnected, subscribeIfTarget);
        room.on(RoomEvent.ParticipantDisconnected, handleParticipantGone);
        room.on(RoomEvent.TrackUnpublished, (_publication: unknown, participant: RemoteParticipant) =>
          handleParticipantGone(participant),
        );

        await room.connect(url, token, { autoSubscribe: false });
        if (cancelled) {
          room.disconnect();
          return;
        }

        const participant = room.remoteParticipants.get(identity);
        if (participant) {
          subscribeIfTarget(participant);
        } else {
          setStatus('unavailable');
        }
      } catch {
        if (!cancelled) setStatus('unavailable');
      }
    })();

    return () => {
      cancelled = true;
      room?.disconnect();
    };
  }, [channelId, identity]);

  return { status, track };
}
