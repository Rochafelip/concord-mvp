import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useVoiceStore } from '../../stores/voiceStore';
import { ParticipantList } from './ParticipantList';

describe('ParticipantList', () => {
  beforeEach(() => {
    useVoiceStore.setState({ status: 'connected', channelId: 'c1', participants: [], error: null });
  });

  it('shows a connecting placeholder before the first participant sync', () => {
    render(<ParticipantList />);
    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });

  it('shows a placeholder when no one else has joined yet', () => {
    useVoiceStore.setState({
      participants: [{ identity: 'me', name: 'Me', isLocal: true, micEnabled: true }],
    });
    render(<ParticipantList />);
    expect(screen.getByText(/no one else/i)).toBeInTheDocument();
  });

  it('lists each participant with a mic icon reflecting their mute state', () => {
    useVoiceStore.setState({
      participants: [
        { identity: 'u1', name: 'Felipe', isLocal: true, micEnabled: true },
        { identity: 'u2', name: 'João', isLocal: false, micEnabled: false },
      ],
    });
    render(<ParticipantList />);

    const felipeRow = screen.getByText(/Felipe/).closest('li');
    const joaoRow = screen.getByText(/João/).closest('li');
    expect(felipeRow).toHaveTextContent('🎤');
    expect(joaoRow).toHaveTextContent('🔇');
  });
});
