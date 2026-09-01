import { useWsConnectionStore } from '../stores/wsConnectionStore';
import type { WsEvent, WsEventType } from '../types/websocket';

const RECONNECT_DELAY_MS = 3000;

type EventHandler = (payload: unknown) => void;

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
  private lastToken: string | null = null;
  private intentionalDisconnect = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  connect(token: string): void {
    this.lastToken = token;
    this.intentionalDisconnect = false;
    this.openSocket(token);
  }

  private openSocket(token: string): void {
    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    useWsConnectionStore.getState().setStatus('connecting');

    // Always built from window.location, never a hardcoded backend host/port — the dev proxy
    // (vite.config.ts) and nginx in production both forward /ws to the backend for whatever
    // origin the page was served from.
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;

    const socket = new WebSocket(url);
    this.socket = socket;

    socket.onopen = () => {
      useWsConnectionStore.getState().setStatus('connected');
    };

    socket.onclose = () => {
      useWsConnectionStore.getState().setStatus('disconnected');
      // Only reconnect if this close wasn't requested via disconnect() (e.g. logout).
      if (!this.intentionalDisconnect && this.lastToken != null) {
        const token = this.lastToken;
        this.reconnectTimer = setTimeout(() => {
          this.openSocket(token);
        }, RECONNECT_DELAY_MS);
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
