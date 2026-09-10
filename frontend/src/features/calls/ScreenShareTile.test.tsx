import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionQuality } from 'livekit-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { voiceClient } from '../../services/voiceClient';
import { useVoiceStore } from '../../stores/voiceStore';
import type { VoiceParticipant } from '../../types/voice';
import { ScreenShareTile } from './ScreenShareTile';

vi.mock('../../services/voiceClient', () => ({
  voiceClient: {
    setScreenShareVolume: vi.fn(),
    toggleMute: vi.fn(),
    disconnect: vi.fn(),
  },
}));

beforeEach(() => {
  Object.defineProperty(document, 'fullscreenElement', { value: null, writable: true, configurable: true });
  Element.prototype.requestFullscreen = vi.fn(function (this: HTMLElement) {
    Object.defineProperty(document, 'fullscreenElement', { value: this, writable: true, configurable: true });
    document.dispatchEvent(new Event('fullscreenchange'));
    return Promise.resolve();
  }) as never;
  document.exitFullscreen = vi.fn(() => {
    Object.defineProperty(document, 'fullscreenElement', { value: null, writable: true, configurable: true });
    document.dispatchEvent(new Event('fullscreenchange'));
    return Promise.resolve();
  }) as never;
});

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
    screenShareHasAudio: false,
    screenShareAudioEnabled: true,
    connectionQuality: ConnectionQuality.Unknown,
    speaking: false,
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

    const { unmount, container } = render(<ScreenShareTile participant={sharingParticipant({ screenShareTrack: track })} />);

    const videoElement = container.querySelector('video');
    expect(videoElement).not.toBeNull();
    expect(attach).toHaveBeenCalledWith(videoElement);

    unmount();
    expect(detach).toHaveBeenCalledWith(videoElement);
  });

  it('always renders video immediately for a remote share, with no Watch gate', () => {
    const { container } = render(<ScreenShareTile participant={sharingParticipant({ isLocal: false })} />);

    expect(container.querySelector('video')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /^Watch/ })).not.toBeInTheDocument();
  });

  describe('audio starts muted', () => {
    beforeEach(() => {
      vi.mocked(voiceClient.setScreenShareVolume).mockClear();
    });

    it('silences screen-share audio for a remote participant on mount', () => {
      render(<ScreenShareTile participant={sharingParticipant({ isLocal: false, identity: 'bob', screenShareHasAudio: true })} />);

      expect(voiceClient.setScreenShareVolume).toHaveBeenCalledWith('bob', 0);
    });

    it('does not touch volume for a share with no audio', () => {
      render(<ScreenShareTile participant={sharingParticipant({ isLocal: false, screenShareHasAudio: false })} />);

      expect(voiceClient.setScreenShareVolume).not.toHaveBeenCalled();
    });

    it("does not silence the local participant's own share", () => {
      render(<ScreenShareTile participant={sharingParticipant({ isLocal: true, screenShareHasAudio: true })} />);

      expect(voiceClient.setScreenShareVolume).not.toHaveBeenCalled();
    });

    it('renders the volume control muted by default', () => {
      render(<ScreenShareTile participant={sharingParticipant({ isLocal: false, screenShareHasAudio: true, name: 'Felipe' })} />);

      expect(screen.getByRole('slider', { name: "Volume for Felipe's screen" })).toHaveValue('0');
    });
  });

  describe('volume control', () => {
    beforeEach(() => {
      vi.mocked(voiceClient.setScreenShareVolume).mockClear();
    });

    it('renders a volume control when the share has audio and the sharer is remote', () => {
      render(<ScreenShareTile participant={sharingParticipant({ isLocal: false, screenShareHasAudio: true, name: 'Felipe' })} />);

      expect(screen.getByRole('slider', { name: "Volume for Felipe's screen" })).toBeInTheDocument();
    });

    it('does not render a volume control when the share has no audio', () => {
      render(<ScreenShareTile participant={sharingParticipant({ isLocal: false, screenShareHasAudio: false })} />);

      expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    });

    it('does not render a volume control when the presenter has muted the shared audio', () => {
      render(
        <ScreenShareTile
          participant={sharingParticipant({ isLocal: false, screenShareHasAudio: true, screenShareAudioEnabled: false })}
        />,
      );

      expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    });

    it('does not render a volume control for your own screen share, even with audio', () => {
      render(<ScreenShareTile participant={sharingParticipant({ isLocal: true, screenShareHasAudio: true })} />);

      expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    });

    it('forwards volume changes to voiceClient.setScreenShareVolume for that identity', () => {
      render(
        <ScreenShareTile
          participant={sharingParticipant({ isLocal: false, identity: 'bob', screenShareHasAudio: true, name: 'Felipe' })}
        />,
      );

      fireEvent.change(screen.getByRole('slider', { name: "Volume for Felipe's screen" }), { target: { value: '65' } });

      expect(voiceClient.setScreenShareVolume).toHaveBeenCalledWith('bob', 0.65);
    });

    it('does not trigger onWatchClick when the volume slider is used', () => {
      const onWatchClick = vi.fn();
      render(
        <ScreenShareTile
          participant={sharingParticipant({ isLocal: false, screenShareHasAudio: true })}
          onWatchClick={onWatchClick}
        />,
      );

      fireEvent.click(screen.getByRole('slider', { name: "Volume for Felipe's screen" }));

      expect(onWatchClick).not.toHaveBeenCalled();
    });
  });

  describe('click-to-remove from the watched set', () => {
    it('is not clickable when onWatchClick is omitted', () => {
      const { container } = render(<ScreenShareTile participant={sharingParticipant()} />);

      expect(container.firstChild).not.toHaveAttribute('role', 'button');
    });

    it('calls onWatchClick when a remote tile is clicked', async () => {
      const user = userEvent.setup();
      const onWatchClick = vi.fn();
      render(
        <ScreenShareTile participant={sharingParticipant({ isLocal: false, name: 'Felipe' })} onWatchClick={onWatchClick} />,
      );

      await user.click(screen.getByRole('button', { name: "Stop watching Felipe's screen" }));

      expect(onWatchClick).toHaveBeenCalledTimes(1);
    });

    it('is never clickable for the local participant\'s own share, even if onWatchClick is passed', () => {
      const { container } = render(<ScreenShareTile participant={sharingParticipant({ isLocal: true })} onWatchClick={vi.fn()} />);

      expect(container.firstChild).not.toHaveAttribute('role', 'button');
    });

    it('does not trigger onWatchClick when the fullscreen button is clicked', async () => {
      const user = userEvent.setup();
      const onWatchClick = vi.fn();
      render(<ScreenShareTile participant={sharingParticipant({ isLocal: false })} onWatchClick={onWatchClick} />);

      await user.click(screen.getByRole('button', { name: 'Enter fullscreen' }));

      expect(onWatchClick).not.toHaveBeenCalled();
    });
  });

  describe('fullscreen', () => {
    it('requests fullscreen on the tile when the expand button is clicked', async () => {
      const user = userEvent.setup();
      const { container } = render(<ScreenShareTile participant={sharingParticipant()} />);

      await user.click(screen.getByRole('button', { name: 'Enter fullscreen' }));

      expect(container.firstChild).toBe(document.fullscreenElement);
    });

    it('switches the tile to a full-viewport layout once fullscreen is entered', async () => {
      const user = userEvent.setup();
      const { container } = render(<ScreenShareTile participant={sharingParticipant()} />);

      await user.click(screen.getByRole('button', { name: 'Enter fullscreen' }));

      expect(container.firstChild).toHaveClass('fixed', 'inset-0');
    });

    it('hides the sharer label and the expand button once fullscreen is entered', async () => {
      const user = userEvent.setup();
      render(<ScreenShareTile participant={sharingParticipant({ name: 'Felipe' })} />);

      await user.click(screen.getByRole('button', { name: 'Enter fullscreen' }));

      expect(screen.queryByText(/Felipe's screen/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Enter fullscreen' })).not.toBeInTheDocument();
    });

    it('shows an exit-fullscreen button once fullscreen is entered, and none of the normal-mode controls', async () => {
      const user = userEvent.setup();
      render(<ScreenShareTile participant={sharingParticipant()} />);

      await user.click(screen.getByRole('button', { name: 'Enter fullscreen' }));

      expect(screen.getByRole('button', { name: 'Exit fullscreen' })).toBeInTheDocument();
    });

    it('keeps the volume control available once fullscreen is entered', async () => {
      const user = userEvent.setup();
      render(<ScreenShareTile participant={sharingParticipant({ isLocal: false, screenShareHasAudio: true, name: 'Felipe' })} />);

      await user.click(screen.getByRole('button', { name: 'Enter fullscreen' }));

      expect(screen.getByRole('slider', { name: "Volume for Felipe's screen" })).toBeInTheDocument();
    });

    it('calls document.exitFullscreen when the exit button is clicked, and reverts the layout', async () => {
      const user = userEvent.setup();
      const { container } = render(<ScreenShareTile participant={sharingParticipant()} />);

      await user.click(screen.getByRole('button', { name: 'Enter fullscreen' }));
      await user.click(screen.getByRole('button', { name: 'Exit fullscreen' }));

      expect(document.exitFullscreen).toHaveBeenCalledTimes(1);
      expect(container.firstChild).not.toHaveClass('fixed', 'inset-0');
      expect(screen.getByRole('button', { name: 'Enter fullscreen' })).toBeInTheDocument();
    });

    it('falls back to the full-viewport layout when requestFullscreen() rejects', async () => {
      vi.mocked(Element.prototype.requestFullscreen).mockRejectedValueOnce(new Error('not allowed'));
      const user = userEvent.setup();
      const { container } = render(<ScreenShareTile participant={sharingParticipant()} />);

      await user.click(screen.getByRole('button', { name: 'Enter fullscreen' }));

      expect(container.firstChild).toHaveClass('fixed', 'inset-0');
    });

    it('exits the CSS-only fallback on Escape', async () => {
      vi.mocked(Element.prototype.requestFullscreen).mockRejectedValueOnce(new Error('not allowed'));
      const user = userEvent.setup();
      const { container } = render(<ScreenShareTile participant={sharingParticipant()} />);

      await user.click(screen.getByRole('button', { name: 'Enter fullscreen' }));
      await user.keyboard('{Escape}');

      expect(container.firstChild).not.toHaveClass('fixed', 'inset-0');
    });

    it('exits the CSS-only fallback via the exit button without calling document.exitFullscreen', async () => {
      vi.mocked(Element.prototype.requestFullscreen).mockRejectedValueOnce(new Error('not allowed'));
      const user = userEvent.setup();
      const { container } = render(<ScreenShareTile participant={sharingParticipant()} />);

      await user.click(screen.getByRole('button', { name: 'Enter fullscreen' }));
      await user.click(screen.getByRole('button', { name: 'Exit fullscreen' }));

      expect(document.exitFullscreen).not.toHaveBeenCalled();
      expect(container.firstChild).not.toHaveClass('fixed', 'inset-0');
    });

    describe('controls bar', () => {
      beforeEach(() => {
        useVoiceStore.setState({ participants: [] });
      });

      it('does not show a mute button when there is no local participant in the call', async () => {
        const user = userEvent.setup();
        render(<ScreenShareTile participant={sharingParticipant()} />);

        await user.click(screen.getByRole('button', { name: 'Enter fullscreen' }));

        expect(screen.queryByRole('button', { name: /mute/i })).not.toBeInTheDocument();
      });

      it('shows a Mute button reflecting the local participant, and toggles it via voiceClient', async () => {
        useVoiceStore.setState({
          participants: [{ ...sharingParticipant({ isLocal: false }), identity: 'me', isLocal: true, micEnabled: true }],
        });
        const user = userEvent.setup();
        render(<ScreenShareTile participant={sharingParticipant()} />);

        await user.click(screen.getByRole('button', { name: 'Enter fullscreen' }));
        await user.click(screen.getByRole('button', { name: 'Mute' }));

        expect(voiceClient.toggleMute).toHaveBeenCalledTimes(1);
      });

      it('shows an Unmute button when the local participant is already muted', async () => {
        useVoiceStore.setState({
          participants: [{ ...sharingParticipant({ isLocal: false }), identity: 'me', isLocal: true, micEnabled: false }],
        });
        const user = userEvent.setup();
        render(<ScreenShareTile participant={sharingParticipant()} />);

        await user.click(screen.getByRole('button', { name: 'Enter fullscreen' }));

        expect(screen.getByRole('button', { name: 'Unmute' })).toBeInTheDocument();
      });

      it('calls voiceClient.disconnect when the leave-call button is clicked', async () => {
        const user = userEvent.setup();
        render(<ScreenShareTile participant={sharingParticipant()} />);

        await user.click(screen.getByRole('button', { name: 'Enter fullscreen' }));
        await user.click(screen.getByRole('button', { name: 'Leave call' }));

        expect(voiceClient.disconnect).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('sizing', () => {
    it('spans the full width of its wrapping section by default', () => {
      const { container } = render(<ScreenShareTile participant={sharingParticipant({ name: 'Felipe' })} />);

      expect(container.firstChild).toHaveClass('w-full');
    });

    it('appends a given className alongside the default sizing', () => {
      const { container } = render(<ScreenShareTile participant={sharingParticipant()} className="h-full max-h-full max-w-full" />);

      expect(container.firstChild).toHaveClass('aspect-video', 'h-full', 'max-h-full');
    });
  });
});
