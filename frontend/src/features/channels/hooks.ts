import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import * as api from './api';

export function useChannels(serverId: string | undefined) {
  return useQuery({
    queryKey: ['servers', serverId, 'channels'],
    queryFn: () => api.listChannels(serverId!),
    enabled: serverId != null,
  });
}

export function useChannel(channelId: string | undefined) {
  return useQuery({
    queryKey: ['channels', channelId],
    queryFn: () => api.getChannel(channelId!),
    enabled: channelId != null,
  });
}

export function useCreateChannel(serverId: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: api.CreateChannelPayload) => api.createChannel(serverId, data),
    onSuccess: (channel) => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'channels'] });
      navigate(`/app/servers/${serverId}/channels/${channel.id}`);
    },
  });
}

export function useDeleteChannel(serverId: string | undefined) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { channelId: currentChannelId } = useParams<{ channelId?: string }>();

  return useMutation({
    mutationFn: (channelId: string) => api.deleteChannel(channelId),
    onSuccess: (_data, deletedChannelId) => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'channels'] });
      if (deletedChannelId === currentChannelId) {
        navigate(`/app/servers/${serverId}`);
      }
    },
  });
}

export function useMarkChannelAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ channelId, lastReadMessageId }: { channelId: string; lastReadMessageId?: string }) =>
      api.markChannelAsRead(channelId, lastReadMessageId),
    onSuccess: (_, { channelId }) => {
      // Invalidate channels query to refresh unread counts
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      // Also invalidate server-specific channels queries
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
  });
}

export function useChannelReadState(channelId: string | undefined) {
  return useQuery({
    queryKey: ['channels', channelId, 'read-state'],
    queryFn: () => api.getChannelReadState(channelId!),
    enabled: channelId != null,
  });
}
