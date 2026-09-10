import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionQuality } from 'livekit-client';
import { describe, expect, it, vi } from 'vitest';
import type { VoiceParticipant } from '../../types/voice';
import { CameraGrid } from './CameraGrid';

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

describe('CameraGrid', () => {
  it('renders nothing when there are no camera-on participants', () => {
    const { container } = render(
      <CameraGrid participants={[]} avatarUrlByUserId={new Map()} deafenedByUserId={new Map()} onFocus={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders one tile per participant', () => {
    render(
      <CameraGrid
        participants={[participant({ identity: 'u1', name: 'Felipe' }), participant({ identity: 'u2', name: 'João' })]}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
        onFocus={vi.fn()}
      />,
    );

    expect(screen.getByText(/Felipe/)).toBeInTheDocument();
    expect(screen.getByText(/João/)).toBeInTheDocument();
  });

  it('marks its container as a named hover group for grid-wide control reveal', () => {
    render(
      <CameraGrid
        participants={[participant({ identity: 'u1' })]}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
        onFocus={vi.fn()}
      />,
    );

    expect(screen.getByTestId('camera-grid')).toHaveClass('group/camera-grid');
  });

  it('renders tiles whose controls reveal on the grid\'s hover rather than their own', () => {
    render(
      <CameraGrid
        participants={[participant({ identity: 'u1', name: 'Felipe' })]}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
        onFocus={vi.fn()}
      />,
    );

    const wrapper = screen.getByRole('slider', { name: 'Volume for Felipe' }).parentElement?.parentElement;
    expect(wrapper).toHaveClass('group-hover/camera-grid:opacity-100');
  });

  it('applies the 2x2 tier layout for 3 participants, with the third tile spanning both columns', () => {
    render(
      <CameraGrid
        participants={[participant({ identity: 'u1' }), participant({ identity: 'u2' }), participant({ identity: 'u3' })]}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
        onFocus={vi.fn()}
      />,
    );

    expect(screen.getByTestId('camera-grid')).toHaveClass('grid-cols-2');
    expect(screen.getByTestId('camera-grid')).toHaveClass('[&>:nth-child(3)]:col-span-2');
  });

  it('passes deafened and avatarUrl through to the matching tile by identity', () => {
    render(
      <CameraGrid
        participants={[participant({ identity: 'u2', name: 'João', micEnabled: false })]}
        avatarUrlByUserId={new Map([['u2', 'https://example.test/joao.png']])}
        deafenedByUserId={new Map([['u2', true]])}
        onFocus={vi.fn()}
      />,
    );

    expect(screen.getByTestId('deaf-status-on')).toBeInTheDocument();
  });

  it('calls onFocus with the right target when a tile is manually focused', async () => {
    const user = userEvent.setup();
    const onFocus = vi.fn();
    render(
      <CameraGrid
        participants={[participant({ identity: 'u1', name: 'Felipe' }), participant({ identity: 'u2', name: 'João' })]}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
        onFocus={onFocus}
      />,
    );

    await user.click(screen.getByRole('button', { name: "Focus on João's camera" }));

    expect(onFocus).toHaveBeenCalledWith({ type: 'camera', identity: 'u2' });
  });
});
