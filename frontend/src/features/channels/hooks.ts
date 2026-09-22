import type { Channel } from "../../types/channel";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import * as api from './api';
import { hasPermission, type Permission } from '../../types/permission';

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

/**
 * Whether the current user holds a permission inside one channel, channel overrides already
 * applied by the backend.
 *
 * <p>Container components use this and pass the result down as a prop; presentation components
 * such as MessageList and MessageInput stay free of data fetching (AGENTS.md).
 */
export function useChannelPermission(channelId: string | undefined, permission: Permission): boolean {
  const { data: channel } = useChannel(channelId);
  return hasPermission(channel?.permissions, permission);
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
    // Optimistic-only: onMutate is the single place that zeroes the cache. A matching onSuccess
    // that zeroed it again used to double as a race — a MESSAGE_CREATE bumping unreadCount back
    // up while this mutation was still in flight (e.g. the user switched to another channel right
    // after marking this one read) got silently wiped back to 0 once the request resolved, losing
    // track of a genuinely unread message. No onError rollback: a failed request leaving the
    // optimistic 0 in place is the same "already read" state the user asked for.
    onMutate: ({ channelId }) => {
      queryClient.setQueryData<Channel[]>(['servers', serverId, 'channels'], (old) => {
        if (!old) return old;
        return old.map((ch) => ch.id === channelId ? { ...ch, unreadCount: 0 } : ch);
      });
      queryClient.setQueryData<Channel>(['channels', channelId], (old) =>
        old ? { ...old, unreadCount: 0 } : old,
      );
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
