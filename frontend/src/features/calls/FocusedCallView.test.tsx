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

  it('renders a large ParticipantTile for a camera focus target', () => {
    render(
      <FocusedCallView
        participants={[participant({ identity: 'u1', name: 'Felipe', cameraEnabled: true })]}
        focusTarget={{ type: 'camera', identity: 'u1' }}
        isManual
        onFocus={vi.fn()}
        onReturnToAutomatic={vi.fn()}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    expect(screen.getByText(/Felipe/)).toBeInTheDocument();
  });

  it('keeps its focused tile\'s volume control revealing on its own hover, not the grid\'s', () => {
    render(
      <FocusedCallView
        participants={[participant({ identity: 'u1', name: 'Felipe', isLocal: false, cameraEnabled: true })]}
        focusTarget={{ type: 'camera', identity: 'u1' }}
        isManual
        onFocus={vi.fn()}
        onReturnToAutomatic={vi.fn()}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    const wrapper = screen.getByRole('slider', { name: 'Volume for Felipe' }).parentElement?.parentElement;
    expect(wrapper).toHaveClass('group-hover:opacity-100');
    expect(wrapper).not.toHaveClass('group-hover/camera-grid:opacity-100');
  });

  it('renders the ScreenShareTile for a share focus target', () => {
    const track = { attach: vi.fn(), detach: vi.fn() } as never;
    render(
      <FocusedCallView
        participants={[participant({ identity: 'u1', name: 'Felipe', screenShareTrack: track })]}
        focusTarget={{ type: 'share', identity: 'u1' }}
        isManual={false}
        onFocus={vi.fn()}
        onReturnToAutomatic={vi.fn()}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    expect(screen.getByText(/Felipe's screen/)).toBeInTheDocument();
  });

  it('shows "return to automatic" only when isManual is true', () => {
    const { rerender } = render(
      <FocusedCallView
        participants={[participant({ identity: 'u1', cameraEnabled: true })]}
        focusTarget={{ type: 'camera', identity: 'u1' }}
        isManual={false}
        onFocus={vi.fn()}
        onReturnToAutomatic={vi.fn()}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Return to automatic layout' })).not.toBeInTheDocument();

    rerender(
      <FocusedCallView
        participants={[participant({ identity: 'u1', cameraEnabled: true })]}
        focusTarget={{ type: 'camera', identity: 'u1' }}
        isManual
        onFocus={vi.fn()}
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
        focusTarget={{ type: 'camera', identity: 'u1' }}
        isManual
        onFocus={vi.fn()}
        onReturnToAutomatic={onReturnToAutomatic}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Return to automatic layout' }));

    expect(onReturnToAutomatic).toHaveBeenCalledTimes(1);
  });

  it('always renders the off-camera roster when there are off-camera participants, regardless of focus', () => {
    render(
      <FocusedCallView
        participants={[
          participant({ identity: 'u1', name: 'Felipe', cameraEnabled: true }),
          participant({ identity: 'u2', name: 'João', cameraEnabled: false }),
        ]}
        focusTarget={{ type: 'camera', identity: 'u1' }}
        isManual={false}
        onFocus={vi.fn()}
        onReturnToAutomatic={vi.fn()}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    expect(screen.getByTestId('off-camera-roster')).toContainElement(screen.getByText(/João/));
  });
});
