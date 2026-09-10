import { fireEvent, render, screen } from '@testing-library/react';
import { ConnectionQuality } from 'livekit-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { voiceClient } from '../../services/voiceClient';
import type { VoiceParticipant } from '../../types/voice';
import { ParticipantTile } from './ParticipantTile';

vi.mock('../../services/voiceClient', () => ({
  voiceClient: {
    setParticipantVolume: vi.fn(),
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
    screenShareHasAudio: false,
    screenShareAudioEnabled: false,
    connectionQuality: ConnectionQuality.Unknown,
    speaking: false,
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
    expect(screen.getByTestId('mic-status-off')).toBeInTheDocument();
  });

  it('shows a mic-on icon when unmuted', () => {
    render(<ParticipantTile participant={participant({ micEnabled: true })} />);

    expect(screen.getByTestId('mic-status-on')).toBeInTheDocument();
  });

  it('shows a deafened icon instead of the mic icon when deafened, even if micEnabled is true', () => {
    render(<ParticipantTile participant={participant({ micEnabled: true })} deafened />);

    expect(screen.getByTestId('deaf-status-on')).toBeInTheDocument();
    expect(screen.queryByTestId('mic-status-on')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mic-status-off')).not.toBeInTheDocument();
  });

  it('falls back to the normal mic icon when not deafened', () => {
    render(<ParticipantTile participant={participant({ micEnabled: false })} deafened={false} />);

    expect(screen.getByTestId('mic-status-off')).toBeInTheDocument();
    expect(screen.queryByTestId('deaf-status-on')).not.toBeInTheDocument();
  });

  it('shows the deafened icon (not mic-off) even when the mic is also off', () => {
    render(<ParticipantTile participant={participant({ micEnabled: false })} deafened />);

    expect(screen.getByTestId('deaf-status-on')).toBeInTheDocument();
    expect(screen.queryByTestId('mic-status-off')).not.toBeInTheDocument();
  });

  it('attaches the video track to the <video> element when present, and detaches it on unmount', () => {
    const attach = vi.fn();
    const detach = vi.fn();
    const videoTrack = { attach, detach } as never;

    const { unmount, container } = render(
      <ParticipantTile participant={participant({ videoTrack, cameraEnabled: true })} />,
    );

    const videoElement = container.querySelector('video');
    expect(videoElement).not.toBeNull();
    expect(attach).toHaveBeenCalledWith(videoElement);

    unmount();
    expect(detach).toHaveBeenCalledWith(videoElement);
  });

  it('does not render an initial placeholder when a video track is present', () => {
    const videoTrack = { attach: vi.fn(), detach: vi.fn() } as never;
    render(<ParticipantTile participant={participant({ name: 'Felipe', videoTrack, cameraEnabled: true })} />);

    expect(screen.queryByText('F')).not.toBeInTheDocument();
  });

  it('shows the avatar instead of the video element when the camera is turned off, even though the muted publication still leaves a stale videoTrack behind', () => {
    // Mirrors livekit-client's real behavior: disabling the camera mutes the publication rather
    // than unpublishing it, so `videoTrack` stays non-null after the toggle — only `cameraEnabled`
    // (isCameraEnabled, which is isMuted-aware) reflects the off state.
    const videoTrack = { attach: vi.fn(), detach: vi.fn() } as never;
    const { container } = render(
      <ParticipantTile participant={participant({ name: 'Felipe', videoTrack, cameraEnabled: false })} />,
    );

    expect(screen.getByText('F')).toBeInTheDocument();
    expect(container.querySelector('video')).toBeNull();
  });

  it('always shows the name pill bottom-left, for both local and remote tiles', () => {
    const { container: remoteContainer } = render(<ParticipantTile participant={participant({ isLocal: false })} />);
    const { container: localContainer } = render(<ParticipantTile participant={participant({ isLocal: true })} />);

    expect(remoteContainer.querySelector('.bottom-1')).not.toBeNull();
    expect(localContainer.querySelector('.bottom-1')).not.toBeNull();
    expect(localContainer.querySelector('.top-1')).toBeNull();
  });

  describe('speaking highlight', () => {
    it('applies a highlight ring when the participant is speaking', () => {
      const { container } = render(<ParticipantTile participant={participant({ speaking: true })} />);

      expect(container.firstChild).toHaveClass('ring-2');
      expect(container.firstChild).toHaveClass('ring-success');
    });

    it('does not apply a highlight ring when the participant is not speaking', () => {
      const { container } = render(<ParticipantTile participant={participant({ speaking: false })} />);

      expect(container.firstChild).not.toHaveClass('ring-2');
    });

    it('does not permanently highlight the local participant when they are not speaking', () => {
      const { container } = render(<ParticipantTile participant={participant({ isLocal: true, speaking: false })} />);

      expect(container.firstChild).not.toHaveClass('ring-2');
      expect(container.firstChild).not.toHaveClass('ring-brand');
    });

    it('highlights the local participant while they are speaking', () => {
      const { container } = render(<ParticipantTile participant={participant({ isLocal: true, speaking: true })} />);

      expect(container.firstChild).toHaveClass('ring-2');
      expect(container.firstChild).toHaveClass('ring-success');
    });
  });

  describe('avatar and tile color', () => {
    it('renders an avatar image at the given avatarUrl when there is no video track', () => {
      render(<ParticipantTile participant={participant({ name: 'Felipe' })} avatarUrl="https://example.test/felipe.png" />);

      expect(screen.getByRole('img', { name: 'Felipe' })).toHaveAttribute('src', 'https://example.test/felipe.png');
    });

    it('applies a deterministic background color for the identity when there is no video track', () => {
      const { container } = render(<ParticipantTile participant={participant({ identity: 'u1' })} />);

      expect(container.firstChild).toHaveClass('bg-cyan-900');
    });

    it('uses the plain camera background instead of a palette color when a video track is present', () => {
      const videoTrack = { attach: vi.fn(), detach: vi.fn() } as never;
      const { container } = render(
        <ParticipantTile participant={participant({ identity: 'u1', videoTrack, cameraEnabled: true })} />,
      );

      expect(container.firstChild).toHaveClass('bg-gray-800');
      expect(container.firstChild).not.toHaveClass('bg-cyan-900');
    });
  });

  describe('remote volume control', () => {
    beforeEach(() => {
      vi.mocked(voiceClient.setParticipantVolume).mockClear();
    });

    it('renders a volume control for a remote participant', () => {
      render(<ParticipantTile participant={participant({ isLocal: false, identity: 'bob' })} />);

      expect(screen.getByRole('slider', { name: 'Volume for Felipe' })).toBeInTheDocument();
    });

    it('does not render a volume control for the local participant', () => {
      render(<ParticipantTile participant={participant({ isLocal: true })} />);

      expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    });

    it('forwards volume changes to voiceClient.setParticipantVolume for that identity', () => {
      render(<ParticipantTile participant={participant({ isLocal: false, identity: 'bob' })} />);

      fireEvent.change(screen.getByRole('slider', { name: 'Volume for Felipe' }), { target: { value: '30' } });

      expect(voiceClient.setParticipantVolume).toHaveBeenCalledWith('bob', 0.3);
    });

    it('hides the volume control when showVolumeControl is false, even for a remote participant', () => {
      render(<ParticipantTile participant={participant({ isLocal: false, identity: 'bob' })} showVolumeControl={false} />);

      expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    });
  });

  describe('connecting state', () => {
    it('shows a loading spinner when the camera is enabled but the track has not attached yet', () => {
      render(<ParticipantTile participant={participant({ cameraEnabled: true, videoTrack: null })} />);

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('does not show a spinner once the video track is attached', () => {
      const videoTrack = { attach: vi.fn(), detach: vi.fn() } as never;
      render(<ParticipantTile participant={participant({ cameraEnabled: true, videoTrack })} />);

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('does not show a spinner when the camera is simply off', () => {
      render(<ParticipantTile participant={participant({ cameraEnabled: false, videoTrack: null })} />);

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  describe('connection issue badge', () => {
    it('shows a badge for a remote participant with poor connection quality', () => {
      render(<ParticipantTile participant={participant({ isLocal: false, connectionQuality: ConnectionQuality.Poor })} />);

      expect(screen.getByLabelText('Connection: poor')).toBeInTheDocument();
    });

    it('shows a badge for a remote participant whose connection is lost', () => {
      render(<ParticipantTile participant={participant({ isLocal: false, connectionQuality: ConnectionQuality.Lost })} />);

      expect(screen.getByLabelText('Connection: lost')).toBeInTheDocument();
    });

    it('does not show a badge for good or excellent connection quality', () => {
      render(<ParticipantTile participant={participant({ isLocal: false, connectionQuality: ConnectionQuality.Good })} />);

      expect(screen.queryByLabelText(/Connection:/)).not.toBeInTheDocument();
    });

    it('never shows a badge for the local participant, even with poor connection quality', () => {
      render(<ParticipantTile participant={participant({ isLocal: true, connectionQuality: ConnectionQuality.Poor })} />);

      expect(screen.queryByLabelText(/Connection:/)).not.toBeInTheDocument();
    });
  });

  describe('tier className prop', () => {
    it('appends the given className alongside the default aspect-video sizing', () => {
      const { container } = render(<ParticipantTile participant={participant()} className="h-full max-h-full" />);

      expect(container.firstChild).toHaveClass('aspect-video', 'h-full', 'max-h-full');
    });

    it('defaults to no extra className', () => {
      const { container } = render(<ParticipantTile participant={participant()} />);

      expect(container.firstChild).toHaveClass('aspect-video');
    });
  });
});
