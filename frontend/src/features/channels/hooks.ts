import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
      // Voice channels have no UI to navigate to yet (LiveKit/voice is a later phase) —
      // only text channels get taken to their (still-placeholder) chat route.
      if (channel.type === 'TEXT') {
        navigate(`/app/servers/${serverId}/channels/${channel.id}`);
      }
    },
  });
}
