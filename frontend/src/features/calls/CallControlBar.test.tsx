import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionQuality } from 'livekit-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { voiceClient } from '../../services/voiceClient';
import { useVoiceStore } from '../../stores/voiceStore';
import type { VoiceParticipant } from '../../types/voice';
import * as preference from '../settings/audio/noiseSuppressionPreference';
import { CallControlBar } from './CallControlBar';

vi.mock('../../services/voiceClient', () => ({
  voiceClient: {
    toggleMute: vi.fn(),
    toggleCamera: vi.fn(),
    toggleScreenShareAudio: vi.fn(),
    setNoiseSuppressionEnabled: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('../settings/audio/noiseSuppressionPreference');

function localParticipant(overrides: Partial<VoiceParticipant> = {}): VoiceParticipant {
  return {
    identity: 'me',
    name: 'Felipe',
    isLocal: true,
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

describe('CallControlBar', () => {
  beforeEach(() => {
    vi.mocked(voiceClient.toggleMute).mockClear();
    vi.mocked(voiceClient.toggleCamera).mockClear();
    vi.mocked(voiceClient.toggleScreenShareAudio).mockClear();
    vi.mocked(voiceClient.setNoiseSuppressionEnabled).mockClear();
    vi.mocked(preference.getNoiseSuppressionPreference).mockReturnValue(true);
    vi.mocked(preference.setNoiseSuppressionPreference).mockReset();
    useVoiceStore.setState({ participants: [] });
  });

  it('renders nothing when there is no local participant yet', () => {
    render(<CallControlBar onLeave={vi.fn()} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('clicking Mute/Unmute calls voiceClient.toggleMute', async () => {
    const user = userEvent.setup();
    useVoiceStore.setState({ participants: [localParticipant({ micEnabled: true })] });
    render(<CallControlBar onLeave={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Mute' }));

    expect(voiceClient.toggleMute).toHaveBeenCalledTimes(1);
  });

  it('shows Unmute when the mic is off', () => {
    useVoiceStore.setState({ participants: [localParticipant({ micEnabled: false })] });
    render(<CallControlBar onLeave={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Unmute' })).toBeInTheDocument();
  });

  it('clicking the camera button calls voiceClient.toggleCamera', async () => {
    const user = userEvent.setup();
    useVoiceStore.setState({ participants: [localParticipant({ cameraEnabled: false })] });
    render(<CallControlBar onLeave={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Camera on' }));

    expect(voiceClient.toggleCamera).toHaveBeenCalledTimes(1);
  });

  it('shows "Camera off" as the label when the camera is already on', () => {
    useVoiceStore.setState({ participants: [localParticipant({ cameraEnabled: true })] });
    render(<CallControlBar onLeave={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Camera off' })).toBeInTheDocument();
  });

  it('renders the noise suppression button as enabled when the stored preference is enabled', () => {
    vi.mocked(preference.getNoiseSuppressionPreference).mockReturnValue(true);
    useVoiceStore.setState({ participants: [localParticipant()] });
    render(<CallControlBar onLeave={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Disable noise suppression' })).toBeInTheDocument();
  });

  it('renders the noise suppression button as disabled when the stored preference is disabled', () => {
    vi.mocked(preference.getNoiseSuppressionPreference).mockReturnValue(false);
    useVoiceStore.setState({ participants: [localParticipant()] });
    render(<CallControlBar onLeave={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Enable noise suppression' })).toBeInTheDocument();
  });

  it('clicking the noise suppression button persists the flipped preference and applies it live', async () => {
    const user = userEvent.setup();
    vi.mocked(preference.getNoiseSuppressionPreference).mockReturnValue(true);
    useVoiceStore.setState({ participants: [localParticipant()] });
    render(<CallControlBar onLeave={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Disable noise suppression' }));

    expect(preference.setNoiseSuppressionPreference).toHaveBeenCalledWith(false);
    expect(voiceClient.setNoiseSuppressionEnabled).toHaveBeenCalledWith(false);
    expect(screen.getByRole('button', { name: 'Enable noise suppression' })).toBeInTheDocument();
  });

  it('does not render a screen-share-audio button when not screen sharing', () => {
    useVoiceStore.setState({ participants: [localParticipant({ screenShareEnabled: false })] });
    render(<CallControlBar onLeave={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /shared screen audio/ })).not.toBeInTheDocument();
  });

  it('does not render a screen-share-audio button when sharing without audio', () => {
    useVoiceStore.setState({
      participants: [localParticipant({ screenShareEnabled: true, screenShareHasAudio: false })],
    });
    render(<CallControlBar onLeave={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /shared screen audio/ })).not.toBeInTheDocument();
  });

  it('renders a screen-share-audio button when sharing with audio, and it calls voiceClient.toggleScreenShareAudio', async () => {
    const user = userEvent.setup();
    useVoiceStore.setState({
      participants: [
        localParticipant({ screenShareEnabled: true, screenShareHasAudio: true, screenShareAudioEnabled: true }),
      ],
    });
    render(<CallControlBar onLeave={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Mute shared screen audio' }));

    expect(voiceClient.toggleScreenShareAudio).toHaveBeenCalledTimes(1);
  });

  it('clicking Leave call calls the passed-in onLeave handler', async () => {
    const user = userEvent.setup();
    const onLeave = vi.fn();
    useVoiceStore.setState({ participants: [localParticipant()] });
    render(<CallControlBar onLeave={onLeave} />);

    await user.click(screen.getByRole('button', { name: 'Leave call' }));

    expect(onLeave).toHaveBeenCalledTimes(1);
  });
});
