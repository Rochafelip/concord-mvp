import type { InfiniteData } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toVoicePresenceEntry } from '../features/calls/api';
import { useAuthStore } from '../features/auth/authStore';
import { getWsTicket } from '../features/auth/api';
import { notify, playChime } from '../services/desktopNotifications';
import { websocketClient } from '../services/websocketClient';
import { getVoiceToken } from '../features/calls/api';
import { voiceClient } from '../services/voiceClient';
import { useNotificationStore } from '../stores/notificationStore';
import { useVoiceStore } from '../stores/voiceStore';
import type { Channel } from '../types/channel';
import type { DmMessage } from '../types/dm';
import type { Message } from '../types/message';
import type { Server } from '../types/server';
import type { VoicePresenceEntry } from '../types/voice';
import type {
  ChannelDeletedPayload,
  ErrorPayload,
  FriendUpdatePayload,
  MessageDeletedPayload,
  PermissionsUpdatePayload,
  ServerDeletedPayload,
  ServerMemberEventPayload,
  ServerMemberUpdatePayload,
  VoicePresenceLeavePayload,
  VoicePresencePayload,
  UserProfileUpdatePayload,
  ChannelReadPayload,
} from '../types/websocket';

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

/**
 * Mounted ONCE in AppShell (which only renders once authenticated, per ProtectedRoute — the
 * session is guaranteed authenticated). Owns the WebSocket connection's lifecycle and translates every
 * server -> client event into a TanStack Query cache update, targeting the EXACT query keys
 * established by features/servers/hooks.ts and features/channels/hooks.ts.
 */
export function useRealtimeSync(): void {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { serverId: currentServerId, channelId: currentChannelId, friendUserId: currentFriendUserId } = useParams<{
    serverId?: string;
    channelId?: string;
    friendUserId?: string;
  }>();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setNotification = useNotificationStore((state) => state.setMessage);
  const markServerUnread = useNotificationStore((state) => state.markServerUnread);
  const markFriendUnread = useNotificationStore((state) => state.markFriendUnread);

  // The SERVER_DELETE and CHANNEL_DELETE subscribers below are set up once (empty-ish dep
  // effect) but need the *current* route's serverId/channelId at the moment the event arrives,
  // not the values captured at subscribe time — refs keep them fresh without re-subscribing on
  // every navigation.
  const currentServerIdRef = useRef(currentServerId);
  const currentChannelIdRef = useRef(currentChannelId);
  const currentFriendUserIdRef = useRef(currentFriendUserId);
  const currentPathRef = useRef(location.pathname);
  const voiceKickNotificationTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  useLayoutEffect(() => {
    currentServerIdRef.current = currentServerId;
    currentChannelIdRef.current = currentChannelId;
    currentFriendUserIdRef.current = currentFriendUserId;
    currentPathRef.current = location.pathname;
  }, [currentServerId, currentChannelId, currentFriendUserId, location.pathname]);

  useEffect(() => {
    if (!isAuthenticated) return;
    websocketClient.connect(() => getWsTicket().then((response) => response.ticket));
    return () => {
      websocketClient.disconnect();
    };
  }, [isAuthenticated]);

  useEffect(() => {
    const unsubscribers = [
      websocketClient.subscribe('MESSAGE_CREATE', (payload) => {
        const message = payload as Message;
        const currentUserId = useAuthStore.getState().user?.id;
        queryClient.setQueryData<InfiniteData<Message[]>>(
          ['channels', message.channelId, 'messages'],
          (old) => {
            // Only update if this channel's history is already cached (the user has opened it
            // before) — don't force-create a cache entry for a channel nobody's looking at.
            if (!old || old.pages.length === 0) return old;
            // A redelivered event (e.g. a reconnect window where more than one session briefly
            // sees the broadcast) must not insert the same message twice.
            if (old.pages.some((page) => page.some((existing) => existing.id === message.id))) {
              return old;
            }
            // pages[0] holds the newest-fetched (most recent) messages — see hooks.ts.
            const pages = old.pages.map((page, index) =>
              index === 0 ? [...page, message] : page,
            );
            return { ...old, pages };
          },
        );

        // The server broadcasts a message back to its author as well. Only notify other
        // users, including system messages posted to the onboarding channel.
        if (message.author.id !== currentUserId) {
          const channel =
            queryClient.getQueryData<Channel>(['channels', message.channelId]) ??
            queryClient
              .getQueryData<Channel[]>(['servers', currentServerIdRef.current, 'channels'])
              ?.find((candidate) => candidate.id === message.channelId) ??
            queryClient
              .getQueriesData<Channel[]>({ queryKey: ['servers'] })
              .flatMap(([, channels]) => channels ?? [])
              .find((candidate) => candidate.id === message.channelId);
          const isOnboarding = channel?.name?.toLowerCase() === 'onboarding';
          const { messageNotifications, onboardingNotifications } =
            useNotificationStore.getState().preferences;
          const notificationsEnabled =
            (!isOnboarding && messageNotifications) || (isOnboarding && onboardingNotifications);
          if (notificationsEnabled) {
            const serverId = channel?.serverId;
            if (serverId && serverId !== currentServerIdRef.current) {
              markServerUnread(serverId);
            }

            // Discord-style: a desktop (Chrome) notification only fires when the window itself
            // is backgrounded, regardless of which channel the user has open — being on a
            // different channel while the window has focus is covered by the unread badges above.
            if (serverId && (document.hidden || !document.hasFocus())) {
              const serverName = queryClient
                .getQueryData<Server[]>(['servers'])
                ?.find((server) => server.id === serverId)?.name;
              playChime();
              notify({
                title: message.author.displayName,
                body: truncate(`#${channel?.name} · ${serverName}\n${message.content}`, 120),
                onClick: () => navigate(`/app/servers/${serverId}/channels/${message.channelId}`),
              });
            }
          }

          // Increment unread count for the channel if it's not the current channel
          if (message.channelId !== currentChannelIdRef.current) {
            // Update the specific channel in all channel list queries
            queryClient.setQueryData<Channel[]>(['servers', currentServerIdRef.current, 'channels'], (old) => {
              if (!old) return old;
              return old.map((ch) =>
                ch.id === message.channelId
                  ? { ...ch, unreadCount: (ch.unreadCount || 0) + 1 }
                  : ch
              );
            });

            // Also update the single channel cache if it exists
            queryClient.setQueryData<Channel>(['channels', message.channelId], (old) => {
              if (!old) return old;
              return { ...old, unreadCount: (old.unreadCount || 0) + 1 };
            });
          }
        }
      }),

      websocketClient.subscribe('MESSAGE_DELETE', (payload) => {
        const { messageId, channelId } = payload as MessageDeletedPayload;
        queryClient.setQueryData<InfiniteData<Message[]>>(
          ['channels', channelId, 'messages'],
          (old) => old
            ? { ...old, pages: old.pages.map((page) => page.filter((message) => message.id !== messageId)) }
            : old,
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

      websocketClient.subscribe('SERVER_MEMBER_UPDATE', (payload) => {
        const { serverId, userId, displayName } = payload as ServerMemberUpdatePayload;
        queryClient.setQueryData<import('../types/server').ServerMember[]>(
          ['servers', serverId, 'members'],
          (members) => members?.map((member) =>
            member.user.id === userId ? { ...member, displayName } : member,
          ),
        );
        queryClient.setQueryData<VoicePresenceEntry[]>(
          ['servers', serverId, 'voice-presence'],
          (entries) => entries?.map((entry) =>
            entry.userId === userId ? { ...entry, displayName } : entry,
          ),
        );
      }),

      websocketClient.subscribe('PERMISSIONS_UPDATE', (payload) => {
        const { serverId } = payload as PermissionsUpdatePayload;

        // TanStack matches query keys by prefix, so this one call covers the server itself plus
        // its channels, members and roles. The per-channel queries are keyed by channel id
        // rather than by server, so they need their own prefix.
        queryClient.invalidateQueries({ queryKey: ['servers', serverId] });
        queryClient.invalidateQueries({ queryKey: ['channels'] });

        // A LiveKit grant is fixed when the token is minted (docs/DECISIONS.md D20), so a call
        // already in progress keeps the permissions it started with until it reconnects with a
        // fresh token. voiceClient.connect() tears down the existing room itself, which keeps
        // the gap to a few hundred milliseconds instead of a visible leave-then-join.
        const voiceState = useVoiceStore.getState();
        const voiceChannelId = voiceState.channelId;
        if (voiceState.status !== 'connected' || !voiceChannelId) return;

        const voiceChannel = queryClient.getQueryData<Channel>(['channels', voiceChannelId]);
        if (voiceChannel != null && voiceChannel.serverId !== serverId) return;

        void (async () => {
          try {
            const generation = voiceClient.beginConnect(voiceChannelId);
            const { token, url } = await getVoiceToken(voiceChannelId);
            await voiceClient.connect(voiceChannelId, token, url, generation);
          } catch {
            // Most likely the permission change is exactly what revoked CONNECT. Dropping the
            // call is the correct outcome then, and the channel list refetch above already
            // removes the channel from view.
            voiceClient.disconnect();
          }
        })();
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
          // Update in place rather than filter-then-append: this event fires on every presence
          // change (mic/camera/screen-share/speaking), and re-appending would shuffle a user to
          // the end of the list every time they spoke.
          const index = old.findIndex((existing) => existing.userId === entry.userId);
          if (index === -1) return [...old, entry];
          const next = [...old];
          next[index] = entry;
          return next;
        });
      }),

      websocketClient.subscribe('VOICE_PRESENCE_LEAVE', (payload) => {
        const { serverId, userId } = payload as VoicePresenceLeavePayload;
        queryClient.setQueryData<VoicePresenceEntry[]>(['servers', serverId, 'voice-presence'], (old) =>
          old?.filter((entry) => entry.userId !== userId),
        );
      }),

      websocketClient.subscribe('VOICE_KICK', (payload) => {
        const { serverId, channelId, userId } = payload as VoicePresenceLeavePayload;
        queryClient.setQueryData<VoicePresenceEntry[]>(['servers', serverId, 'voice-presence'], (old) =>
          old?.filter((entry) => entry.userId !== userId),
        );

        if (useVoiceStore.getState().channelId === channelId) {
          useVoiceStore.getState().setParticipants(
            useVoiceStore.getState().participants.filter((participant) => participant.identity !== userId),
          );
        }

        if (useAuthStore.getState().user?.id === userId) {
          navigate(`/app/servers/${serverId}`, { replace: true });
          voiceClient.disconnect();
          const message = 'You were disconnected from the voice channel by a server admin.';
          setNotification(message);
          if (voiceKickNotificationTimeoutRef.current != null) {
            window.clearTimeout(voiceKickNotificationTimeoutRef.current);
          }
          voiceKickNotificationTimeoutRef.current = window.setTimeout(() => {
            if (useNotificationStore.getState().message === message) {
              useNotificationStore.getState().clear();
            }
          }, 5000);
        }
      }),

      websocketClient.subscribe('USER_PROFILE_UPDATE', (payload) => {
        const { user } = payload as UserProfileUpdatePayload;
        const currentUser = useAuthStore.getState().user;
        if (currentUser?.id === user.id) {
          useAuthStore.getState().setUser({ ...currentUser, ...user });
        }

        queryClient.setQueriesData({ queryKey: ['servers'] }, (data: unknown) => {
          if (!data) return data;
          const replace = (value: unknown): unknown => {
            if (Array.isArray(value)) return value.map(replace);
            if (value && typeof value === 'object') {
              const record = value as Record<string, unknown>;
              if (record.userId === user.id && 'displayName' in record) {
                return { ...record, displayName: user.displayName, avatarUrl: user.avatarUrl };
              }
              if (record.id === user.id && 'avatarUrl' in record) return { ...record, ...user };
              if ('author' in record && record.author && typeof record.author === 'object') {
                const author = record.author as Record<string, unknown>;
                return author.id === user.id ? { ...record, author: { ...author, ...user } } : record;
              }
              if ('user' in record && record.user && typeof record.user === 'object') {
                const nested = record.user as Record<string, unknown>;
                return nested.id === user.id ? { ...record, user: { ...nested, ...user } } : record;
              }
            }
            return value;
          };
          return replace(data);
        });
        queryClient.setQueriesData({ queryKey: ['channels'] }, (data: unknown) => {
          if (!data) return data;
          const pages = data as { pages?: unknown[] };
          if (Array.isArray(pages.pages)) {
            const replace = (value: unknown): unknown => {
              if (Array.isArray(value)) return value.map(replace);
              if (value && typeof value === 'object') {
                const record = value as Record<string, unknown>;
                if (record.author && typeof record.author === 'object') {
                  const author = record.author as Record<string, unknown>;
                  if (author.id === user.id) return { ...record, author: { ...author, ...user } };
                }
              }
              return value;
            };
            return { ...data, pages: pages.pages.map(replace) };
          }
          return data;
        });
      }),

      websocketClient.subscribe('DM_MESSAGE_CREATE', (payload) => {
        const message = payload as DmMessage;
        const currentUserId = useAuthStore.getState().user?.id;
        const otherUserId = message.author.id === currentUserId ? message.recipientId : message.author.id;

        queryClient.setQueryData<InfiniteData<DmMessage[]>>(['dm', otherUserId, 'messages'], (old) => {
          // Same guards as MESSAGE_CREATE above: don't force-create a cache entry for a
          // conversation nobody has opened, and never insert a redelivered message twice.
          if (!old || old.pages.length === 0) return old;
          if (old.pages.some((page) => page.some((existing) => existing.id === message.id))) {
            return old;
          }
          const pages = old.pages.map((page, index) => (index === 0 ? [...page, message] : page));
          return { ...old, pages };
        });

        if (message.author.id !== currentUserId) {
          if (otherUserId !== currentFriendUserIdRef.current) {
            markFriendUnread(otherUserId);
          }

          const { messageNotifications } = useNotificationStore.getState().preferences;
          if (messageNotifications && (document.hidden || !document.hasFocus())) {
            playChime();
            notify({
              title: message.author.displayName,
              body: truncate(message.content, 120),
              onClick: () => navigate(`/app/dm/${otherUserId}`),
            });
          }
        }
      }),

      websocketClient.subscribe('FRIEND_UPDATE', (payload) => {
        const { userId, otherUserId } = payload as FriendUpdatePayload;
        const currentUserId = useAuthStore.getState().user?.id;

        // Prefix match: also covers ['friends', 'requests'] — same reasoning as
        // PERMISSIONS_UPDATE's invalidation above.
        queryClient.invalidateQueries({ queryKey: ['friends'] });

        const relevantOtherId = userId === currentUserId ? otherUserId : userId;
        if (!currentPathRef.current.startsWith('/app/friends')) {
          markFriendUnread(relevantOtherId);
        }
      }),

      websocketClient.subscribe('CHANNEL_READ', (payload) => {
        const { channelId, userId, unreadCount } = payload as ChannelReadPayload;
        if (userId !== useAuthStore.getState().user?.id) return;

        // Update the channel's unread count in all relevant caches
        queryClient.setQueryData<Channel[]>(['servers', currentServerIdRef.current, 'channels'], (old) => {
          if (!old) return old;
          return old.map((ch) =>
            ch.id === channelId ? { ...ch, unreadCount } : ch
          );
        });

        // Also update the single channel cache if it exists
        queryClient.setQueryData<Channel>(['channels', channelId], (old) => {
          if (!old) return old;
          return { ...old, unreadCount };
        });
      }),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      if (voiceKickNotificationTimeoutRef.current != null) {
        window.clearTimeout(voiceKickNotificationTimeoutRef.current);
      }
    };
  }, [markServerUnread, markFriendUnread, queryClient, navigate, setNotification]);
}
