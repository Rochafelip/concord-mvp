import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { voiceClient } from '../../services/voiceClient';
import type { Channel } from '../../types/channel';
import { CallView } from './CallView';
import * as hooksModule from './hooks';

vi.mock('../../services/voiceClient', () => ({
  voiceClient: { disconnect: vi.fn() },
}));

vi.mock('./hooks', () => ({
  useJoinVoiceChannel: vi.fn(),
  useVoiceStatus: vi.fn(() => ({ status: 'connected', channelId: 'c1', error: null })),
  useVoiceParticipants: vi.fn(() => []),
}));

function channel(id: string): Channel {
  return { id, serverId: 's1', name: 'lobby', type: 'VOICE', createdAt: '2026-01-01', updatedAt: '2026-01-01' };
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
    vi.mocked(voiceClient.disconnect).mockClear();
    vi.mocked(hooksModule.useJoinVoiceChannel).mockReturnValue({ mutate } as never);
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

  it('disconnects only on unmount, not on every render', () => {
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
    expect(voiceClient.disconnect).toHaveBeenCalledTimes(1);
  });
});
