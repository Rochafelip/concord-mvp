import { act, render, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { voiceClient } from '../../services/voiceClient';
import { useAuthStore } from '../auth/authStore';
import * as api from './api';
import { useDisconnectVoiceOnLogout, useJoinVoiceChannel } from './hooks';

vi.mock('../../services/voiceClient', () => ({
  voiceClient: { disconnect: vi.fn(), beginConnect: vi.fn(() => 42), connect: vi.fn() },
}));

vi.mock('./api', () => ({
  getVoiceToken: vi.fn(),
}));

function TestHarness() {
  useDisconnectVoiceOnLogout();
  return null;
}

describe('useDisconnectVoiceOnLogout', () => {
  beforeEach(() => {
    vi.mocked(voiceClient.disconnect).mockClear();
    useAuthStore.setState({ token: 'jwt-abc', user: null });
  });

  afterEach(() => {
    useAuthStore.setState({ token: null, user: null });
  });

  it('does not disconnect while a session is active', () => {
    render(<TestHarness />);

    expect(voiceClient.disconnect).not.toHaveBeenCalled();
  });

  it('disconnects when the token is cleared (logout)', () => {
    render(<TestHarness />);

    act(() => {
      useAuthStore.getState().logout();
    });

    expect(voiceClient.disconnect).toHaveBeenCalledTimes(1);
  });

  it('disconnects on unmount while still authenticated', () => {
    const { unmount } = render(<TestHarness />);

    unmount();

    expect(voiceClient.disconnect).toHaveBeenCalledTimes(1);
  });

  it('does nothing if there was never a session to begin with', () => {
    useAuthStore.setState({ token: null, user: null });
    const { unmount } = render(<TestHarness />);

    unmount();

    expect(voiceClient.disconnect).not.toHaveBeenCalled();
  });
});

describe('useJoinVoiceChannel', () => {
  it('captures the connection generation via beginConnect before awaiting the voice token', async () => {
    let resolveToken!: (value: { token: string; url: string; roomName: string }) => void;
    vi.mocked(api.getVoiceToken).mockReturnValue(
      new Promise((resolve) => {
        resolveToken = resolve;
      }),
    );

    const { result } = renderHook(() => useJoinVoiceChannel(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          {children}
        </QueryClientProvider>
      ),
    });
    result.current.mutate('channel-1');

    // beginConnect must already have run by the time the token fetch is still pending — that's
    // the fix: capturing the generation happens before the async gap, not after it.
    await waitFor(() => expect(voiceClient.beginConnect).toHaveBeenCalledWith('channel-1'));
    expect(voiceClient.connect).not.toHaveBeenCalled();

    resolveToken({ token: 'token-a', url: 'wss://example.test/livekit', roomName: 'channel-1' });

    await waitFor(() =>
      expect(voiceClient.connect).toHaveBeenCalledWith('channel-1', 'token-a', 'wss://example.test/livekit', 42),
    );
  });
});
