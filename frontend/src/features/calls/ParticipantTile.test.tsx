import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionQuality } from 'livekit-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContextMenu, type ContextMenuItem } from '../../components/ContextMenu';
import { voiceClient } from '../../services/voiceClient';
import { useVoiceStore } from '../../stores/voiceStore';
import type { VoiceParticipant } from '../../types/voice';
import { disconnectVoiceParticipant } from './api';
import { ParticipantTile } from './ParticipantTile';

vi.mock('../../services/voiceClient', () => ({
  voiceClient: {
    setParticipantVolume: vi.fn(),
    getParticipantVolume: vi.fn().mockReturnValue(1),
  },
}));

vi.mock('./api', () => ({
  disconnectVoiceParticipant: vi.fn(),
}));

// UserProfileCard needs providers this file doesn't set up, and its friend-action right-click
// item is covered by UserProfileCard.test.tsx — this stub keeps only the `contextMenuExtraItems`
// contract ParticipantTile relies on for "Disconnect from voice" and "Silenciar".
vi.mock('../users/UserProfileCard', () => ({
  UserProfileCard: ({
    children,
    contextMenuExtraItems = [],
  }: {
    children: React.ReactNode;
    contextMenuExtraItems?: ContextMenuItem[];
  }) => <ContextMenu items={contextMenuExtraItems}>{children}</ContextMenu>,
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
  beforeEach(() => {
    vi.mocked(voiceClient.getParticipantVolume).mockReturnValue(1);
  });

  // The tile remounts whenever the call layout changes — most visibly when a screen share
  // starts and ParticipantList swaps the grid for FocusedCallView — so the slider has to come
  // back up showing the level this listener already picked, not 100% over quieter audio.
  it("opens its volume slider at the level already chosen for that participant", async () => {
    vi.mocked(voiceClient.getParticipantVolume).mockReturnValue(0.3);
    const user = userEvent.setup();

    render(<ParticipantTile participant={participant({ identity: 'bob', name: 'Bob' })} />);
    await user.click(screen.getByRole('button', { name: 'Volume for Bob' }));

    expect(voiceClient.getParticipantVolume).toHaveBeenCalledWith('bob');
    expect(screen.getByRole('slider', { name: 'Volume for Bob' })).toHaveValue('30');
  });

  it('shows the Concord avatar placeholder when there is no video track', () => {
    const { container } = render(<ParticipantTile participant={participant()} />);

    expect(screen.getByLabelText('Felipe').querySelector('svg')).toBeInTheDocument();
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

    expect(screen.getByLabelText('Felipe').querySelector('svg')).toBeInTheDocument();
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
      expect(container.firstChild).toHaveClass('ring-brand/50');
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
      expect(container.firstChild).toHaveClass('ring-brand/50');
    });
  });

  describe('avatar and tile color', () => {
    it('renders an avatar image at the given avatarUrl when there is no video track', () => {
      render(<ParticipantTile participant={participant({ name: 'Felipe' })} avatarUrl="https://example.test/felipe.png" />);

      expect(screen.getByRole('img', { name: 'Felipe' })).toHaveAttribute('src', 'https://example.test/felipe.png');
    });

    it('applies a deterministic background color for the identity when there is no video track', () => {
      const { container } = render(<ParticipantTile participant={participant({ identity: 'u1' })} />);

      expect(container.firstChild).toHaveClass('bg-gray-800');
    });

    it('uses the plain camera background instead of a palette color when a video track is present', () => {
      const videoTrack = { attach: vi.fn(), detach: vi.fn() } as never;
      const { container } = render(
        <ParticipantTile participant={participant({ identity: 'u1', videoTrack, cameraEnabled: true })} />,
      );

      expect(container.firstChild).toHaveClass('bg-gray-800');
    });
  });

  describe('remote volume control', () => {
    beforeEach(() => {
      vi.mocked(voiceClient.setParticipantVolume).mockClear();
    });

    it('renders a volume control for a remote participant', () => {
      render(<ParticipantTile participant={participant({ isLocal: false, identity: 'bob' })} />);

      expect(screen.getByRole('button', { name: 'Volume for Felipe' })).toBeInTheDocument();
    });

    it('does not render a volume control for the local participant', () => {
      render(<ParticipantTile participant={participant({ isLocal: true })} />);

      expect(screen.queryByRole('button', { name: /^Volume for/ })).not.toBeInTheDocument();
    });

    it('forwards volume changes to voiceClient.setParticipantVolume for that identity', async () => {
      const user = userEvent.setup();
      render(<ParticipantTile participant={participant({ isLocal: false, identity: 'bob' })} />);

      await user.click(screen.getByRole('button', { name: 'Volume for Felipe' }));
      fireEvent.change(screen.getByRole('slider', { name: 'Volume for Felipe' }), { target: { value: '30' } });

      expect(voiceClient.setParticipantVolume).toHaveBeenCalledWith('bob', 0.3);
    });

    it('hides the volume control when showVolumeControl is false, even for a remote participant', () => {
      render(<ParticipantTile participant={participant({ isLocal: false, identity: 'bob' })} showVolumeControl={false} />);

      expect(screen.queryByRole('button', { name: /^Volume for/ })).not.toBeInTheDocument();
    });

    it('reveals the volume icon when its participant tile is hovered', () => {
      render(<ParticipantTile participant={participant({ isLocal: false, identity: 'bob' })} />);

      const trigger = screen.getByRole('button', { name: 'Volume for Felipe' });
      const wrapper = trigger.parentElement?.parentElement;
      expect(wrapper).toHaveClass('opacity-0');
      expect(wrapper).toHaveClass('group-hover/participant-tile:opacity-100');
    });
  });

  describe('watch/focus click target', () => {
    it('is not clickable when onWatchClick is omitted', () => {
      const { container } = render(<ParticipantTile participant={participant({ name: 'Felipe' })} />);

      expect(container.firstChild).not.toHaveAttribute('role', 'button');
      expect(screen.queryByRole('button', { name: "Focus on Felipe's camera" })).not.toBeInTheDocument();
    });

    it('makes the whole tile a clickable button when onWatchClick is provided', async () => {
      const user = userEvent.setup();
      const onWatchClick = vi.fn();
      render(
        <ParticipantTile
          participant={participant({ name: 'Felipe', isLocal: false, identity: 'bob' })}
          onWatchClick={onWatchClick}
        />,
      );

      await user.click(screen.getByRole('button', { name: "Focus on Felipe's camera" }));

      expect(onWatchClick).toHaveBeenCalledTimes(1);
    });

    it('shows a pointer cursor and a tooltip when the whole tile is clickable', () => {
      render(
        <ParticipantTile
          participant={participant({ name: 'Felipe', isLocal: false, identity: 'bob' })}
          onWatchClick={vi.fn()}
        />,
      );

      const tile = screen.getByRole('button', { name: "Focus on Felipe's camera" });
      expect(tile).toHaveClass('cursor-pointer');
      expect(tile).toHaveAttribute('title', "Focus on Felipe's camera");
    });

    it('does not show the pointer cursor when the tile is not clickable', () => {
      const { container } = render(<ParticipantTile participant={participant({ name: 'Felipe' })} />);

      expect(container.firstChild).not.toHaveClass('cursor-pointer');
    });

    it('shows an always-visible affordance badge, not just a hover cursor, since touch has no hover', () => {
      render(
        <ParticipantTile
          participant={participant({ name: 'Felipe', isLocal: false, identity: 'bob' })}
          onWatchClick={vi.fn()}
        />,
      );

      const badge = screen.getByTestId('watch-affordance');
      expect(badge).not.toHaveClass('opacity-0');
      expect(badge).toHaveClass('pointer-events-none');
    });

    it('does not show the affordance badge when the tile is not clickable', () => {
      render(<ParticipantTile participant={participant({ name: 'Felipe' })} />);

      expect(screen.queryByTestId('watch-affordance')).not.toBeInTheDocument();
    });

    it('activates on Enter and Space from the keyboard', async () => {
      const user = userEvent.setup();
      const onWatchClick = vi.fn();
      render(
        <ParticipantTile
          participant={participant({ name: 'Felipe', isLocal: false, identity: 'bob' })}
          onWatchClick={onWatchClick}
        />,
      );

      screen.getByRole('button', { name: "Focus on Felipe's camera" }).focus();
      await user.keyboard('{Enter}');
      await user.keyboard(' ');

      expect(onWatchClick).toHaveBeenCalledTimes(2);
    });

    it('does not trigger onWatchClick when the volume slider is used', async () => {
      const onWatchClick = vi.fn();
      const user = userEvent.setup();
      render(
        <ParticipantTile
          participant={participant({ name: 'Felipe', isLocal: false, identity: 'bob' })}
          onWatchClick={onWatchClick}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Volume for Felipe' }));
      fireEvent.click(screen.getByRole('slider', { name: 'Volume for Felipe' }));

      expect(onWatchClick).not.toHaveBeenCalled();
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

      expect(container.firstChild).toHaveClass('min-h-0', 'min-w-0', 'h-full', 'max-h-full');
    });

    it('defaults to no extra className', () => {
      const { container } = render(<ParticipantTile participant={participant()} />);

      expect(container.firstChild).toHaveClass('min-h-0', 'min-w-0');
    });
  });

  describe('context menu', () => {
    it('disconnects the participant from voice when the menu item is clicked', async () => {
      const user = userEvent.setup();
      render(
        <ParticipantTile participant={participant({ identity: 'bob' })} canDisconnect channelId="chan-1" />,
      );

      fireEvent.contextMenu(screen.getByRole('button', { name: 'Felipe' }));
      await user.click(await screen.findByText('Disconnect from voice'));

      expect(disconnectVoiceParticipant).toHaveBeenCalledWith('chan-1', 'bob');
    });

    it('does not offer to disconnect the local participant', () => {
      render(<ParticipantTile participant={participant({ isLocal: true })} canDisconnect channelId="chan-1" />);

      fireEvent.contextMenu(screen.getByRole('button', { name: 'Felipe' }));

      expect(screen.queryByText('Disconnect from voice')).not.toBeInTheDocument();
    });

    it('does not offer to disconnect without the canDisconnect permission', () => {
      render(<ParticipantTile participant={participant()} channelId="chan-1" />);

      fireEvent.contextMenu(screen.getByRole('button', { name: 'Felipe' }));

      expect(screen.queryByText('Disconnect from voice')).not.toBeInTheDocument();
    });

    it('does not offer to disconnect without a channelId', () => {
      render(<ParticipantTile participant={participant()} canDisconnect />);

      fireEvent.contextMenu(screen.getByRole('button', { name: 'Felipe' }));

      expect(screen.queryByText('Disconnect from voice')).not.toBeInTheDocument();
    });

    it('offers to mute the participant locally regardless of permission', async () => {
      const user = userEvent.setup();
      render(<ParticipantTile participant={participant({ identity: 'bob' })} channelId="chan-1" />);

      fireEvent.contextMenu(screen.getByRole('button', { name: 'Felipe' }));
      await user.click(await screen.findByText('Silenciar'));

      expect(voiceClient.setParticipantVolume).toHaveBeenCalledWith('bob', 0);
    });

    it('does not offer to mute the local participant', () => {
      render(<ParticipantTile participant={participant({ isLocal: true })} channelId="chan-1" />);

      fireEvent.contextMenu(screen.getByRole('button', { name: 'Felipe' }));

      expect(screen.queryByText('Silenciar')).not.toBeInTheDocument();
    });

    it('offers to mute even without a channelId (e.g. a 1:1 DM call)', async () => {
      const user = userEvent.setup();
      render(<ParticipantTile participant={participant({ identity: 'bob' })} />);

      fireEvent.contextMenu(screen.getByRole('button', { name: 'Felipe' }));
      await user.click(await screen.findByText('Silenciar'));

      expect(voiceClient.setParticipantVolume).toHaveBeenCalledWith('bob', 0);
    });
  });

  describe('profile card trigger', () => {
    it('makes the participant name a profile card trigger, for a remote participant', () => {
      render(<ParticipantTile participant={participant({ identity: 'bob', name: 'Bob', isLocal: false })} />);

      expect(screen.getByRole('button', { name: 'Bob' })).toBeInTheDocument();
    });
  });

  describe('private whistle', () => {
    beforeEach(() => {
      useVoiceStore.setState({ armedWhistleTarget: null, whisperingTo: null, receivingWhistleFrom: null });
    });

    it('arms this participant as the whistle target on hover', () => {
      const { container } = render(<ParticipantTile participant={participant({ identity: 'bob' })} />);

      fireEvent.mouseEnter(container.firstChild as Element);

      expect(useVoiceStore.getState().armedWhistleTarget).toBe('bob');
    });

    it('disarms the target when the pointer leaves', () => {
      const { container } = render(<ParticipantTile participant={participant({ identity: 'bob' })} />);
      fireEvent.mouseEnter(container.firstChild as Element);

      fireEvent.mouseLeave(container.firstChild as Element);

      expect(useVoiceStore.getState().armedWhistleTarget).toBeNull();
    });

    it("does not clear a different tile's armed target on leave", () => {
      const { container } = render(<ParticipantTile participant={participant({ identity: 'bob' })} />);
      useVoiceStore.setState({ armedWhistleTarget: 'carol' });

      fireEvent.mouseLeave(container.firstChild as Element);

      expect(useVoiceStore.getState().armedWhistleTarget).toBe('carol');
    });

    it("does not arm the local participant's own tile", () => {
      const { container } = render(<ParticipantTile participant={participant({ identity: 'u1', isLocal: true })} />);

      fireEvent.mouseEnter(container.firstChild as Element);

      expect(useVoiceStore.getState().armedWhistleTarget).toBeNull();
    });

    it('highlights this tile when I am whistling to it', () => {
      useVoiceStore.setState({ whisperingTo: 'bob' });

      const { container } = render(<ParticipantTile participant={participant({ identity: 'bob' })} />);

      expect(container.firstChild).toHaveClass('ring-2', 'ring-danger');
    });

    it('does not highlight a tile I am not whistling to', () => {
      useVoiceStore.setState({ whisperingTo: 'someone-else' });

      const { container } = render(<ParticipantTile participant={participant({ identity: 'bob' })} />);

      expect(container.firstChild).not.toHaveClass('ring-danger');
    });

    it("shows a badge when this tile's participant is whistling to me", () => {
      useVoiceStore.setState({ receivingWhistleFrom: 'bob' });

      render(<ParticipantTile participant={participant({ identity: 'bob' })} />);

      expect(screen.getByTitle('Felipe is whistling to you')).toBeInTheDocument();
    });

    it('does not show the badge when nobody is whistling to me', () => {
      render(<ParticipantTile participant={participant({ identity: 'bob' })} />);

      expect(screen.queryByTitle('Felipe is whistling to you')).not.toBeInTheDocument();
    });
  });
});
