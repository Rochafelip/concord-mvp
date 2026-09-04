import type { LocalVideoTrack, RemoteVideoTrack } from 'livekit-client';

export interface VoiceTokenResponse {
  token: string;
  url: string;
  roomName: string;
}

export interface VoiceParticipant {
  identity: string;
  name: string;
  isLocal: boolean;
  micEnabled: boolean;
  cameraEnabled: boolean;
  videoTrack: LocalVideoTrack | RemoteVideoTrack | null;
}
