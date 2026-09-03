import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Channel } from '../types/channel';
import { ChannelRoute } from './ChannelRoute';
import * as channelsHooks from '../features/channels/hooks';

vi.mock('../features/channels/hooks', () => ({
  useChannel: vi.fn(),
}));

vi.mock('../features/chat/ChatWindow', () => ({
  ChatWindow: () => <div>chat-window</div>,
}));

vi.mock('../features/calls/CallView', () => ({
  CallView: ({ channel }: { channel: Channel }) => <div>call-view-{channel.id}</div>,
}));

function renderRoute(channelId = 'c1') {
  return render(
    <MemoryRouter initialEntries={[`/app/servers/s1/channels/${channelId}`]}>
      <Routes>
        <Route path="/app/servers/:serverId/channels/:channelId" element={<ChannelRoute />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ChannelRoute', () => {
  it('renders ChatWindow for a TEXT channel', async () => {
    vi.mocked(channelsHooks.useChannel).mockReturnValue({
      data: { id: 'c1', serverId: 's1', name: 'general', type: 'TEXT', createdAt: '', updatedAt: '' },
    } as never);

    renderRoute();

    expect(await screen.findByText('chat-window')).toBeInTheDocument();
  });

  it('renders CallView for a VOICE channel', async () => {
    vi.mocked(channelsHooks.useChannel).mockReturnValue({
      data: { id: 'c1', serverId: 's1', name: 'lobby', type: 'VOICE', createdAt: '', updatedAt: '' },
    } as never);

    renderRoute();

    expect(await screen.findByText('call-view-c1')).toBeInTheDocument();
  });

  it('shows a loading placeholder while the channel is not yet loaded', () => {
    vi.mocked(channelsHooks.useChannel).mockReturnValue({ data: undefined } as never);

    renderRoute();

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});
