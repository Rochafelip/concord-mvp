import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { VoiceParticipant } from '../../types/voice';
import { ParticipantTile } from './ParticipantTile';

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
});
