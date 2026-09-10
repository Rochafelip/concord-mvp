import { render, screen } from '@testing-library/react';
import { ConnectionQuality } from 'livekit-client';
import { describe, expect, it } from 'vitest';
import type { VoiceParticipant } from '../../types/voice';
import { OffCameraRoster } from './OffCameraRoster';

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

describe('OffCameraRoster', () => {
  it('renders nothing when there are no off-camera participants', () => {
    const { container } = render(
      <OffCameraRoster participants={[]} avatarUrlByUserId={new Map()} deafenedByUserId={new Map()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders a name, avatar, and mic state per participant', () => {
    render(
      <OffCameraRoster
        participants={[participant({ identity: 'u1', name: 'Felipe', micEnabled: false })]}
        avatarUrlByUserId={new Map([['u1', 'https://example.test/felipe.png']])}
        deafenedByUserId={new Map()}
      />,
    );

    expect(screen.getByText('Felipe')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Felipe' })).toHaveAttribute('src', 'https://example.test/felipe.png');
    expect(screen.getByTestId('mic-status-off')).toBeInTheDocument();
  });

  it('shows the deafened icon instead of the mic icon when deafened', () => {
    render(
      <OffCameraRoster
        participants={[participant({ identity: 'u1', name: 'Felipe' })]}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map([['u1', true]])}
      />,
    );

    expect(screen.getByTestId('deaf-status-on')).toBeInTheDocument();
  });

  it('applies a speaking ring to the avatar when the participant is speaking', () => {
    render(
      <OffCameraRoster
        participants={[participant({ identity: 'u1', speaking: true })]}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    expect(screen.getByLabelText('Felipe')).toHaveClass('ring-2', 'ring-success');
  });

  it('does not apply a speaking ring when the participant is not speaking', () => {
    render(
      <OffCameraRoster
        participants={[participant({ identity: 'u1', speaking: false })]}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    expect(screen.getByLabelText('Felipe')).not.toHaveClass('ring-2');
  });
});
