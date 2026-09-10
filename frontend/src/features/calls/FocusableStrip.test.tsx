import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionQuality } from 'livekit-client';
import { describe, expect, it, vi } from 'vitest';
import type { VoiceParticipant } from '../../types/voice';
import { FocusableStrip } from './FocusableStrip';

vi.mock('../../services/voiceClient', () => ({
  voiceClient: { setParticipantVolume: vi.fn() },
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

describe('FocusableStrip', () => {
  it('renders nothing when there is nothing else to focus', () => {
    const { container } = render(
      <FocusableStrip
        participants={[participant({ identity: 'u1', cameraEnabled: true })]}
        focusTarget={{ type: 'camera', identity: 'u1' }}
        onFocus={vi.fn()}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders an entry for another camera-on participant, excluding the focused one', () => {
    render(
      <FocusableStrip
        participants={[
          participant({ identity: 'u1', name: 'Felipe', cameraEnabled: true }),
          participant({ identity: 'u2', name: 'João', cameraEnabled: true }),
        ]}
        focusTarget={{ type: 'camera', identity: 'u1' }}
        onFocus={vi.fn()}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    expect(screen.getByRole('button', { name: "Focus on João's camera" })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: "Focus on Felipe's camera" })).not.toBeInTheDocument();
  });

  it('renders an entry for another sharing participant, excluding the focused share', () => {
    const track = { attach: vi.fn(), detach: vi.fn() } as never;
    render(
      <FocusableStrip
        participants={[
          participant({ identity: 'u1', name: 'Felipe', screenShareTrack: track }),
          participant({ identity: 'u2', name: 'João', screenShareTrack: track }),
        ]}
        focusTarget={{ type: 'share', identity: 'u1' }}
        onFocus={vi.fn()}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    expect(screen.getByRole('button', { name: "Focus on João's screen" })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: "Focus on Felipe's screen" })).not.toBeInTheDocument();
  });

  it("still offers a participant's camera when their share is the focused item", () => {
    const track = { attach: vi.fn(), detach: vi.fn() } as never;
    render(
      <FocusableStrip
        participants={[participant({ identity: 'u1', name: 'Felipe', cameraEnabled: true, screenShareTrack: track })]}
        focusTarget={{ type: 'share', identity: 'u1' }}
        onFocus={vi.fn()}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    expect(screen.getByRole('button', { name: "Focus on Felipe's camera" })).toBeInTheDocument();
  });

  it('calls onFocus with the right target when a camera entry is clicked', async () => {
    const user = userEvent.setup();
    const onFocus = vi.fn();
    render(
      <FocusableStrip
        participants={[
          participant({ identity: 'u1', name: 'Felipe', cameraEnabled: true }),
          participant({ identity: 'u2', name: 'João', cameraEnabled: true }),
        ]}
        focusTarget={{ type: 'camera', identity: 'u1' }}
        onFocus={onFocus}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    await user.click(screen.getByRole('button', { name: "Focus on João's camera" }));

    expect(onFocus).toHaveBeenCalledWith({ type: 'camera', identity: 'u2' });
  });

  it('never renders a volume-control slider on its camera entries', () => {
    render(
      <FocusableStrip
        participants={[
          participant({ identity: 'u1', name: 'Felipe', cameraEnabled: true }),
          participant({ identity: 'u2', name: 'João', cameraEnabled: true }),
        ]}
        focusTarget={{ type: 'camera', identity: 'u1' }}
        onFocus={vi.fn()}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });
});
