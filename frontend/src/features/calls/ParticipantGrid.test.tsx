import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionQuality } from 'livekit-client';
import { describe, expect, it, vi } from 'vitest';
import type { VoiceParticipant } from '../../types/voice';
import { ParticipantGrid } from './ParticipantGrid';

function participant(overrides: Partial<VoiceParticipant> = {}): VoiceParticipant {
  return {
    identity: 'u1',
    name: 'Felipe',
    isLocal: false,
    micEnabled: true,
    cameraEnabled: true,
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

describe('ParticipantGrid', () => {
  it('renders nothing when there are no participants', () => {
    const { container } = render(
      <ParticipantGrid participants={[]} avatarUrlByUserId={new Map()} deafenedByUserId={new Map()} onWatch={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders one tile per participant', () => {
    render(
      <ParticipantGrid
        participants={[participant({ identity: 'u1', name: 'Felipe' }), participant({ identity: 'u2', name: 'João' })]}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
        onWatch={vi.fn()}
      />,
    );

    expect(screen.getByText(/Felipe/)).toBeInTheDocument();
    expect(screen.getByText(/João/)).toBeInTheDocument();
  });

  it('renders a camera-off participant as an avatar tile in the same grid, not a separate roster', () => {
    render(
      <ParticipantGrid
        participants={[participant({ identity: 'u1', name: 'Felipe', cameraEnabled: false })]}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
        onWatch={vi.fn()}
      />,
    );

    expect(screen.getByTestId('participant-grid')).toContainElement(screen.getByText(/Felipe/));
  });

  it('does not make a camera-off tile watch-clickable', () => {
    render(
      <ParticipantGrid
        participants={[participant({ identity: 'u1', name: 'Felipe', cameraEnabled: false })]}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
        onWatch={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: "Focus on Felipe's camera" })).not.toBeInTheDocument();
  });

  it('marks its container as a named hover group for grid-wide control reveal', () => {
    render(
      <ParticipantGrid
        participants={[participant({ identity: 'u1' })]}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
        onWatch={vi.fn()}
      />,
    );

    expect(screen.getByTestId('participant-grid')).toHaveClass('group/camera-grid');
  });

  it('applies the 2x2 tier layout for 3 participants, with the third tile spanning both columns', () => {
    render(
      <ParticipantGrid
        participants={[participant({ identity: 'u1' }), participant({ identity: 'u2' }), participant({ identity: 'u3' })]}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
        onWatch={vi.fn()}
      />,
    );

    expect(screen.getByTestId('participant-grid')).toHaveClass('grid-cols-2');
    expect(screen.getByTestId('participant-grid')).toHaveClass('[&>:nth-child(3)]:col-span-2');
  });

  it('passes deafened and avatarUrl through to the matching tile by identity', () => {
    render(
      <ParticipantGrid
        participants={[participant({ identity: 'u2', name: 'João', micEnabled: false })]}
        avatarUrlByUserId={new Map([['u2', 'https://example.test/joao.png']])}
        deafenedByUserId={new Map([['u2', true]])}
        onWatch={vi.fn()}
      />,
    );

    expect(screen.getByTestId('deaf-status-on')).toBeInTheDocument();
  });

  it('calls onWatch with the right target when a camera-on tile is clicked', async () => {
    const user = userEvent.setup();
    const onWatch = vi.fn();
    render(
      <ParticipantGrid
        participants={[participant({ identity: 'u1', name: 'Felipe' }), participant({ identity: 'u2', name: 'João' })]}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
        onWatch={onWatch}
      />,
    );

    await user.click(screen.getByRole('button', { name: "Focus on João's camera" }));

    expect(onWatch).toHaveBeenCalledWith({ type: 'camera', identity: 'u2' });
  });
});
