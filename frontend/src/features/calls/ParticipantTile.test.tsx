import { fireEvent, render, screen } from '@testing-library/react';
import { ConnectionQuality } from 'livekit-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { voiceClient } from '../../services/voiceClient';
import type { VoiceParticipant } from '../../types/voice';
import { ParticipantTile, tileColorFor } from './ParticipantTile';

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
    ...overrides,
  };
}

describe('tileColorFor', () => {
  it('is deterministic for the same identity', () => {
    expect(tileColorFor('u1')).toBe('bg-cyan-900');
    expect(tileColorFor('u1')).toBe(tileColorFor('u1'));
  });

  it('picks a different color for a different identity', () => {
    expect(tileColorFor('u2')).toBe('bg-blue-900');
  });
});

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

  it('always shows the name pill bottom-left, for both local and remote tiles', () => {
    const { container: remoteContainer } = render(<ParticipantTile participant={participant({ isLocal: false })} />);
    const { container: localContainer } = render(<ParticipantTile participant={participant({ isLocal: true })} />);

    expect(remoteContainer.querySelector('.bottom-1')).not.toBeNull();
    expect(localContainer.querySelector('.bottom-1')).not.toBeNull();
    expect(localContainer.querySelector('.top-1')).toBeNull();
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
      const { container } = render(<ParticipantTile participant={participant({ identity: 'u1', videoTrack })} />);

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
  });
});
