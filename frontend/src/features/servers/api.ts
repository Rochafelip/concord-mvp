import { apiClient } from '../../services/apiClient';
import type { InviteCode, Server, ServerMember } from '../../types/server';

export interface CreateServerPayload {
  name: string;
}

export interface JoinServerPayload {
  code: string;
}

export interface TransferOwnershipPayload {
  newOwnerId: string;
}

export function listServers(): Promise<Server[]> {
  return apiClient.get<Server[]>('servers');
}

export function getServer(serverId: string): Promise<Server> {
  return apiClient.get<Server>(`servers/${serverId}`);
}

export function createServer(data: CreateServerPayload): Promise<Server> {
  return apiClient.post<Server>('servers', data);
}

export function deleteServer(serverId: string): Promise<void> {
  return apiClient.delete<void>(`servers/${serverId}`);
}

export function leaveServer(serverId: string): Promise<void> {
  return apiClient.post<void>(`servers/${serverId}/leave`);
}

export function getServerMembers(serverId: string): Promise<ServerMember[]> {
  return apiClient.get<ServerMember[]>(`servers/${serverId}/members`);
}

export function transferOwnership(
  serverId: string,
  data: TransferOwnershipPayload,
): Promise<Server> {
  return apiClient.post<Server>(`servers/${serverId}/transfer-ownership`, data);
}

export function getInvite(serverId: string): Promise<InviteCode> {
  return apiClient.get<InviteCode>(`servers/${serverId}/invite`);
}

export function regenerateInvite(serverId: string): Promise<InviteCode> {
  return apiClient.post<InviteCode>(`servers/${serverId}/invite/regenerate`);
}

export function joinServer(data: JoinServerPayload): Promise<Server> {
  return apiClient.post<Server>('servers/join', data);
}
