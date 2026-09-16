import { apiClient } from '../../services/apiClient';
import type { ChannelPermissionOverride, Permission, Role } from '../../types/permission';

export interface CreateRolePayload {
  name: string;
  description?: string | null;
  color?: string | null;
  position?: number;
  permissions: Permission[];
}

/** Every field is optional — an omitted one is left as it is. */
export type UpdateRolePayload = Partial<CreateRolePayload>;

export interface OverridePayload {
  allow: Permission[];
  deny: Permission[];
}

export function listRoles(serverId: string): Promise<Role[]> {
  return apiClient.get<Role[]>(`servers/${serverId}/roles`);
}

export function createRole(serverId: string, payload: CreateRolePayload): Promise<Role> {
  return apiClient.post<Role>(`servers/${serverId}/roles`, payload);
}

export function updateRole(roleId: string, payload: UpdateRolePayload): Promise<Role> {
  return apiClient.patch<Role>(`roles/${roleId}`, payload);
}

export function deleteRole(roleId: string): Promise<void> {
  return apiClient.delete<void>(`roles/${roleId}`);
}

/** Batched on purpose: two concurrent single-role moves would collide on position. */
export function updateRolePositions(
  serverId: string,
  roles: { roleId: string; position: number }[],
): Promise<Role[]> {
  return apiClient.put<Role[]>(`servers/${serverId}/roles/positions`, { roles });
}

export function listMemberRoles(serverId: string, userId: string): Promise<Role[]> {
  return apiClient.get<Role[]>(`servers/${serverId}/members/${userId}/roles`);
}

export function assignRole(serverId: string, userId: string, roleId: string): Promise<void> {
  return apiClient.put<void>(`servers/${serverId}/members/${userId}/roles/${roleId}`, {});
}

export function unassignRole(serverId: string, userId: string, roleId: string): Promise<void> {
  return apiClient.delete<void>(`servers/${serverId}/members/${userId}/roles/${roleId}`);
}

export function listChannelOverrides(channelId: string): Promise<ChannelPermissionOverride[]> {
  return apiClient.get<ChannelPermissionOverride[]>(`channels/${channelId}/permissions`);
}

export function setRoleOverride(
  channelId: string,
  roleId: string,
  payload: OverridePayload,
): Promise<ChannelPermissionOverride | null> {
  return apiClient.put<ChannelPermissionOverride | null>(
    `channels/${channelId}/permissions/roles/${roleId}`,
    payload,
  );
}

export function setUserOverride(
  channelId: string,
  userId: string,
  payload: OverridePayload,
): Promise<ChannelPermissionOverride | null> {
  return apiClient.put<ChannelPermissionOverride | null>(
    `channels/${channelId}/permissions/users/${userId}`,
    payload,
  );
}

export function deleteOverride(channelId: string, overrideId: string): Promise<void> {
  return apiClient.delete<void>(`channels/${channelId}/permissions/${overrideId}`);
}
