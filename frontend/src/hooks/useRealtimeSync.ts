import type { InfiniteData } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../features/auth/authStore';
import { websocketClient } from '../services/websocketClient';
import { useNotificationStore } from '../stores/notificationStore';
import type { Channel } from '../types/channel';
import type { Message } from '../types/message';
import type { Server } from '../types/server';
import type {
  ErrorPayload,
  ServerDeletedPayload,
  ServerMemberEventPayload,
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
  const { serverId: currentServerId } = useParams<{ serverId?: string }>();
  const token = useAuthStore((state) => state.token);
  const setNotification = useNotificationStore((state) => state.setMessage);

  // The SERVER_DELETE subscriber below is set up once (empty-ish dep effect) but needs the
  // *current* route's serverId at the moment the event arrives, not the one captured at
  // subscribe time — a ref keeps it fresh without re-subscribing on every navigation.
  const currentServerIdRef = useRef(currentServerId);
  useLayoutEffect(() => {
    currentServerIdRef.current = currentServerId;
  }, [currentServerId]);

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
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [queryClient, navigate, setNotification]);
}
