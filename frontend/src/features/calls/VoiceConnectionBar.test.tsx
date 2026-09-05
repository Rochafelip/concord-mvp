import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Channel } from '../../types/channel';
import type { Server } from '../../types/server';
import { useVoiceStore } from '../../stores/voiceStore';
import * as channelsApi from '../channels/api';
import * as serversApi from '../servers/api';
import { VoiceConnectionBar } from './VoiceConnectionBar';

vi.mock('../channels/api');
vi.mock('../servers/api');

const channel: Channel = {
  id: 'c1',
  serverId: 's1',
  name: 'lobby',
  type: 'VOICE',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

const server: Server = {
  id: 's1',
  name: 'Alpha',
  ownerId: 'owner-1',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

function renderBar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <VoiceConnectionBar />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('VoiceConnectionBar', () => {
  beforeEach(() => {
    vi.mocked(channelsApi.getChannel).mockResolvedValue(channel);
    vi.mocked(serversApi.getServer).mockResolvedValue(server);
    useVoiceStore.setState({ status: 'disconnected', channelId: null, participants: [], error: null });
  });

  it('renders nothing when disconnected', () => {
    renderBar();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows a connecting placeholder while the channel/server names are not resolved yet', () => {
    useVoiceStore.setState({ status: 'connecting', channelId: 'c1' });
    renderBar();

    expect(screen.getByRole('link')).toHaveTextContent(/connecting/i);
  });

  it('shows the channel and server name and links to the call when connected', async () => {
    useVoiceStore.setState({ status: 'connected', channelId: 'c1' });
    renderBar();

    await screen.findByText('Alpha');
    const link = screen.getByRole('link', { name: /lobby/ });
    expect(link).toHaveTextContent('Alpha');
    expect(link).toHaveAttribute('href', '/app/servers/s1/channels/c1');
  });
});
