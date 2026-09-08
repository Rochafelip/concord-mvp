import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Channel } from '../types/channel';
import { ServerIndexRoute } from './ServerIndexRoute';
import * as channelsHooks from '../features/channels/hooks';
import * as lastVisitedChannel from '../features/channels/lastVisitedChannel';

vi.mock('../features/channels/hooks', () => ({
  useChannels: vi.fn(),
}));

vi.mock('../features/channels/lastVisitedChannel', () => ({
  getLastVisitedTextChannelId: vi.fn(() => null),
}));

function channel(id: string, type: Channel['type']): Channel {
  return { id, serverId: 's1', name: id, type, createdAt: '2026-01-01', updatedAt: '2026-01-01' };
}

// Renders the resolved :channelId so the redirect target can be asserted on, not just
// that *some* channel screen was reached.
function ChannelScreenStub() {
  const { channelId } = useParams<{ channelId: string }>();
  return <div>channel-screen-{channelId}</div>;
}

function renderRoute() {
  return render(
    <MemoryRouter initialEntries={['/app/servers/s1']}>
      <Routes>
        <Route path="/app/servers/:serverId" element={<ServerIndexRoute />} />
        <Route path="/app/servers/:serverId/channels/:channelId" element={<ChannelScreenStub />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ServerIndexRoute', () => {
  beforeEach(() => {
    vi.mocked(lastVisitedChannel.getLastVisitedTextChannelId).mockReturnValue(null);
  });

  it('shows a loading placeholder while channels have not loaded yet', () => {
    vi.mocked(channelsHooks.useChannels).mockReturnValue({ data: undefined } as never);

    renderRoute();

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('redirects to the first TEXT channel, skipping VOICE/ONBOARDING channels earlier in the list', async () => {
    vi.mocked(channelsHooks.useChannels).mockReturnValue({
      data: [channel('onboarding-1', 'ONBOARDING'), channel('voice-1', 'VOICE'), channel('text-1', 'TEXT'), channel('text-2', 'TEXT')],
    } as never);

    renderRoute();

    expect(await screen.findByText('channel-screen-text-1')).toBeInTheDocument();
  });

  it('shows a "no text channel" placeholder when the server has no TEXT channel', () => {
    vi.mocked(channelsHooks.useChannels).mockReturnValue({
      data: [channel('onboarding-1', 'ONBOARDING'), channel('voice-1', 'VOICE')],
    } as never);

    renderRoute();

    expect(screen.getByText(/no text channel/i)).toBeInTheDocument();
  });

  it('shows a "no text channel" placeholder when the server has no channels at all', () => {
    vi.mocked(channelsHooks.useChannels).mockReturnValue({ data: [] } as never);

    renderRoute();

    expect(screen.getByText(/no text channel/i)).toBeInTheDocument();
  });

  it('redirects to the last-visited TEXT channel when one is stored and still valid', async () => {
    vi.mocked(channelsHooks.useChannels).mockReturnValue({
      data: [channel('text-1', 'TEXT'), channel('text-2', 'TEXT')],
    } as never);
    vi.mocked(lastVisitedChannel.getLastVisitedTextChannelId).mockReturnValue('text-2');

    renderRoute();

    expect(await screen.findByText('channel-screen-text-2')).toBeInTheDocument();
  });

  it('falls back to the first TEXT channel when the stored last-visited id no longer exists', async () => {
    vi.mocked(channelsHooks.useChannels).mockReturnValue({
      data: [channel('text-1', 'TEXT'), channel('text-2', 'TEXT')],
    } as never);
    vi.mocked(lastVisitedChannel.getLastVisitedTextChannelId).mockReturnValue('deleted-channel');

    renderRoute();

    expect(await screen.findByText('channel-screen-text-1')).toBeInTheDocument();
  });

  it('falls back to the first TEXT channel when the stored last-visited id is no longer a TEXT channel', async () => {
    vi.mocked(channelsHooks.useChannels).mockReturnValue({
      data: [channel('voice-1', 'VOICE'), channel('text-1', 'TEXT')],
    } as never);
    vi.mocked(lastVisitedChannel.getLastVisitedTextChannelId).mockReturnValue('voice-1');

    renderRoute();

    expect(await screen.findByText('channel-screen-text-1')).toBeInTheDocument();
  });
});
