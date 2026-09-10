import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionQuality } from 'livekit-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVoiceStore } from '../../stores/voiceStore';
import type { VoiceParticipant } from '../../types/voice';
import { FocusedCallView } from './FocusedCallView';

vi.mock('../../services/voiceClient', () => ({
  voiceClient: {
    setParticipantVolume: vi.fn(),
    setScreenShareVolume: vi.fn(),
    toggleMute: vi.fn(),
    disconnect: vi.fn(),
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

describe('FocusedCallView', () => {
  beforeEach(() => {
    useVoiceStore.setState({ status: 'connected', channelId: 'c1', participants: [], error: null });
  });

  it('renders a large ParticipantTile for a single watched camera target', () => {
    render(
      <FocusedCallView
        participants={[participant({ identity: 'u1', name: 'Felipe', cameraEnabled: true })]}
        watchTargets={[{ type: 'camera', identity: 'u1' }]}
        isManual
        onAddWatch={vi.fn()}
        onRemoveWatch={vi.fn()}
        onReturnToAutomatic={vi.fn()}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    expect(screen.getByText(/Felipe/)).toBeInTheDocument();
  });

  it('reveals a watched camera tile\'s volume control on hover over the whole watched area, not the tile', () => {
    render(
      <FocusedCallView
        participants={[participant({ identity: 'u1', name: 'Felipe', isLocal: false, cameraEnabled: true })]}
        watchTargets={[{ type: 'camera', identity: 'u1' }]}
        isManual
        onAddWatch={vi.fn()}
        onRemoveWatch={vi.fn()}
        onReturnToAutomatic={vi.fn()}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    expect(screen.getByTestId('watched-area')).toHaveClass('group/camera-grid');
    const wrapper = screen.getByRole('slider', { name: 'Volume for Felipe' }).parentElement?.parentElement;
    expect(wrapper).toHaveClass('group-hover/camera-grid:opacity-100');
    expect(wrapper).not.toHaveClass('group-hover:opacity-100');
  });

  it('reveals a watched share tile\'s fullscreen button on hover over the whole watched area', () => {
    const track = { attach: vi.fn(), detach: vi.fn() } as never;
    render(
      <FocusedCallView
        participants={[participant({ identity: 'u1', name: 'Felipe', screenShareTrack: track })]}
        watchTargets={[{ type: 'share', identity: 'u1' }]}
        isManual={false}
        onAddWatch={vi.fn()}
        onRemoveWatch={vi.fn()}
        onReturnToAutomatic={vi.fn()}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    const button = screen.getByRole('button', { name: 'Enter fullscreen' });
    expect(button).toHaveClass('group-hover/camera-grid:opacity-100');
    expect(button).not.toHaveClass('group-hover:opacity-100');
  });

  it('renders a ScreenShareTile for a single watched share target', () => {
    const track = { attach: vi.fn(), detach: vi.fn() } as never;
    render(
      <FocusedCallView
        participants={[participant({ identity: 'u1', name: 'Felipe', screenShareTrack: track })]}
        watchTargets={[{ type: 'share', identity: 'u1' }]}
        isManual={false}
        onAddWatch={vi.fn()}
        onRemoveWatch={vi.fn()}
        onReturnToAutomatic={vi.fn()}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    expect(screen.getByText(/Felipe's screen/)).toBeInTheDocument();
  });

  it('renders one tile per watched target when watching 2 shares at once', () => {
    const track = { attach: vi.fn(), detach: vi.fn() } as never;
    render(
      <FocusedCallView
        participants={[
          participant({ identity: 'u1', name: 'Felipe', screenShareTrack: track }),
          participant({ identity: 'u2', name: 'João', screenShareTrack: track }),
        ]}
        watchTargets={[
          { type: 'share', identity: 'u1' },
          { type: 'share', identity: 'u2' },
        ]}
        isManual
        onAddWatch={vi.fn()}
        onRemoveWatch={vi.fn()}
        onReturnToAutomatic={vi.fn()}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    expect(screen.getByText(/Felipe's screen/)).toBeInTheDocument();
    expect(screen.getByText(/João's screen/)).toBeInTheDocument();
  });

  it('renders a mix of a watched camera and a watched share at once', () => {
    const track = { attach: vi.fn(), detach: vi.fn() } as never;
    render(
      <FocusedCallView
        participants={[
          participant({ identity: 'u1', name: 'Felipe', cameraEnabled: true }),
          participant({ identity: 'u2', name: 'João', screenShareTrack: track }),
        ]}
        watchTargets={[
          { type: 'camera', identity: 'u1' },
          { type: 'share', identity: 'u2' },
        ]}
        isManual
        onAddWatch={vi.fn()}
        onRemoveWatch={vi.fn()}
        onReturnToAutomatic={vi.fn()}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    expect(screen.getByText(/^Felipe/)).toBeInTheDocument();
    expect(screen.getByText(/João's screen/)).toBeInTheDocument();
  });

  it('clicking a watched camera tile calls onRemoveWatch with that target', async () => {
    const user = userEvent.setup();
    const onRemoveWatch = vi.fn();
    render(
      <FocusedCallView
        participants={[participant({ identity: 'u1', name: 'Felipe', cameraEnabled: true })]}
        watchTargets={[{ type: 'camera', identity: 'u1' }]}
        isManual
        onAddWatch={vi.fn()}
        onRemoveWatch={onRemoveWatch}
        onReturnToAutomatic={vi.fn()}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    await user.click(screen.getByRole('button', { name: "Focus on Felipe's camera" }));

    expect(onRemoveWatch).toHaveBeenCalledWith({ type: 'camera', identity: 'u1' });
  });

  it('shows "return to automatic" only when isManual is true', () => {
    const { rerender } = render(
      <FocusedCallView
        participants={[participant({ identity: 'u1', cameraEnabled: true })]}
        watchTargets={[{ type: 'camera', identity: 'u1' }]}
        isManual={false}
        onAddWatch={vi.fn()}
        onRemoveWatch={vi.fn()}
        onReturnToAutomatic={vi.fn()}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Return to automatic layout' })).not.toBeInTheDocument();

    rerender(
      <FocusedCallView
        participants={[participant({ identity: 'u1', cameraEnabled: true })]}
        watchTargets={[{ type: 'camera', identity: 'u1' }]}
        isManual
        onAddWatch={vi.fn()}
        onRemoveWatch={vi.fn()}
        onReturnToAutomatic={vi.fn()}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Return to automatic layout' })).toBeInTheDocument();
  });

  it('calls onReturnToAutomatic when the return button is clicked', async () => {
    const user = userEvent.setup();
    const onReturnToAutomatic = vi.fn();
    render(
      <FocusedCallView
        participants={[participant({ identity: 'u1', cameraEnabled: true })]}
        watchTargets={[{ type: 'camera', identity: 'u1' }]}
        isManual
        onAddWatch={vi.fn()}
        onRemoveWatch={vi.fn()}
        onReturnToAutomatic={onReturnToAutomatic}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Return to automatic layout' }));

    expect(onReturnToAutomatic).toHaveBeenCalledTimes(1);
  });

  it('always renders the off-camera roster when there are off-camera participants, regardless of what is watched', () => {
    render(
      <FocusedCallView
        participants={[
          participant({ identity: 'u1', name: 'Felipe', cameraEnabled: true }),
          participant({ identity: 'u2', name: 'João', cameraEnabled: false }),
        ]}
        watchTargets={[{ type: 'camera', identity: 'u1' }]}
        isManual={false}
        onAddWatch={vi.fn()}
        onRemoveWatch={vi.fn()}
        onReturnToAutomatic={vi.fn()}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    expect(screen.getByTestId('off-camera-roster')).toContainElement(screen.getByText(/João/));
  });
});
