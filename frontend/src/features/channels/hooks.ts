import type { Channel } from "../../types/channel";
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
  const { serverId } = useParams<{ serverId?: string }>();

  return useMutation({
    mutationFn: ({ channelId, lastReadMessageId }: { channelId: string; lastReadMessageId?: string }) =>
      api.markChannelAsRead(channelId, lastReadMessageId || null),
    onSuccess: (_, variables) => {
      const { channelId } = variables;
      
      // Update the channel's unread count to 0 immediately in the cache
      queryClient.setQueryData<Channel[]>(['servers', serverId, 'channels'], (old) => {
        if (!old) return old;
        return old.map((ch) =>
          ch.id === channelId ? { ...ch, unreadCount: 0 } : ch
        );
      });

      // Also update the single channel cache if it exists
      queryClient.setQueryData<Channel>(['channels', channelId], (old) => {
        if (!old) return old;
        return { ...old, unreadCount: 0 };
      });
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
