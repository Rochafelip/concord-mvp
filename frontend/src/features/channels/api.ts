import { apiClient } from '../../services/apiClient';
import type { Channel, ChannelType } from '../../types/channel';

export interface CreateChannelPayload {
  name: string;
  type: ChannelType;
}

export interface MarkChannelReadRequest {
  lastReadMessageId: string;
}

export interface ChannelReadStateResponse {
  channelId: string;
  lastReadMessageId: string | null;
  lastReadAt: string;
  unreadCount: number;
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

export function markChannelAsRead(channelId: string, lastReadMessageId: string): Promise<void> {
  return apiClient.post<void>(`channels/${channelId}/read`, { lastReadMessageId });
}

export function getChannelReadState(channelId: string): Promise<ChannelReadStateResponse> {
  return apiClient.get<ChannelReadStateResponse>(`channels/${channelId}/read-state`);
}
