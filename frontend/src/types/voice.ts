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
}
