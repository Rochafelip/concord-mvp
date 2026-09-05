import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionQuality } from 'livekit-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { voiceClient } from '../../services/voiceClient';
import type { VoiceParticipant } from '../../types/voice';
import { ParticipantTile } from './ParticipantTile';

vi.mock('../../services/voiceClient', () => ({
  voiceClient: {
    toggleMute: vi.fn(),
    toggleCamera: vi.fn(),
    toggleScreenShare: vi.fn(),
  },
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

describe('ParticipantTile', () => {
  it('shows an initial-letter placeholder when there is no video track', () => {
    const { container } = render(<ParticipantTile participant={participant()} />);

    expect(screen.getByText('F')).toBeInTheDocument();
    expect(container.querySelector('video')).toBeNull();
  });

  it('shows the participant name and a mic-off icon when muted', () => {
    render(<ParticipantTile participant={participant({ name: 'Felipe', micEnabled: false })} />);

    expect(screen.getByText(/Felipe/)).toBeInTheDocument();
    expect(screen.getByText('🔇')).toBeInTheDocument();
  });

  it('shows a mic-on icon when unmuted', () => {
    render(<ParticipantTile participant={participant({ micEnabled: true })} />);

    expect(screen.getByText('🎤')).toBeInTheDocument();
  });

  it('attaches the video track to the <video> element when present, and detaches it on unmount', () => {
    const attach = vi.fn();
    const detach = vi.fn();
    const videoTrack = { attach, detach } as never;

    const { unmount, container } = render(<ParticipantTile participant={participant({ videoTrack })} />);

    const videoElement = container.querySelector('video');
    expect(videoElement).not.toBeNull();
    expect(attach).toHaveBeenCalledWith(videoElement);

    unmount();
    expect(detach).toHaveBeenCalledWith(videoElement);
  });

  it('does not render an initial placeholder when a video track is present', () => {
    const videoTrack = { attach: vi.fn(), detach: vi.fn() } as never;
    render(<ParticipantTile participant={participant({ name: 'Felipe', videoTrack })} />);

    expect(screen.queryByText('F')).not.toBeInTheDocument();
  });

  describe('local control bar', () => {
    beforeEach(() => {
      localStorage.clear();
      vi.mocked(voiceClient.toggleMute).mockClear();
      vi.mocked(voiceClient.toggleCamera).mockClear();
      vi.mocked(voiceClient.toggleScreenShare).mockClear();
    });

    it('does not render controls for a remote participant, even with onLeave passed', () => {
      render(<ParticipantTile participant={participant({ isLocal: false })} onLeave={vi.fn()} />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('does not render controls for the local participant when onLeave is not passed', () => {
      render(<ParticipantTile participant={participant({ isLocal: true })} />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('toggles mute on click and reflects the current mic state', async () => {
      const user = userEvent.setup();
      render(<ParticipantTile participant={participant({ isLocal: true, micEnabled: true })} onLeave={vi.fn()} />);

      await user.click(screen.getByRole('button', { name: 'Mute' }));

      expect(voiceClient.toggleMute).toHaveBeenCalledTimes(1);
    });

    it('shows an Unmute label when the local mic is off', () => {
      render(<ParticipantTile participant={participant({ isLocal: true, micEnabled: false })} onLeave={vi.fn()} />);

      expect(screen.getByRole('button', { name: 'Unmute' })).toBeInTheDocument();
    });

    it('toggles the camera on click and reflects the current camera state', async () => {
      const user = userEvent.setup();
      render(<ParticipantTile participant={participant({ isLocal: true, cameraEnabled: false })} onLeave={vi.fn()} />);

      await user.click(screen.getByRole('button', { name: 'Camera on' }));

      expect(voiceClient.toggleCamera).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('button', { name: 'Camera off' })).not.toBeInTheDocument();
    });

    it('toggles screen share on click and reflects the current sharing state', async () => {
      const user = userEvent.setup();
      render(
        <ParticipantTile participant={participant({ isLocal: true, screenShareEnabled: true })} onLeave={vi.fn()} />,
      );

      await user.click(screen.getByRole('button', { name: 'Stop sharing' }));

      expect(voiceClient.toggleScreenShare).toHaveBeenCalledTimes(1);
    });

    it('calls onLeave on click', async () => {
      const user = userEvent.setup();
      const onLeave = vi.fn();
      render(<ParticipantTile participant={participant({ isLocal: true })} onLeave={onLeave} />);

      await user.click(screen.getByRole('button', { name: 'Leave call' }));

      expect(onLeave).toHaveBeenCalledTimes(1);
    });

    it('opens the quality modal instead of toggling immediately when starting to share', async () => {
      const user = userEvent.setup();
      render(
        <ParticipantTile participant={participant({ isLocal: true, screenShareEnabled: false })} onLeave={vi.fn()} />,
      );

      await user.click(screen.getByRole('button', { name: 'Share screen' }));

      expect(voiceClient.toggleScreenShare).not.toHaveBeenCalled();
      expect(screen.getByText('Choose share quality')).toBeInTheDocument();
    });

    it('starts sharing with the chosen quality after confirming the modal', async () => {
      const user = userEvent.setup();
      render(
        <ParticipantTile participant={participant({ isLocal: true, screenShareEnabled: false })} onLeave={vi.fn()} />,
      );

      await user.click(screen.getByRole('button', { name: 'Share screen' }));
      await user.click(screen.getByLabelText('HD (720p)'));
      await user.click(screen.getByRole('button', { name: 'Share' }));

      expect(voiceClient.toggleScreenShare).toHaveBeenCalledWith('hd');
      expect(screen.queryByText('Choose share quality')).not.toBeInTheDocument();
    });

    it('closes the quality modal without toggling when canceled', async () => {
      const user = userEvent.setup();
      render(
        <ParticipantTile participant={participant({ isLocal: true, screenShareEnabled: false })} onLeave={vi.fn()} />,
      );

      await user.click(screen.getByRole('button', { name: 'Share screen' }));
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(voiceClient.toggleScreenShare).not.toHaveBeenCalled();
      expect(screen.queryByText('Choose share quality')).not.toBeInTheDocument();
    });
  });
});
