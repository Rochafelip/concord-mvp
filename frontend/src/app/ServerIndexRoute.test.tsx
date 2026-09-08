import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Channel } from '../types/channel';
import { ServerIndexRoute } from './ServerIndexRoute';
import * as channelsHooks from '../features/channels/hooks';

vi.mock('../features/channels/hooks', () => ({
  useChannels: vi.fn(),
}));

function channel(id: string, type: Channel['type']): Channel {
  return { id, serverId: 's1', name: id, type, createdAt: '2026-01-01', updatedAt: '2026-01-01' };
}

function renderRoute() {
  return render(
    <MemoryRouter initialEntries={['/app/servers/s1']}>
      <Routes>
        <Route path="/app/servers/:serverId" element={<ServerIndexRoute />} />
        <Route path="/app/servers/:serverId/channels/:channelId" element={<div>channel-screen</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ServerIndexRoute', () => {
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

    expect(await screen.findByText('channel-screen')).toBeInTheDocument();
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
});
