import { apiClient } from '../../services/apiClient';
import type { Channel, ChannelType } from '../../types/channel';

export interface CreateChannelPayload {
  name: string;
  type: ChannelType;
}

export function listChannels(serverId: string): Promise<Channel[]> {
  return apiClient.get<Channel[]>(`servers/${serverId}/channels`);
}

export function createChannel(serverId: string, data: CreateChannelPayload): Promise<Channel> {
  return apiClient.post<Channel>(`servers/${serverId}/channels`, data);
}

export function getChannel(channelId: string): Promise<Channel> {
  return apiClient.get<Channel>(`channels/${channelId}`);
}

export function deleteChannel(channelId: string): Promise<void> {
  return apiClient.delete<void>(`channels/${channelId}`);
}
