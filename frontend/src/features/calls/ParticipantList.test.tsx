import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useVoiceStore } from '../../stores/voiceStore';
import type { VoiceParticipant } from '../../types/voice';
import { ParticipantList } from './ParticipantList';

function participant(overrides: Partial<VoiceParticipant> = {}): VoiceParticipant {
  return {
    identity: 'u1',
    name: 'Felipe',
    isLocal: false,
    micEnabled: true,
    cameraEnabled: false,
    videoTrack: null,
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
});
