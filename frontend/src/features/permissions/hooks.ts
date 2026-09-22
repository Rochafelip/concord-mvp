import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from './api';

export function useRoles(serverId: string | undefined) {
  return useQuery({
    queryKey: ['servers', serverId, 'roles'],
    queryFn: () => api.listRoles(serverId!),
    enabled: serverId != null,
  });
}

export function useMemberRoles(serverId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ['servers', serverId, 'members', userId, 'roles'],
    queryFn: () => api.listMemberRoles(serverId!, userId!),
    enabled: serverId != null && userId != null,
  });
}

export function useChannelOverrides(channelId: string | undefined) {
  return useQuery({
    queryKey: ['channels', channelId, 'permissions'],
    queryFn: () => api.listChannelOverrides(channelId!),
    enabled: channelId != null,
  });
}

/**
 * Every mutation below invalidates the same set: the roles list plus anything whose contents
 * depend on permissions. The backend also broadcasts PERMISSIONS_UPDATE to the affected members,
 * which is what refreshes *other* people's clients (see useRealtimeSync).
 */
function useRoleMutation<TArgs, TResult>(
  serverId: string,
  mutationFn: (args: TArgs) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'roles'] });
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'channels'] });
      queryClient.invalidateQueries({ queryKey: ['servers', serverId] });
    },
  });
}

export function useCreateRole(serverId: string) {
  return useRoleMutation(serverId, (payload: api.CreateRolePayload) => api.createRole(serverId, payload));
}

export function useUpdateRole(serverId: string) {
  return useRoleMutation(serverId, ({ roleId, ...payload }: api.UpdateRolePayload & { roleId: string }) =>
    api.updateRole(roleId, payload),
  );
}

export function useDeleteRole(serverId: string) {
  return useRoleMutation(serverId, (roleId: string) => api.deleteRole(roleId));
}

export function useUpdateRolePositions(serverId: string) {
  return useRoleMutation(serverId, (roles: { roleId: string; position: number }[]) =>
    api.updateRolePositions(serverId, roles),
  );
}

export function useAssignRole(serverId: string) {
  return useRoleMutation(serverId, ({ userId, roleId }: { userId: string; roleId: string }) =>
    api.assignRole(serverId, userId, roleId),
  );
}

export function useUnassignRole(serverId: string) {
  return useRoleMutation(serverId, ({ userId, roleId }: { userId: string; roleId: string }) =>
    api.unassignRole(serverId, userId, roleId),
  );
}
