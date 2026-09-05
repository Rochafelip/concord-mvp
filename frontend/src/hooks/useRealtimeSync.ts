import type { InfiniteData } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toVoicePresenceEntry } from '../features/calls/api';
import { useAuthStore } from '../features/auth/authStore';
import { websocketClient } from '../services/websocketClient';
import { voiceClient } from '../services/voiceClient';
import { useNotificationStore } from '../stores/notificationStore';
import { useVoiceStore } from '../stores/voiceStore';
import type { Channel } from '../types/channel';
import type { Message } from '../types/message';
import type { Server } from '../types/server';
import type { VoicePresenceEntry } from '../types/voice';
import type {
  ChannelDeletedPayload,
  ErrorPayload,
  ServerDeletedPayload,
  ServerMemberEventPayload,
  VoicePresenceLeavePayload,
  VoicePresencePayload,
} from '../types/websocket';

/**
 * Mounted ONCE in AppShell (which only renders once authenticated, per ProtectedRoute — a
 * token is guaranteed present). Owns the WebSocket connection's lifecycle and translates every
 * server -> client event into a TanStack Query cache update, targeting the EXACT query keys
 * established by features/servers/hooks.ts and features/channels/hooks.ts.
 */
export function useRealtimeSync(): void {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { serverId: currentServerId, channelId: currentChannelId } = useParams<{
    serverId?: string;
    channelId?: string;
  }>();
  const token = useAuthStore((state) => state.token);
  const setNotification = useNotificationStore((state) => state.setMessage);

  // The SERVER_DELETE and CHANNEL_DELETE subscribers below are set up once (empty-ish dep
  // effect) but need the *current* route's serverId/channelId at the moment the event arrives,
  // not the values captured at subscribe time — refs keep them fresh without re-subscribing on
  // every navigation.
  const currentServerIdRef = useRef(currentServerId);
  const currentChannelIdRef = useRef(currentChannelId);
  useLayoutEffect(() => {
    currentServerIdRef.current = currentServerId;
    currentChannelIdRef.current = currentChannelId;
  }, [currentServerId, currentChannelId]);

  useEffect(() => {
    if (!token) return;
    websocketClient.connect(token);
    return () => {
      websocketClient.disconnect();
    };
  }, [token]);

  useEffect(() => {
    const unsubscribers = [
      websocketClient.subscribe('MESSAGE_CREATE', (payload) => {
        const message = payload as Message;
        queryClient.setQueryData<InfiniteData<Message[]>>(
          ['channels', message.channelId, 'messages'],
          (old) => {
            // Only update if this channel's history is already cached (the user has opened it
            // before) — don't force-create a cache entry for a channel nobody's looking at.
            if (!old || old.pages.length === 0) return old;
            // pages[0] holds the newest-fetched (most recent) messages — see hooks.ts.
            const pages = old.pages.map((page, index) =>
              index === 0 ? [...page, message] : page,
            );
            return { ...old, pages };
          },
        );
      }),

      websocketClient.subscribe('CHANNEL_CREATE', (payload) => {
        const channel = payload as Channel;
        queryClient.invalidateQueries({ queryKey: ['servers', channel.serverId, 'channels'] });
      }),

      websocketClient.subscribe('CHANNEL_DELETE', (payload) => {
        const { channelId, serverId } = payload as ChannelDeletedPayload;

        queryClient.setQueryData<Channel[]>(['servers', serverId, 'channels'], (old) =>
          old?.filter((channel) => channel.id !== channelId),
        );

        if (currentServerIdRef.current === serverId && currentChannelIdRef.current === channelId) {
          navigate(`/app/servers/${serverId}`);
        }

        if (useVoiceStore.getState().channelId === channelId) {
          voiceClient.disconnect();
        }
      }),

      websocketClient.subscribe('SERVER_MEMBER_JOIN', (payload) => {
        const { serverId } = payload as ServerMemberEventPayload;
        queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'members'] });
      }),

      websocketClient.subscribe('SERVER_MEMBER_LEAVE', (payload) => {
        const { serverId } = payload as ServerMemberEventPayload;
        queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'members'] });
      }),

      websocketClient.subscribe('SERVER_OWNER_CHANGE', () => {
        // ownerId also lives on the list-shaped Server objects (same reasoning as
        // useTransferOwnership in features/servers/hooks.ts), so invalidate the whole
        // ['servers'] branch rather than just the single-server query.
        queryClient.invalidateQueries({ queryKey: ['servers'] });
      }),

      websocketClient.subscribe('SERVER_DELETE', (payload) => {
        const { serverId } = payload as ServerDeletedPayload;
        queryClient.setQueryData<Server[]>(['servers'], (old) =>
          old?.filter((server) => server.id !== serverId),
        );
        if (currentServerIdRef.current === serverId) {
          setNotification('This server was deleted.');
          navigate('/app');
        }
      }),

      websocketClient.subscribe('ERROR', (payload) => {
        const { message } = payload as ErrorPayload;
        setNotification(message);
      }),

      websocketClient.subscribe('VOICE_PRESENCE_UPDATE', (payload) => {
        const raw = payload as VoicePresencePayload;
        const entry = toVoicePresenceEntry(raw);
        queryClient.setQueryData<VoicePresenceEntry[]>(['servers', raw.serverId, 'voice-presence'], (old) => {
          // Same guard as MESSAGE_CREATE above: don't force-create a cache entry for a server's
          // sidebar nobody has opened yet.
          if (!old) return old;
          return [...old.filter((existing) => existing.userId !== entry.userId), entry];
        });
      }),

      websocketClient.subscribe('VOICE_PRESENCE_LEAVE', (payload) => {
        const { serverId, userId } = payload as VoicePresenceLeavePayload;
        queryClient.setQueryData<VoicePresenceEntry[]>(['servers', serverId, 'voice-presence'], (old) =>
          old?.filter((entry) => entry.userId !== userId),
        );
      }),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [queryClient, navigate, setNotification]);
}
