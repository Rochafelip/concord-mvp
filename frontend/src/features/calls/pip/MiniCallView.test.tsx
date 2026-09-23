import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionQuality } from 'livekit-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { voiceClient } from '../../../services/voiceClient';
import { useVoiceStore } from '../../../stores/voiceStore';
import type { VoiceParticipant } from '../../../types/voice';
import { MiniCallView } from './MiniCallView';

vi.mock('../../../services/voiceClient', () => ({
  voiceClient: { toggleMute: vi.fn(), disconnect: vi.fn() },
}));

// MiniCallView's own job is picking WHICH participants get a tile, not how a tile renders —
// that's already covered by ParticipantTile.test.tsx/ScreenShareTile.test.tsx. Same reasoning as
// ParticipantTile.test.tsx mocking UserProfileCard.
vi.mock('../ParticipantTile', () => ({
  ParticipantTile: ({ participant }: { participant: VoiceParticipant }) => (
    <div data-testid={`camera-${participant.identity}`}>{participant.name}</div>
  ),
}));

vi.mock('../ScreenShareTile', () => ({
  ScreenShareTile: ({ participant }: { participant: VoiceParticipant }) => (
    <div data-testid={`share-${participant.identity}`}>{participant.name}&apos;s screen</div>
  ),
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
    screenShareHasAudio: false,
    screenShareAudioEnabled: false,
    connectionQuality: ConnectionQuality.Unknown,
    speaking: false,
    ...overrides,
  };
}

describe('MiniCallView', () => {
  beforeEach(() => {
    vi.mocked(voiceClient.toggleMute).mockClear();
    vi.mocked(voiceClient.disconnect).mockClear();
    useVoiceStore.setState({ participants: [] });
  });

  it('shows a camera tile for every participant with the camera on, skipping those without', () => {
    useVoiceStore.setState({
      participants: [
        participant({ identity: 'a', name: 'Alice', cameraEnabled: true }),
        participant({ identity: 'b', name: 'Bob', cameraEnabled: false }),
      ],
    });

    render(<MiniCallView onReturn={vi.fn()} />);

    expect(screen.getByTestId('camera-a')).toBeInTheDocument();
    expect(screen.queryByTestId('camera-b')).not.toBeInTheDocument();
  });

  it('shows the local screen share over a remote one when both are sharing', () => {
    useVoiceStore.setState({
      participants: [
        participant({ identity: 'a', name: 'Alice', screenShareEnabled: true }),
        participant({ identity: 'me', name: 'Me', isLocal: true, screenShareEnabled: true }),
      ],
    });

    render(<MiniCallView onReturn={vi.fn()} />);

    expect(screen.getByTestId('share-me')).toBeInTheDocument();
    expect(screen.queryByTestId('share-a')).not.toBeInTheDocument();
  });

  it('falls back to the first remote share when nobody local is sharing', () => {
    useVoiceStore.setState({
      participants: [
        participant({ identity: 'a', name: 'Alice', screenShareEnabled: true }),
        participant({ identity: 'me', name: 'Me', isLocal: true, screenShareEnabled: false }),
      ],
    });

    render(<MiniCallView onReturn={vi.fn()} />);

    expect(screen.getByTestId('share-a')).toBeInTheDocument();
  });

  it('shows a placeholder message instead of a share tile when nobody is sharing', () => {
    useVoiceStore.setState({ participants: [participant({ identity: 'me', isLocal: true })] });

    render(<MiniCallView onReturn={vi.fn()} />);

    expect(screen.getByText('No one is sharing their screen')).toBeInTheDocument();
  });

  it('mute button calls voiceClient.toggleMute', async () => {
    const user = userEvent.setup();
    useVoiceStore.setState({ participants: [participant({ identity: 'me', isLocal: true, micEnabled: true })] });
    render(<MiniCallView onReturn={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Mute' }));

    expect(voiceClient.toggleMute).toHaveBeenCalledTimes(1);
  });

  it('"Voltar à chamada" calls onReturn', async () => {
    const user = userEvent.setup();
    const onReturn = vi.fn();
    useVoiceStore.setState({ participants: [participant({ identity: 'me', isLocal: true })] });
    render(<MiniCallView onReturn={onReturn} />);

    await user.click(screen.getByRole('button', { name: 'Voltar à chamada' }));

    expect(onReturn).toHaveBeenCalledTimes(1);
  });

  it('"Sair da chamada" calls voiceClient.disconnect', async () => {
    const user = userEvent.setup();
    useVoiceStore.setState({ participants: [participant({ identity: 'me', isLocal: true })] });
    render(<MiniCallView onReturn={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Sair da chamada' }));

    expect(voiceClient.disconnect).toHaveBeenCalledTimes(1);
  });
});
