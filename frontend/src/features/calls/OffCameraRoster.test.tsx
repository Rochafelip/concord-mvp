import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionQuality } from 'livekit-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContextMenu, type ContextMenuItem } from '../../components/ContextMenu';
import { voiceClient } from '../../services/voiceClient';
import type { VoiceParticipant } from '../../types/voice';
import { OffCameraRoster } from './OffCameraRoster';

vi.mock('../../services/voiceClient', () => ({
  voiceClient: {
    setParticipantVolume: vi.fn(),
    getParticipantVolume: vi.fn().mockReturnValue(1),
  },
}));

// UserProfileCard needs providers this file doesn't set up, and its friend-action right-click
// item is covered by UserProfileCard.test.tsx — this stub keeps only the `contextMenuExtraItems`
// contract OffCameraRoster relies on for "Silenciar".
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

describe('OffCameraRoster', () => {
  beforeEach(() => {
    vi.mocked(voiceClient.getParticipantVolume).mockReturnValue(1);
    vi.mocked(voiceClient.setParticipantVolume).mockClear();
  });

  // This roster is where every mic-only participant ends up the moment someone starts sharing a
  // screen, so without a volume control here a listener loses the ability to adjust exactly the
  // people they are still listening to — the reported bug's most visible symptom.
  it('lets a listener set a remote participant\'s volume from the roster', () => {
    render(
      <OffCameraRoster
        participants={[participant({ identity: 'bob', name: 'Bob' })]}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Volume for Bob' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Volume for Bob' }), { target: { value: '30' } });

    expect(voiceClient.setParticipantVolume).toHaveBeenCalledWith('bob', 0.3);
  });

  it('opens that slider at the level already chosen for the participant', () => {
    vi.mocked(voiceClient.getParticipantVolume).mockReturnValue(0.3);

    render(
      <OffCameraRoster
        participants={[participant({ identity: 'bob', name: 'Bob' })]}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Volume for Bob' }));

    expect(screen.getByRole('slider', { name: 'Volume for Bob' })).toHaveValue('30');
  });

  it('offers no volume control for the local participant, who has nothing to turn down', () => {
    render(
      <OffCameraRoster
        participants={[participant({ identity: 'me', name: 'Eu', isLocal: true })]}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Volume for Eu' })).not.toBeInTheDocument();
  });

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

  it('offers to mute a remote participant locally from the right-click menu', async () => {
    const user = userEvent.setup();
    render(
      <OffCameraRoster
        participants={[participant({ identity: 'bob', name: 'Bob' })]}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    fireEvent.contextMenu(screen.getAllByRole('button', { name: 'Bob' })[0]);
    await user.click(await screen.findByText('Silenciar'));

    expect(voiceClient.setParticipantVolume).toHaveBeenCalledWith('bob', 0);
  });

  it('does not offer to mute the local participant', () => {
    render(
      <OffCameraRoster
        participants={[participant({ identity: 'me', name: 'Eu', isLocal: true })]}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    fireEvent.contextMenu(screen.getAllByRole('button', { name: 'Eu' })[0]);

    expect(screen.queryByText('Silenciar')).not.toBeInTheDocument();
  });

  it('makes a remote participant name a profile card trigger', () => {
    render(
      <OffCameraRoster
        participants={[participant({ identity: 'bob', name: 'Bob' })]}
        avatarUrlByUserId={new Map()}
        deafenedByUserId={new Map()}
      />,
    );

    // One trigger on the avatar (Avatar's own fallback aria-label), one on the name text.
    expect(screen.getAllByRole('button', { name: 'Bob' })).toHaveLength(2);
  });
});
