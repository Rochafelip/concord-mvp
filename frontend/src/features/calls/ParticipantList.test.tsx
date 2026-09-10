import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { ConnectionQuality } from 'livekit-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVoiceStore } from '../../stores/voiceStore';
import type { VoiceParticipant } from '../../types/voice';
import * as callsApi from './api';
import { ParticipantList } from './ParticipantList';

vi.mock('../../services/voiceClient', () => ({
  voiceClient: { toggleMute: vi.fn(), toggleCamera: vi.fn(), toggleScreenShare: vi.fn() },
}));
vi.mock('./api');

function participant(overrides: Partial<VoiceParticipant> = {}): VoiceParticipant {
  return {
    identity: 'u1',
    name: 'Felipe',
    isLocal: false,
    micEnabled: true,
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

function renderList(props: Partial<Parameters<typeof ParticipantList>[0]> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ParticipantList serverId="s1" {...props} />
    </QueryClientProvider>,
  );
}

describe('ParticipantList', () => {
  beforeEach(() => {
    useVoiceStore.setState({ status: 'connected', channelId: 'c1', participants: [], error: null });
    vi.mocked(callsApi.getVoicePresence).mockResolvedValue([]);
  });

  it('shows a connecting placeholder before the first participant sync', () => {
    renderList();
    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });

  it('renders a tile for the local participant alone when no one else has joined yet (self-view)', () => {
    useVoiceStore.setState({
      participants: [participant({ identity: 'me', name: 'Felipe', isLocal: true })],
    });
    renderList();

    expect(screen.getByText(/Felipe/)).toBeInTheDocument();
  });

  it('renders one tile per participant, including the local participant', () => {
    useVoiceStore.setState({
      participants: [
        participant({ identity: 'u1', name: 'Felipe', isLocal: true, micEnabled: true }),
        participant({ identity: 'u2', name: 'João', isLocal: false, micEnabled: false }),
      ],
    });
    renderList();

    const felipeTile = screen.getByText(/Felipe/).closest('div');
    const joaoTile = screen.getByText(/João/).closest('div');
    expect(felipeTile?.querySelector('[data-testid="mic-status-on"]')).toBeInTheDocument();
    expect(joaoTile?.querySelector('[data-testid="mic-status-off"]')).toBeInTheDocument();
  });

  it('renders a ScreenShareTile for a participant actively sharing their screen', () => {
    const track = { attach: vi.fn(), detach: vi.fn() } as never;
    useVoiceStore.setState({
      participants: [
        participant({ identity: 'u1', name: 'Felipe', isLocal: true }),
        participant({
          identity: 'u2',
          name: 'João',
          isLocal: false,
          screenShareEnabled: true,
          screenShareTrack: track,
        }),
      ],
    });
    renderList();

    expect(screen.getByText(/João's screen/)).toBeInTheDocument();
  });

  it('does not render a screen share tile for anyone when no one is sharing', () => {
    useVoiceStore.setState({
      participants: [participant({ identity: 'u1', name: 'Felipe', isLocal: true })],
    });
    renderList();

    expect(screen.queryByText(/'s screen/)).not.toBeInTheDocument();
  });

  it('marks a tile deafened based on matching voice presence by identity', async () => {
    vi.mocked(callsApi.getVoicePresence).mockResolvedValue([
      { channelId: 'c1', userId: 'u2', displayName: 'João', avatarUrl: null, muted: true, cameraOn: false, screenSharing: false, speaking: false, deafened: true },
    ]);
    useVoiceStore.setState({
      participants: [
        participant({ identity: 'u1', name: 'Felipe', isLocal: true }),
        participant({ identity: 'u2', name: 'João', isLocal: false, micEnabled: false }),
      ],
    });
    renderList();

    await waitFor(() => {
      const joaoTile = screen.getByText(/João/).closest('div');
      expect(joaoTile?.querySelector('[data-testid="deaf-status-on"]')).toBeInTheDocument();
    });
    const felipeTile = screen.getByText(/Felipe/).closest('div');
    expect(felipeTile?.querySelector('[data-testid="deaf-status-on"]')).not.toBeInTheDocument();
  });

  it('passes the matching avatarUrl from voice presence down to a tile, by identity', async () => {
    vi.mocked(callsApi.getVoicePresence).mockResolvedValue([
      {
        channelId: 'c1',
        userId: 'u2',
        displayName: 'João',
        avatarUrl: 'https://example.test/joao.png',
        muted: false,
        cameraOn: false,
        screenSharing: false,
        speaking: false,
        deafened: false,
      },
    ]);
    useVoiceStore.setState({
      participants: [
        participant({ identity: 'u1', name: 'Felipe', isLocal: true }),
        participant({ identity: 'u2', name: 'João', isLocal: false }),
      ],
    });
    renderList();

    expect(await screen.findByRole('img', { name: 'João' })).toHaveAttribute('src', 'https://example.test/joao.png');
    expect(screen.queryByRole('img', { name: 'Felipe' })).not.toBeInTheDocument();
  });

  describe('camera-on / off-camera split', () => {
    it('renders a camera-on participant inside the camera grid, not the off-camera roster', () => {
      useVoiceStore.setState({
        participants: [participant({ identity: 'u1', name: 'Felipe', isLocal: true, cameraEnabled: true })],
      });
      renderList();

      expect(screen.getByTestId('camera-grid')).toContainElement(screen.getByText(/Felipe/));
      expect(screen.queryByTestId('off-camera-roster')).not.toBeInTheDocument();
    });

    it('renders a camera-off, non-sharing participant inside the off-camera roster, not the camera grid', () => {
      useVoiceStore.setState({
        participants: [participant({ identity: 'u1', name: 'Felipe', isLocal: true, cameraEnabled: false })],
      });
      renderList();

      expect(screen.getByTestId('off-camera-roster')).toContainElement(screen.getByText(/Felipe/));
      expect(screen.queryByTestId('camera-grid')).not.toBeInTheDocument();
    });

    it('excludes a camera-off, screen-sharing participant from the off-camera roster', () => {
      const track = { attach: vi.fn(), detach: vi.fn() } as never;
      useVoiceStore.setState({
        participants: [
          participant({ identity: 'u1', name: 'Felipe', isLocal: true, cameraEnabled: false }),
          participant({
            identity: 'u2',
            name: 'João',
            isLocal: false,
            cameraEnabled: false,
            screenShareEnabled: true,
            screenShareTrack: track,
          }),
        ],
      });
      renderList();

      expect(screen.getByText(/João's screen/)).toBeInTheDocument();
      expect(screen.getByTestId('off-camera-roster')).not.toHaveTextContent('João');
    });

    it('renders both a camera grid and an off-camera roster when the call has a mix of both', () => {
      useVoiceStore.setState({
        participants: [
          participant({ identity: 'u1', name: 'Felipe', isLocal: true, cameraEnabled: true }),
          participant({ identity: 'u2', name: 'João', isLocal: false, cameraEnabled: false }),
        ],
      });
      renderList();

      expect(screen.getByTestId('camera-grid')).toContainElement(screen.getByText(/Felipe/));
      expect(screen.getByTestId('off-camera-roster')).toContainElement(screen.getByText(/João/));
    });
  });
});
