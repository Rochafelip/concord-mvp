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

function resolvedTicket(ticket: string) {
  return () => Promise.resolve(ticket);
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

  it('connect() opens a socket with the ticket in the query string, built from window.location', async () => {
    const { websocketClient } = await loadClient();
    await websocketClient.connect(resolvedTicket('ticket-abc'));

    expect(FakeWebSocket.instances).toHaveLength(1);
    const socket = FakeWebSocket.instances[0];
    expect(socket.url).toBe(`ws://${window.location.host}/ws?token=ticket-abc`);
  });

  it('updates wsConnectionStore status to connected on open', async () => {
    const { websocketClient, useWsConnectionStore } = await loadClient();
    const connecting = websocketClient.connect(resolvedTicket('ticket-abc'));
    expect(useWsConnectionStore.getState().status).toBe('connecting');
    await connecting;

    const socket = FakeWebSocket.instances[0];
    socket.readyState = FakeWebSocket.OPEN;
    socket.onopen?.();

    expect(useWsConnectionStore.getState().status).toBe('connected');
  });

  it('send() serializes and sends over the socket when open', async () => {
    const { websocketClient } = await loadClient();
    await websocketClient.connect(resolvedTicket('ticket-abc'));
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
    await websocketClient.connect(resolvedTicket('ticket-abc'));
    // Left in CONNECTING state — never transitioned to OPEN.

    expect(() =>
      websocketClient.send({ type: 'MESSAGE_CREATE', payload: {} }),
    ).not.toThrow();
    expect(FakeWebSocket.instances[0].sent).toHaveLength(0);
  });

  it('subscribe() delivers an incoming event to every subscriber of that type', async () => {
    const { websocketClient } = await loadClient();
    await websocketClient.connect(resolvedTicket('ticket-abc'));
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
    await websocketClient.connect(resolvedTicket('ticket-abc'));
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
    await websocketClient.connect(resolvedTicket('ticket-abc'));
    const socket = FakeWebSocket.instances[0];

    expect(() =>
      socket.onmessage?.({ data: JSON.stringify({ type: 'SOMETHING_NEW', payload: {} }) }),
    ).not.toThrow();
  });

  it('schedules a reconnect using a freshly fetched ticket after an unintentional close', async () => {
    vi.useFakeTimers();
    const { websocketClient, useWsConnectionStore } = await loadClient();
    let callCount = 0;
    const getTicket = vi.fn(() => Promise.resolve(`ticket-${++callCount}`));
    await websocketClient.connect(getTicket);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0].url).toContain('token=ticket-1');

    // Simulate the browser/server closing the connection (not via disconnect()).
    FakeWebSocket.instances[0].onclose?.();
    expect(useWsConnectionStore.getState().status).toBe('disconnected');
    expect(FakeWebSocket.instances).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(2999);
    expect(FakeWebSocket.instances).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(getTicket).toHaveBeenCalledTimes(2);
    expect(FakeWebSocket.instances[1].url).toContain('token=ticket-2');
  });

  it('does not throw when the ticket provider rejects, and still schedules a reconnect', async () => {
    vi.useFakeTimers();
    const { websocketClient, useWsConnectionStore } = await loadClient();
    let attempt = 0;
    const getTicket = vi.fn(() => {
      attempt += 1;
      return attempt === 1
        ? Promise.reject(new Error('network down'))
        : Promise.resolve('ticket-2');
    });

    await expect(websocketClient.connect(getTicket)).resolves.toBeUndefined();
    expect(FakeWebSocket.instances).toHaveLength(0);
    expect(useWsConnectionStore.getState().status).toBe('disconnected');

    await vi.advanceTimersByTimeAsync(3000);

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0].url).toContain('token=ticket-2');
  });

  it('connect() called again while a socket is still open closes the stale one instead of leaking it', async () => {
    const { websocketClient } = await loadClient();
    await websocketClient.connect(resolvedTicket('ticket-1'));
    const first = FakeWebSocket.instances[0];
    first.readyState = FakeWebSocket.OPEN;

    await websocketClient.connect(resolvedTicket('ticket-2'));

    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(first.readyState).toBe(FakeWebSocket.CLOSED);
  });

  it('connect() called again does not schedule a reconnect off the stale socket closing', async () => {
    vi.useFakeTimers();
    const { websocketClient } = await loadClient();
    await websocketClient.connect(resolvedTicket('ticket-1'));
    const first = FakeWebSocket.instances[0];
    first.readyState = FakeWebSocket.OPEN;

    await websocketClient.connect(resolvedTicket('ticket-2'));
    expect(FakeWebSocket.instances).toHaveLength(2);

    // Only the reconnect timer a genuine unintentional close of the *new* socket would schedule
    // is allowed to fire — the stale socket's close (triggered above by the second connect())
    // must not have queued one of its own.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it('connect() called again stops the stale socket from double-dispatching incoming events', async () => {
    const { websocketClient } = await loadClient();
    await websocketClient.connect(resolvedTicket('ticket-1'));
    const first = FakeWebSocket.instances[0];
    first.readyState = FakeWebSocket.OPEN;

    await websocketClient.connect(resolvedTicket('ticket-2'));
    const second = FakeWebSocket.instances[1];
    second.readyState = FakeWebSocket.OPEN;

    const handler = vi.fn();
    websocketClient.subscribe('MESSAGE_CREATE', handler);

    // The stale socket's onmessage was stripped by the second connect(), so this must be a
    // no-op rather than reaching the shared subscriber.
    first.onmessage?.({ data: JSON.stringify({ type: 'MESSAGE_CREATE', payload: { id: 'stale' } }) });
    expect(handler).not.toHaveBeenCalled();

    second.onmessage?.({ data: JSON.stringify({ type: 'MESSAGE_CREATE', payload: { id: 'fresh' } }) });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ id: 'fresh' });
  });

  it('disconnect() closes intentionally and prevents the reconnect from firing', async () => {
    vi.useFakeTimers();
    const { websocketClient, useWsConnectionStore } = await loadClient();
    await websocketClient.connect(resolvedTicket('ticket-abc'));

    websocketClient.disconnect();
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(useWsConnectionStore.getState().status).toBe('disconnected');

    await vi.advanceTimersByTimeAsync(10_000);

    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});
