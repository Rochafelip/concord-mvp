import { render, screen } from '@testing-library/react';
import { ConnectionQuality } from 'livekit-client';
import { describe, expect, it, vi } from 'vitest';
import type { VoiceParticipant } from '../../types/voice';
import { ScreenShareTile } from './ScreenShareTile';

function sharingParticipant(overrides: Partial<VoiceParticipant> = {}): VoiceParticipant {
  const track = { attach: vi.fn(), detach: vi.fn() } as never;
  return {
    identity: 'u1',
    name: 'Felipe',
    isLocal: false,
    micEnabled: true,
    cameraEnabled: false,
    videoTrack: null,
    screenShareEnabled: true,
    screenShareTrack: track,
    connectionQuality: ConnectionQuality.Unknown,
    ...overrides,
  };
}

describe('ScreenShareTile', () => {
  it("labels the tile with the sharer's name", () => {
    render(<ScreenShareTile participant={sharingParticipant({ name: 'Felipe' })} />);

    expect(screen.getByText(/Felipe's screen/)).toBeInTheDocument();
  });

  it('appends "(you)" to the label for the local participant', () => {
    render(<ScreenShareTile participant={sharingParticipant({ name: 'Felipe', isLocal: true })} />);

    expect(screen.getByText(/Felipe's screen \(you\)/)).toBeInTheDocument();
  });

  it('does not append "(you)" for a remote participant', () => {
    render(<ScreenShareTile participant={sharingParticipant({ name: 'Felipe', isLocal: false })} />);

    expect(screen.queryByText(/\(you\)/)).not.toBeInTheDocument();
  });

  it('attaches the screen share track to the <video> element on mount, and detaches it on unmount', () => {
    const attach = vi.fn();
    const detach = vi.fn();
    const track = { attach, detach } as never;

    const { unmount, container } = render(
      <ScreenShareTile participant={sharingParticipant({ screenShareTrack: track })} />,
    );

    const videoElement = container.querySelector('video');
    expect(videoElement).not.toBeNull();
    expect(attach).toHaveBeenCalledWith(videoElement);

    unmount();
    expect(detach).toHaveBeenCalledWith(videoElement);
  });
});
