import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionQuality } from 'livekit-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVoiceStore } from '../../stores/voiceStore';
import type { VoiceParticipant } from '../../types/voice';
import { ParticipantList } from './ParticipantList';

vi.mock('../../services/voiceClient', () => ({
  voiceClient: { toggleMute: vi.fn(), toggleCamera: vi.fn(), toggleScreenShare: vi.fn() },
}));

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
    connectionQuality: ConnectionQuality.Unknown,
    ...overrides,
  };
}

describe('ParticipantList', () => {
  beforeEach(() => {
    useVoiceStore.setState({ status: 'connected', channelId: 'c1', participants: [], error: null });
  });

  it('shows a connecting placeholder before the first participant sync', () => {
    render(<ParticipantList />);
    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });

  it('renders a tile for the local participant alone when no one else has joined yet (self-view)', () => {
    useVoiceStore.setState({
      participants: [participant({ identity: 'me', name: 'Felipe', isLocal: true })],
    });
    render(<ParticipantList />);

    expect(screen.getByText(/Felipe/)).toBeInTheDocument();
  });

  it('renders one tile per participant, including the local participant', () => {
    useVoiceStore.setState({
      participants: [
        participant({ identity: 'u1', name: 'Felipe', isLocal: true, micEnabled: true }),
        participant({ identity: 'u2', name: 'João', isLocal: false, micEnabled: false }),
      ],
    });
    render(<ParticipantList />);

    const felipeTile = screen.getByText(/Felipe/).closest('div');
    const joaoTile = screen.getByText(/João/).closest('div');
    expect(felipeTile).toHaveTextContent('🎤');
    expect(joaoTile).toHaveTextContent('🔇');
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
    render(<ParticipantList />);

    expect(screen.getByText(/João's screen/)).toBeInTheDocument();
  });

  it('does not render a screen share tile for anyone when no one is sharing', () => {
    useVoiceStore.setState({
      participants: [participant({ identity: 'u1', name: 'Felipe', isLocal: true })],
    });
    render(<ParticipantList />);

    expect(screen.queryByText(/'s screen/)).not.toBeInTheDocument();
  });

  it('wires onLeave to the local participant tile only, not remote ones', async () => {
    const user = userEvent.setup();
    const onLeave = vi.fn();
    useVoiceStore.setState({
      participants: [
        participant({ identity: 'u1', name: 'Felipe', isLocal: true }),
        participant({ identity: 'u2', name: 'João', isLocal: false }),
      ],
    });
    render(<ParticipantList onLeave={onLeave} />);

    expect(screen.getAllByRole('button', { name: 'Leave call' })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Leave call' }));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });
});
