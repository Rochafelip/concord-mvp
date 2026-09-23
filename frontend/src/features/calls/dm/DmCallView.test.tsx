import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { voiceClient } from '../../../services/voiceClient';
import * as hooksModule from '../hooks';
import { DmCallView } from './DmCallView';
import { useDmCallStore } from './dmCallStore';

vi.mock('../../../services/voiceClient', () => ({
  voiceClient: { disconnect: vi.fn() },
}));

vi.mock('../hooks', () => ({
  useVoiceParticipants: vi.fn(() => []),
  useVoicePresence: vi.fn(() => ({ data: [] })),
  // Needed transitively: CallControlBar's useCallPip() calls this to auto-close an open PiP
  // window once the call disconnects (docs/superpowers/specs/2026-09-23-call-pip-design.md).
  useVoiceStatus: vi.fn(() => ({ status: 'connected', channelId: null, error: null, isDeafened: false })),
}));

function localParticipant() {
  return {
    identity: 'u1',
    name: 'Ana',
    isLocal: true,
    micEnabled: true,
    cameraEnabled: false,
    videoTrack: null,
    screenShareEnabled: false,
    screenShareTrack: null,
    screenShareHasAudio: false,
    screenShareAudioEnabled: false,
    connectionQuality: 'unknown',
  };
}

function renderDmCallView() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DmCallView />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DmCallView', () => {
  beforeEach(() => {
    vi.mocked(voiceClient.disconnect).mockClear();
    vi.mocked(hooksModule.useVoiceParticipants).mockReturnValue([]);
    useDmCallStore.setState({
      status: 'connected',
      callId: 'call-1',
      role: 'caller',
      peer: { id: 'u2', displayName: 'Bob', avatarUrl: null },
    });
  });

  it("shows the peer's name in the header", () => {
    renderDmCallView();

    expect(screen.getByText('Chamada com Bob')).toBeInTheDocument();
  });

  it('leaving the call disconnects voiceClient and resets the store', async () => {
    vi.mocked(hooksModule.useVoiceParticipants).mockReturnValue([localParticipant()] as never);
    const user = userEvent.setup();
    renderDmCallView();

    await user.click(screen.getByRole('button', { name: 'Leave call' }));

    expect(voiceClient.disconnect).toHaveBeenCalledTimes(1);
    expect(useDmCallStore.getState().status).toBe('idle');
  });
});
