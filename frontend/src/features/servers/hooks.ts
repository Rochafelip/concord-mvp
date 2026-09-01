import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../auth/authStore';
import * as api from './api';

export function useServers() {
  return useQuery({
    queryKey: ['servers'],
    queryFn: api.listServers,
  });
}

export function useServer(serverId: string | undefined) {
  return useQuery({
    queryKey: ['servers', serverId],
    queryFn: () => api.getServer(serverId!),
    enabled: serverId != null,
  });
}

/**
 * Whether the current user owns the given server. Shared by every call site that needs to
 * gate owner-only UI (ChannelSidebar's "create channel", ServerSettingsPanel's invite/
 * transfer/delete actions, and future ones) instead of each re-deriving it from `useServer`
 * + `authStore` independently.
 */
export function useIsServerOwner(serverId: string | undefined): boolean {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const { data: server } = useServer(serverId);
  return server != null && currentUserId != null && server.ownerId === currentUserId;
}

export function useServerMembers(serverId: string | undefined) {
  return useQuery({
    queryKey: ['servers', serverId, 'members'],
    queryFn: () => api.getServerMembers(serverId!),
    enabled: serverId != null,
  });
}

/**
 * Owner-gated: pass `undefined` for `serverId` (rather than calling this unconditionally)
 * when the caller isn't already sure the current user owns the server, so the query stays
 * disabled instead of hitting the backend's 403.
 */
export function useInvite(serverId: string | undefined) {
  return useQuery({
    queryKey: ['servers', serverId, 'invite'],
    queryFn: () => api.getInvite(serverId!),
    enabled: serverId != null,
  });
}

export function useCreateServer() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: api.createServer,
    onSuccess: (server) => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      navigate(`/app/servers/${server.id}`);
    },
  });
}

export function useJoinServer() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: api.joinServer,
    onSuccess: (server) => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      navigate(`/app/servers/${server.id}`);
    },
  });
}

export function useLeaveServer() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (serverId: string) => api.leaveServer(serverId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      navigate('/app');
    },
  });
}

export function useDeleteServer() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (serverId: string) => api.deleteServer(serverId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      navigate('/app');
    },
  });
}

export function useTransferOwnership(serverId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: api.TransferOwnershipPayload) => api.transferOwnership(serverId, data),
    onSuccess: () => {
      // ownerId also lives on the list-shaped Server objects, so invalidate the whole
      // ['servers'] branch rather than just this one server's query.
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
  });
}

export function useRegenerateInvite(serverId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.regenerateInvite(serverId),
    onSuccess: (result) => {
      queryClient.setQueryData(['servers', serverId, 'invite'], result);
    },
  });
}
