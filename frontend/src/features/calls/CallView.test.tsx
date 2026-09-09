import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { voiceClient } from '../../services/voiceClient';
import { useVoiceStore } from '../../stores/voiceStore';
import type { Channel } from '../../types/channel';
import { CallView } from './CallView';
import * as hooksModule from './hooks';

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('../../services/voiceClient', () => ({
  voiceClient: { disconnect: vi.fn() },
}));

vi.mock('./hooks', () => ({
  useJoinVoiceChannel: vi.fn(),
  useVoiceStatus: vi.fn(() => ({ status: 'connected', channelId: 'c1', error: null })),
  useVoiceParticipants: vi.fn(() => []),
  useVoicePresence: vi.fn(() => ({ data: [] })),
}));

function channel(id: string): Channel {
  return { id, serverId: 's1', name: 'lobby', type: 'VOICE', createdAt: '2026-01-01', updatedAt: '2026-01-01' };
}

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

function renderCallView(ch: Channel) {
  return render(
    <MemoryRouter initialEntries={[`/app/servers/${ch.serverId}/channels/${ch.id}`]}>
      <Routes>
        <Route path="/app/servers/:serverId/channels/:channelId" element={<CallView channel={ch} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CallView', () => {
  const mutate = vi.fn();

  beforeEach(() => {
    mutate.mockClear();
    navigateMock.mockClear();
    vi.mocked(voiceClient.disconnect).mockClear();
    vi.mocked(hooksModule.useJoinVoiceChannel).mockReturnValue({ mutate } as never);
    vi.mocked(hooksModule.useVoiceParticipants).mockReturnValue([]);
    useVoiceStore.setState({ status: 'disconnected', channelId: null, participants: [], error: null });
  });

  it('joins the voice channel on mount', () => {
    renderCallView(channel('c1'));
    expect(mutate).toHaveBeenCalledWith('c1');
  });

  it('joins the new channel when switching between voice channels, without disconnecting first', () => {
    const { rerender } = renderCallView(channel('c1'));
    mutate.mockClear();

    rerender(
      <MemoryRouter initialEntries={['/app/servers/s1/channels/c2']}>
        <Routes>
          <Route path="/app/servers/:serverId/channels/:channelId" element={<CallView channel={channel('c2')} />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(mutate).toHaveBeenCalledWith('c2');
    expect(voiceClient.disconnect).not.toHaveBeenCalled();
  });

  it('does not disconnect when unmounted — the call continues in the background', () => {
    const { unmount, rerender } = renderCallView(channel('c1'));
    rerender(
      <MemoryRouter initialEntries={['/app/servers/s1/channels/c1']}>
        <Routes>
          <Route path="/app/servers/:serverId/channels/:channelId" element={<CallView channel={channel('c1')} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(voiceClient.disconnect).not.toHaveBeenCalled();

    unmount();
    expect(voiceClient.disconnect).not.toHaveBeenCalled();
  });

  it('does not rejoin when remounted for the channel it is already connected to', () => {
    useVoiceStore.setState({ status: 'connected', channelId: 'c1' });
    renderCallView(channel('c1'));

    expect(mutate).not.toHaveBeenCalled();
  });

  it('joins when remounted for a different channel than the one currently connected', () => {
    useVoiceStore.setState({ status: 'connected', channelId: 'c1' });
    renderCallView(channel('c2'));

    expect(mutate).toHaveBeenCalledWith('c2');
  });

  it('navigates back to the server root with replace when leaving the call', () => {
    vi.mocked(hooksModule.useVoiceParticipants).mockReturnValue([localParticipant()] as never);

    renderCallView(channel('c1'));

    fireEvent.click(screen.getByRole('button', { name: 'Leave call' }));

    expect(voiceClient.disconnect).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith('/app/servers/s1', { replace: true });
  });
});
