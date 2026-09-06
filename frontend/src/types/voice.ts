import type { ConnectionQuality, LocalVideoTrack, RemoteVideoTrack } from 'livekit-client';

export interface VoiceTokenResponse {
  token: string;
  url: string;
  roomName: string;
}

export type ScreenShareQuality = 'hd' | 'fhd';

export interface ScreenShareOptions {
  quality: ScreenShareQuality;
  withAudio: boolean;
}

export interface VoiceParticipant {
  identity: string;
  name: string;
  isLocal: boolean;
  micEnabled: boolean;
  cameraEnabled: boolean;
  videoTrack: LocalVideoTrack | RemoteVideoTrack | null;
  screenShareEnabled: boolean;
  screenShareTrack: LocalVideoTrack | RemoteVideoTrack | null;
  screenShareHasAudio: boolean;
  connectionQuality: ConnectionQuality;
}

/**
 * A voice channel participant's presence as seen by someone who isn't necessarily connected to
 * that call — flattened from the wire shape's nested `user` object (see
 * features/calls/api.ts's toVoicePresenceEntry, the one place that mapping happens).
 */
export interface VoicePresenceEntry {
  channelId: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  muted: boolean;
  cameraOn: boolean;
  screenSharing: boolean;
  speaking: boolean;
}
