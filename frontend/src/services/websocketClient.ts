import { useWsConnectionStore } from '../stores/wsConnectionStore';
import type { WsEvent, WsEventType } from '../types/websocket';

const RECONNECT_DELAY_MS = 3000;

type EventHandler = (payload: unknown) => void;

/**
 * Returns a fresh, short-lived WS ticket (see features/auth/api.ts's getWsTicket) each time
 * it's called — never a cached token — so every connection attempt, including reconnects,
 * authenticates with a ticket that hasn't already been spent or expired.
 */
type TicketProvider = () => Promise<string>;

/**
 * Thin wrapper around the native WebSocket. A single instance (the singleton exported below)
 * is shared app-wide: connected once by useRealtimeSync on mount, subscribed to by any feature
 * that needs to react to a given event type.
 *
 * Reconnection is deliberately simple (fixed delay, no backoff) — this is a small friends app,
 * not something that needs to survive a thundering herd.
 */
class WebSocketClient {
  private socket: WebSocket | null = null;
  private subscribers = new Map<WsEventType, Set<EventHandler>>();
  private lastTicketProvider: TicketProvider | null = null;
  private intentionalDisconnect = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  connect(getTicket: TicketProvider): Promise<void> {
    this.lastTicketProvider = getTicket;
    this.intentionalDisconnect = false;
    return this.openSocket(getTicket);
  }

  private async openSocket(getTicket: TicketProvider): Promise<void> {
    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    useWsConnectionStore.getState().setStatus('connecting');

    let ticket: string;
    try {
      ticket = await getTicket();
    } catch (error) {
      // Couldn't even get a ticket (e.g. the request failed, or the session expired) — treat
      // it like a failed connection attempt so the usual reconnect timer retries.
      console.error('Failed to obtain WebSocket ticket', error);
      useWsConnectionStore.getState().setStatus('disconnected');
      this.scheduleReconnect(getTicket);
      return;
    }

    // Always built from window.location, never a hardcoded backend host/port — the dev proxy
    // (vite.config.ts) and nginx in production both forward /ws to the backend for whatever
    // origin the page was served from.
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(ticket)}`;

    const socket = new WebSocket(url);
    this.socket = socket;

    socket.onopen = () => {
      useWsConnectionStore.getState().setStatus('connected');
    };

    socket.onclose = () => {
      useWsConnectionStore.getState().setStatus('disconnected');
      // Only reconnect if this close wasn't requested via disconnect() (e.g. logout).
      if (!this.intentionalDisconnect && this.lastTicketProvider != null) {
        this.scheduleReconnect(this.lastTicketProvider);
      }
    };

    socket.onerror = (event) => {
      // The browser fires `close` shortly after `error`, which drives the reconnect above —
      // nothing else to do here besides not letting it throw uncaught.
      console.error('WebSocket error', event);
    };

    socket.onmessage = (event) => {
      let parsed: WsEvent;
      try {
        parsed = JSON.parse(event.data as string) as WsEvent;
      } catch (error) {
        console.error('Failed to parse WebSocket message', error);
        return;
      }

      const handlers = this.subscribers.get(parsed.type);
      if (handlers) {
        handlers.forEach((handler) => handler(parsed.payload));
      }
    };
  }

  private scheduleReconnect(getTicket: TicketProvider): void {
    this.reconnectTimer = setTimeout(() => {
      void this.openSocket(getTicket);
    }, RECONNECT_DELAY_MS);
  }

  disconnect(): void {
    this.intentionalDisconnect = true;
    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
    useWsConnectionStore.getState().setStatus('disconnected');
  }

  send(event: { type: string; payload: unknown }): void {
    if (this.socket != null && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(event));
    } else {
      // Fail silently (per design): a send attempt while disconnected shouldn't throw. Callers
      // that care (e.g. MessageInput) can check wsConnectionStore's status themselves.
      console.warn('Cannot send over WebSocket: not connected', event);
    }
  }

  subscribe(type: WsEventType, handler: EventHandler): () => void {
    let handlers = this.subscribers.get(type);
    if (!handlers) {
      handlers = new Set();
      this.subscribers.set(type, handlers);
    }
    handlers.add(handler);

    return () => {
      this.subscribers.get(type)?.delete(handler);
    };
  }
}

export const websocketClient = new WebSocketClient();
