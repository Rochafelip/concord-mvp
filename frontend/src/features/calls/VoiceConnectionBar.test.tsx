import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionQuality } from 'livekit-client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { voiceClient } from '../../services/voiceClient';
import { useVoiceStore } from '../../stores/voiceStore';
import type { Channel } from '../../types/channel';
import type { Server } from '../../types/server';
import type { VoiceParticipant } from '../../types/voice';
import * as channelsApi from '../channels/api';
import * as serversApi from '../servers/api';
import { VoiceConnectionBar } from './VoiceConnectionBar';

vi.mock('../channels/api');
vi.mock('../servers/api');
vi.mock('../../services/voiceClient', () => ({
  voiceClient: { disconnect: vi.fn(), toggleMute: vi.fn(), toggleDeafen: vi.fn(), toggleScreenShare: vi.fn() },
}));

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

function localParticipant(overrides: Partial<VoiceParticipant>): VoiceParticipant {
  return {
    identity: 'me',
    name: 'Me',
    isLocal: true,
    micEnabled: false,
    cameraEnabled: false,
    videoTrack: null,
    screenShareEnabled: false,
    screenShareTrack: null,
    screenShareHasAudio: false,
    screenShareAudioEnabled: false,
    connectionQuality: ConnectionQuality.Unknown,
    speaking: false,
    ...overrides,
  };
}

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
    vi.mocked(voiceClient.disconnect).mockClear();
    vi.mocked(voiceClient.toggleMute).mockClear();
    vi.mocked(voiceClient.toggleDeafen).mockClear();
    vi.mocked(voiceClient.toggleScreenShare).mockClear();
    useVoiceStore.setState({ status: 'disconnected', channelId: null, participants: [], error: null, isDeafened: false });
  });

  it('renders nothing when disconnected', () => {
    renderBar();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows nothing when connecting (prevents screen share before connection)', () => {
    useVoiceStore.setState({ status: 'connecting', channelId: 'c1' });
    renderBar();

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows the channel and server name and links to the call when connected', async () => {
    useVoiceStore.setState({ status: 'connected', channelId: 'c1' });
    renderBar();

    await screen.findByText('Alpha');
    const link = screen.getByRole('link', { name: /lobby/ });
    expect(link).toHaveTextContent('Alpha');
    expect(link).toHaveAttribute('href', '/app/servers/s1/channels/c1');
  });

  it('does not show Mute/Deafen/Leave while there is no local participant yet', () => {
    useVoiceStore.setState({ status: 'connected', channelId: 'c1', participants: [] });
    renderBar();

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows a connection quality indicator for the local participant', async () => {
    useVoiceStore.setState({
      status: 'connected',
      channelId: 'c1',
      participants: [localParticipant({ connectionQuality: ConnectionQuality.Poor })],
    });
    renderBar();

    await screen.findByText('Alpha');
    expect(screen.getByTitle('poor')).toBeInTheDocument();
  });

  it('clicking Mute calls voiceClient.toggleMute', async () => {
    const user = userEvent.setup();
    useVoiceStore.setState({ status: 'connected', channelId: 'c1', participants: [localParticipant({ micEnabled: true })] });
    renderBar();

    await screen.findByText('Alpha');
    await user.click(screen.getByRole('button', { name: 'Mute' }));

    expect(voiceClient.toggleMute).toHaveBeenCalledTimes(1);
  });

  it('clicking Deafen calls voiceClient.toggleDeafen, and its icon reflects isDeafened', async () => {
    const user = userEvent.setup();
    useVoiceStore.setState({
      status: 'connected',
      channelId: 'c1',
      participants: [localParticipant({})],
      isDeafened: true,
    });
    renderBar();

    await screen.findByText('Alpha');
    const deafenButton = screen.getByRole('button', { name: 'Undeafen' });
    await user.click(deafenButton);

    expect(voiceClient.toggleDeafen).toHaveBeenCalledTimes(1);
  });

  it('shows the HeadphoneOff icon when deafened and the Headphones icon otherwise', async () => {
    useVoiceStore.setState({
      status: 'connected',
      channelId: 'c1',
      participants: [localParticipant({})],
      isDeafened: false,
    });
    const { rerender } = renderBar();

    await screen.findByText('Alpha');
    expect(screen.getByTestId('deafen-icon-on')).toBeInTheDocument();
    expect(screen.queryByTestId('deafen-icon-off')).not.toBeInTheDocument();

    useVoiceStore.setState({ isDeafened: true });
    rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <VoiceConnectionBar />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('deafen-icon-off')).toBeInTheDocument();
    expect(screen.queryByTestId('deafen-icon-on')).not.toBeInTheDocument();
  });

  it('disconnects the call when Leave is clicked, without navigating', async () => {
    const user = userEvent.setup();
    useVoiceStore.setState({ status: 'connected', channelId: 'c1', participants: [localParticipant({})] });
    renderBar();

    await screen.findByText('Alpha');
    await user.click(screen.getByRole('button', { name: 'Leave call' }));

    expect(voiceClient.disconnect).toHaveBeenCalledTimes(1);
  });

  describe('screen share', () => {
    it('toggles screen share off directly when already sharing', async () => {
      const user = userEvent.setup();
      useVoiceStore.setState({
        status: 'connected',
        channelId: 'c1',
        participants: [localParticipant({ screenShareEnabled: true })],
      });
      renderBar();

      await screen.findByText('Alpha');
      await user.click(screen.getByRole('button', { name: 'Stop sharing' }));

      expect(voiceClient.toggleScreenShare).toHaveBeenCalledTimes(1);
    });

    it('opens the quality modal instead of toggling immediately when starting to share', async () => {
      const user = userEvent.setup();
      useVoiceStore.setState({
        status: 'connected',
        channelId: 'c1',
        participants: [localParticipant({ screenShareEnabled: false })],
      });
      renderBar();

      await screen.findByText('Alpha');
      await user.click(screen.getByRole('button', { name: 'Share screen' }));

      expect(voiceClient.toggleScreenShare).not.toHaveBeenCalled();
      expect(screen.getByText('Share your screen')).toBeInTheDocument();
    });

    it('starts sharing with the chosen quality and audio preference after confirming the modal', async () => {
      const user = userEvent.setup();
      useVoiceStore.setState({
        status: 'connected',
        channelId: 'c1',
        participants: [localParticipant({ screenShareEnabled: false })],
      });
      renderBar();

      await screen.findByText('Alpha');
      await user.click(screen.getByRole('button', { name: 'Share screen' }));
      await user.click(screen.getByLabelText('HD (720p)'));
      await user.click(screen.getByLabelText('Share system/tab audio'));
      await user.click(screen.getByRole('button', { name: 'Share' }));

      expect(voiceClient.toggleScreenShare).toHaveBeenCalledWith({ quality: 'hd', withAudio: true });
      expect(screen.queryByText('Share your screen')).not.toBeInTheDocument();
    });

    it('closes the quality modal without toggling when canceled', async () => {
      const user = userEvent.setup();
      useVoiceStore.setState({
        status: 'connected',
        channelId: 'c1',
        participants: [localParticipant({ screenShareEnabled: false })],
      });
      renderBar();

      await screen.findByText('Alpha');
      await user.click(screen.getByRole('button', { name: 'Share screen' }));
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(voiceClient.toggleScreenShare).not.toHaveBeenCalled();
      expect(screen.queryByText('Share your screen')).not.toBeInTheDocument();
    });
  });
});
