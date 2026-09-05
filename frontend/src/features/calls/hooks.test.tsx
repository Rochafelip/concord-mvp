import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { voiceClient } from '../../services/voiceClient';
import { useAuthStore } from '../auth/authStore';
import { useDisconnectVoiceOnLogout } from './hooks';

vi.mock('../../services/voiceClient', () => ({
  voiceClient: { disconnect: vi.fn() },
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
