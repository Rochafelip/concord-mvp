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
  it('renders nothing when there is nothing else to watch', () => {
    const { container } = render(
      <FocusableStrip
        participants={[participant({ identity: 'u1', cameraEnabled: true })]}
        watchTargets={[{ type: 'camera', identity: 'u1' }]}
        onAddWatch={vi.fn()}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders an entry for another camera-on participant, excluding every currently watched one', () => {
    render(
      <FocusableStrip
        participants={[
          participant({ identity: 'u1', name: 'Felipe', cameraEnabled: true }),
          participant({ identity: 'u2', name: 'João', cameraEnabled: true }),
        ]}
        watchTargets={[{ type: 'camera', identity: 'u1' }]}
        onAddWatch={vi.fn()}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    expect(screen.getByRole('button', { name: "Focus on João's camera" })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: "Focus on Felipe's camera" })).not.toBeInTheDocument();
  });

  it('renders an entry for another sharing participant, excluding every currently watched share', () => {
    const track = { attach: vi.fn(), detach: vi.fn() } as never;
    render(
      <FocusableStrip
        participants={[
          participant({ identity: 'u1', name: 'Felipe', screenShareTrack: track }),
          participant({ identity: 'u2', name: 'João', screenShareTrack: track }),
        ]}
        watchTargets={[{ type: 'share', identity: 'u1' }]}
        onAddWatch={vi.fn()}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    expect(screen.getByRole('button', { name: "Focus on João's screen" })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: "Focus on Felipe's screen" })).not.toBeInTheDocument();
  });

  it('excludes multiple simultaneously watched shares at once', () => {
    const track = { attach: vi.fn(), detach: vi.fn() } as never;
    render(
      <FocusableStrip
        participants={[
          participant({ identity: 'u1', name: 'Felipe', screenShareTrack: track }),
          participant({ identity: 'u2', name: 'João', screenShareTrack: track }),
          participant({ identity: 'u3', name: 'Maria', screenShareTrack: track }),
        ]}
        watchTargets={[
          { type: 'share', identity: 'u1' },
          { type: 'share', identity: 'u2' },
        ]}
        onAddWatch={vi.fn()}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    expect(screen.getByRole('button', { name: "Focus on Maria's screen" })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: "Focus on Felipe's screen" })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: "Focus on João's screen" })).not.toBeInTheDocument();
  });

  it("still offers a participant's camera when only their share is watched", () => {
    const track = { attach: vi.fn(), detach: vi.fn() } as never;
    render(
      <FocusableStrip
        participants={[participant({ identity: 'u1', name: 'Felipe', cameraEnabled: true, screenShareTrack: track })]}
        watchTargets={[{ type: 'share', identity: 'u1' }]}
        onAddWatch={vi.fn()}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    expect(screen.getByRole('button', { name: "Focus on Felipe's camera" })).toBeInTheDocument();
  });

  it('calls onAddWatch with the right target when a camera entry is clicked', async () => {
    const user = userEvent.setup();
    const onAddWatch = vi.fn();
    render(
      <FocusableStrip
        participants={[
          participant({ identity: 'u1', name: 'Felipe', cameraEnabled: true }),
          participant({ identity: 'u2', name: 'João', cameraEnabled: true }),
        ]}
        watchTargets={[{ type: 'camera', identity: 'u1' }]}
        onAddWatch={onAddWatch}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    await user.click(screen.getByRole('button', { name: "Focus on João's camera" }));

    expect(onAddWatch).toHaveBeenCalledWith({ type: 'camera', identity: 'u2' });
  });

  it('never renders a volume-control slider on its camera entries', () => {
    render(
      <FocusableStrip
        participants={[
          participant({ identity: 'u1', name: 'Felipe', cameraEnabled: true }),
          participant({ identity: 'u2', name: 'João', cameraEnabled: true }),
        ]}
        watchTargets={[{ type: 'camera', identity: 'u1' }]}
        onAddWatch={vi.fn()}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });
});
