export type ChannelType = 'TEXT' | 'VOICE' | 'ONBOARDING';

export interface Channel {
  id: string;
  serverId: string;
  name: string;
  type: ChannelType;
  createdAt: string;
  updatedAt: string;
}
