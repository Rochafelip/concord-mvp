export type ChannelType = 'TEXT' | 'VOICE' | 'ONBOARDING';

import type { Permission } from './permission';

export interface Channel {
  id: string;
  serverId: string;
  name: string;
  type: ChannelType;
  createdAt: string;
  updatedAt: string;
  unreadCount?: number;
  /**
   * The current user's effective permissions in this channel, overrides already applied. Absent on
   * the CHANNEL_CREATE broadcast, which has no single recipient — the client refetches instead.
   */
  permissions?: Permission[];
}
