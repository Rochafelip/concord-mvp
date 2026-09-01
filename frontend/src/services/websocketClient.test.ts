import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 3;

  readonly url: string;
  readyState = FakeWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }
}

// Each test dynamically imports websocketClient AND wsConnectionStore together, after
// vi.resetModules(), so both come from the same fresh module instance — importing the store
// statically at the top of this file would give tests a stale copy, disconnected from the one
// the freshly re-imported websocketClient actually calls `.getState()` on.
async function loadClient() {
  const { websocketClient } = await import('./websocketClient');
  const { useWsConnectionStore } = await import('../stores/wsConnectionStore');
  return { websocketClient, useWsConnectionStore };
}

describe('websocketClient', () => {
  beforeEach(() => {
    vi.resetModules();
    FakeWebSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('connect() opens a socket with the token in the query string, built from window.location', async () => {
    const { websocketClient } = await loadClient();
    websocketClient.connect('jwt-abc');

    expect(FakeWebSocket.instances).toHaveLength(1);
    const socket = FakeWebSocket.instances[0];
    expect(socket.url).toBe(`ws://${window.location.host}/ws?token=jwt-abc`);
  });

  it('updates wsConnectionStore status to connected on open', async () => {
    const { websocketClient, useWsConnectionStore } = await loadClient();
    websocketClient.connect('jwt-abc');
    expect(useWsConnectionStore.getState().status).toBe('connecting');

    const socket = FakeWebSocket.instances[0];
    socket.readyState = FakeWebSocket.OPEN;
    socket.onopen?.();

    expect(useWsConnectionStore.getState().status).toBe('connected');
  });

  it('send() serializes and sends over the socket when open', async () => {
    const { websocketClient } = await loadClient();
    websocketClient.connect('jwt-abc');
    const socket = FakeWebSocket.instances[0];
    socket.readyState = FakeWebSocket.OPEN;

    websocketClient.send({ type: 'MESSAGE_CREATE', payload: { channelId: 'c1', content: 'hi' } });

    expect(socket.sent).toHaveLength(1);
    expect(JSON.parse(socket.sent[0])).toEqual({
      type: 'MESSAGE_CREATE',
      payload: { channelId: 'c1', content: 'hi' },
    });
  });

  it('send() does not throw and does not send when the socket is not open', async () => {
    const { websocketClient } = await loadClient();
    websocketClient.connect('jwt-abc');
    // Left in CONNECTING state — never transitioned to OPEN.

    expect(() =>
      websocketClient.send({ type: 'MESSAGE_CREATE', payload: {} }),
    ).not.toThrow();
    expect(FakeWebSocket.instances[0].sent).toHaveLength(0);
  });

  it('subscribe() delivers an incoming event to every subscriber of that type', async () => {
    const { websocketClient } = await loadClient();
    websocketClient.connect('jwt-abc');
    const socket = FakeWebSocket.instances[0];

    const handlerA = vi.fn();
    const handlerB = vi.fn();
    websocketClient.subscribe('MESSAGE_CREATE', handlerA);
    websocketClient.subscribe('MESSAGE_CREATE', handlerB);

    socket.onmessage?.({ data: JSON.stringify({ type: 'MESSAGE_CREATE', payload: { id: 'm1' } }) });

    expect(handlerA).toHaveBeenCalledWith({ id: 'm1' });
    expect(handlerB).toHaveBeenCalledWith({ id: 'm1' });
  });

  it('subscribe()s returned unsubscribe function stops that handler from firing', async () => {
    const { websocketClient } = await loadClient();
    websocketClient.connect('jwt-abc');
    const socket = FakeWebSocket.instances[0];

    const handlerA = vi.fn();
    const handlerB = vi.fn();
    const unsubscribeA = websocketClient.subscribe('MESSAGE_CREATE', handlerA);
    websocketClient.subscribe('MESSAGE_CREATE', handlerB);
    unsubscribeA();

    socket.onmessage?.({ data: JSON.stringify({ type: 'MESSAGE_CREATE', payload: { id: 'm2' } }) });

    expect(handlerA).not.toHaveBeenCalled();
    expect(handlerB).toHaveBeenCalledWith({ id: 'm2' });
  });

  it('logs and ignores an unrecognized event type instead of crashing', async () => {
    const { websocketClient } = await loadClient();
    websocketClient.connect('jwt-abc');
    const socket = FakeWebSocket.instances[0];

    expect(() =>
      socket.onmessage?.({ data: JSON.stringify({ type: 'SOMETHING_NEW', payload: {} }) }),
    ).not.toThrow();
  });

  it('schedules a reconnect using the last token after an unintentional close', async () => {
    vi.useFakeTimers();
    const { websocketClient, useWsConnectionStore } = await loadClient();
    websocketClient.connect('jwt-abc');
    expect(FakeWebSocket.instances).toHaveLength(1);

    // Simulate the browser/server closing the connection (not via disconnect()).
    FakeWebSocket.instances[0].onclose?.();
    expect(useWsConnectionStore.getState().status).toBe('disconnected');
    expect(FakeWebSocket.instances).toHaveLength(1);

    vi.advanceTimersByTime(2999);
    expect(FakeWebSocket.instances).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(FakeWebSocket.instances[1].url).toContain('token=jwt-abc');
  });

  it('disconnect() closes intentionally and prevents the reconnect from firing', async () => {
    vi.useFakeTimers();
    const { websocketClient, useWsConnectionStore } = await loadClient();
    websocketClient.connect('jwt-abc');

    websocketClient.disconnect();
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(useWsConnectionStore.getState().status).toBe('disconnected');

    vi.advanceTimersByTime(10_000);

    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});
