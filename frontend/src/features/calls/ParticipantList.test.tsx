import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionQuality } from 'livekit-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { voiceClient } from '../../services/voiceClient';
import { useVoiceStore } from '../../stores/voiceStore';
import type { VoiceParticipant } from '../../types/voice';
import * as callsApi from './api';
import { ParticipantList } from './ParticipantList';

// The volume setters/getters are backed by a real Map rather than bare spies: the bug this
// pins is precisely that the UI drops a level on remount, which is only visible if the stand-in
// for voiceClient remembers what it was told, the way the real one does.
const rememberedVolumes = new Map<string, number>();
vi.mock('../../services/voiceClient', () => ({
  voiceClient: {
    toggleMute: vi.fn(),
    toggleCamera: vi.fn(),
    toggleScreenShare: vi.fn(),
    setParticipantVolume: vi.fn(),
    getParticipantVolume: vi.fn(),
    setScreenShareVolume: vi.fn(),
    getScreenShareVolume: vi.fn().mockReturnValue(undefined),
    disconnect: vi.fn(),
  },
}));
vi.mock('./api');

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

function renderList(props: Partial<Parameters<typeof ParticipantList>[0]> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ParticipantList serverId="s1" {...props} />
    </QueryClientProvider>,
  );
}

describe('ParticipantList', () => {
  beforeEach(() => {
    useVoiceStore.setState({ status: 'connected', channelId: 'c1', participants: [], error: null });
    vi.mocked(callsApi.getVoicePresence).mockResolvedValue([]);
    rememberedVolumes.clear();
    // mockImplementation alone leaves call history from earlier tests in place, and one of these
    // tests asserts on the exact set of calls.
    vi.mocked(voiceClient.setParticipantVolume).mockReset();
    vi.mocked(voiceClient.getParticipantVolume).mockReset();
    vi.mocked(voiceClient.setParticipantVolume).mockImplementation((identity, volume) => {
      rememberedVolumes.set(identity, volume);
    });
    vi.mocked(voiceClient.getParticipantVolume).mockImplementation(
      (identity) => rememberedVolumes.get(identity) ?? 1,
    );
  });

  it('shows a connecting placeholder before the first participant sync', () => {
    renderList();
    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });

  it('renders a tile for the local participant alone when no one else has joined yet (self-view)', () => {
    useVoiceStore.setState({
      participants: [participant({ identity: 'me', name: 'Felipe', isLocal: true })],
    });
    renderList();

    expect(screen.getByText(/Felipe/)).toBeInTheDocument();
  });

  it('renders one tile per participant, including the local participant', () => {
    useVoiceStore.setState({
      participants: [
        participant({ identity: 'u1', name: 'Felipe', isLocal: true, micEnabled: true }),
        participant({ identity: 'u2', name: 'João', isLocal: false, micEnabled: false }),
      ],
    });
    renderList();

    const felipeTile = screen.getByText(/Felipe/).closest('div');
    const joaoTile = screen.getByText(/João/).closest('div');
    expect(felipeTile?.querySelector('[data-testid="mic-status-on"]')).toBeInTheDocument();
    expect(joaoTile?.querySelector('[data-testid="mic-status-off"]')).toBeInTheDocument();
  });

  it('renders a ScreenShareTile for a participant actively sharing their screen', () => {
    const track = { attach: vi.fn(), detach: vi.fn() } as never;
    useVoiceStore.setState({
      participants: [
        participant({ identity: 'u1', name: 'Felipe', isLocal: true }),
        participant({
          identity: 'u2',
          name: 'João',
          isLocal: false,
          screenShareEnabled: true,
          screenShareTrack: track,
        }),
      ],
    });
    renderList();

    expect(screen.getByText(/João's screen/)).toBeInTheDocument();
  });

  it('does not render a screen share tile for anyone when no one is sharing', () => {
    useVoiceStore.setState({
      participants: [participant({ identity: 'u1', name: 'Felipe', isLocal: true })],
    });
    renderList();

    expect(screen.queryByText(/'s screen/)).not.toBeInTheDocument();
  });

  it('marks a tile deafened based on matching voice presence by identity', async () => {
    vi.mocked(callsApi.getVoicePresence).mockResolvedValue([
      { channelId: 'c1', userId: 'u2', displayName: 'João', avatarUrl: null, muted: true, cameraOn: false, screenSharing: false, speaking: false, deafened: true },
    ]);
    useVoiceStore.setState({
      participants: [
        participant({ identity: 'u1', name: 'Felipe', isLocal: true }),
        participant({ identity: 'u2', name: 'João', isLocal: false, micEnabled: false }),
      ],
    });
    renderList();

    await waitFor(() => {
      const joaoTile = screen.getByText(/João/).closest('div');
      expect(joaoTile?.querySelector('[data-testid="deaf-status-on"]')).toBeInTheDocument();
    });
    const felipeTile = screen.getByText(/Felipe/).closest('div');
    expect(felipeTile?.querySelector('[data-testid="deaf-status-on"]')).not.toBeInTheDocument();
  });

  it('passes the matching avatarUrl from voice presence down to a tile, by identity', async () => {
    vi.mocked(callsApi.getVoicePresence).mockResolvedValue([
      {
        channelId: 'c1',
        userId: 'u2',
        displayName: 'João',
        avatarUrl: 'https://example.test/joao.png',
        muted: false,
        cameraOn: false,
        screenSharing: false,
        speaking: false,
        deafened: false,
      },
    ]);
    useVoiceStore.setState({
      participants: [
        participant({ identity: 'u1', name: 'Felipe', isLocal: true }),
        participant({ identity: 'u2', name: 'João', isLocal: false }),
      ],
    });
    renderList();

    expect(await screen.findByRole('img', { name: 'João' })).toHaveAttribute('src', 'https://example.test/joao.png');
    expect(screen.queryByRole('img', { name: 'Felipe' })).not.toBeInTheDocument();
  });

  describe('unified participant grid', () => {
    it('renders a camera-on participant inside the participant grid', () => {
      useVoiceStore.setState({
        participants: [participant({ identity: 'u1', name: 'Felipe', isLocal: true, cameraEnabled: true })],
      });
      renderList();

      expect(screen.getByTestId('participant-grid')).toContainElement(screen.getByText(/Felipe/));
    });

    it('renders a camera-off, non-sharing participant inside the same participant grid, not a separate roster', () => {
      useVoiceStore.setState({
        participants: [participant({ identity: 'u1', name: 'Felipe', isLocal: true, cameraEnabled: false })],
      });
      renderList();

      expect(screen.getByTestId('participant-grid')).toContainElement(screen.getByText(/Felipe/));
      expect(screen.queryByTestId('off-camera-roster')).not.toBeInTheDocument();
    });

    it('renders both a camera-on and a camera-off participant in the same grid when the call has a mix', () => {
      useVoiceStore.setState({
        participants: [
          participant({ identity: 'u1', name: 'Felipe', isLocal: true, cameraEnabled: true }),
          participant({ identity: 'u2', name: 'João', isLocal: false, cameraEnabled: false }),
        ],
      });
      renderList();

      const grid = screen.getByTestId('participant-grid');
      expect(grid).toContainElement(screen.getByText(/Felipe/));
      expect(grid).toContainElement(screen.getByText(/João/));
    });
  });

  describe('watch mode', () => {
    it('auto-watches a lone active screen share with no click required', () => {
      const track = { attach: vi.fn(), detach: vi.fn() } as never;
      useVoiceStore.setState({
        participants: [
          participant({ identity: 'u1', name: 'Felipe', isLocal: true, cameraEnabled: true }),
          participant({ identity: 'u2', name: 'João', isLocal: false, screenShareTrack: track }),
        ],
      });
      renderList();

      expect(screen.getByText(/João's screen/)).toBeInTheDocument();
    });

    it('auto-watches only the first sharing participant by array order when several are sharing, listing the other as a thumbnail', () => {
      const track = { attach: vi.fn(), detach: vi.fn() } as never;
      useVoiceStore.setState({
        participants: [
          participant({ identity: 'u1', name: 'Felipe', isLocal: true, screenShareTrack: track }),
          participant({ identity: 'u2', name: 'João', isLocal: false, screenShareTrack: track }),
        ],
      });
      renderList();

      expect(screen.getByTestId('focusable-strip')).toContainElement(
        screen.getByRole('button', { name: "Focus on João's screen" }),
      );
    });

    it('clicking a second thumbnail watches it alongside the first, instead of replacing it', async () => {
      const user = userEvent.setup();
      const track = { attach: vi.fn(), detach: vi.fn() } as never;
      useVoiceStore.setState({
        participants: [
          participant({ identity: 'u1', name: 'Felipe', isLocal: true, screenShareTrack: track }),
          participant({ identity: 'u2', name: 'João', isLocal: false, screenShareTrack: track }),
        ],
      });
      renderList();

      await user.click(screen.getByRole('button', { name: "Focus on João's screen" }));

      expect(screen.getByText(/Felipe's screen/)).toBeInTheDocument();
      expect(screen.getByText(/João's screen/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Show all participants' })).toBeInTheDocument();
    });

    it('lets a manual camera pin persist when a screen share starts, overriding the auto-focused share', async () => {
      const user = userEvent.setup();
      useVoiceStore.setState({
        participants: [
          participant({ identity: 'u1', name: 'Felipe', isLocal: true, cameraEnabled: true }),
          participant({ identity: 'u2', name: 'João', isLocal: false, cameraEnabled: true }),
        ],
      });
      renderList();

      await user.click(screen.getByRole('button', { name: "Focus on João's camera" }));

      const track = { attach: vi.fn(), detach: vi.fn() } as never;
      useVoiceStore.setState({
        participants: [
          participant({ identity: 'u1', name: 'Felipe', isLocal: true, cameraEnabled: true, screenShareTrack: track }),
          participant({ identity: 'u2', name: 'João', isLocal: false, cameraEnabled: true }),
        ],
      });

      expect(screen.getByRole('button', { name: 'Show all participants' })).toBeInTheDocument();
    });

    it('clicking "Show all participants" drops to the plain grid, not back to the auto-watched share', async () => {
      const user = userEvent.setup();
      const track = { attach: vi.fn(), detach: vi.fn() } as never;
      useVoiceStore.setState({
        participants: [
          participant({ identity: 'u1', name: 'Felipe', isLocal: true, cameraEnabled: true }),
          participant({ identity: 'u2', name: 'João', isLocal: false, screenShareTrack: track }),
        ],
      });
      renderList();

      await user.click(screen.getByRole('button', { name: "Focus on Felipe's camera" }));
      expect(screen.getByRole('button', { name: 'Show all participants' })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Show all participants' }));

      // Resetting to null here (the true "untouched" default) would re-select João's still-active
      // share and land right back in the focused view — indistinguishable from the button doing
      // nothing. It must land on the plain grid instead, same as clearing the last watched share
      // directly does.
      expect(screen.queryByRole('button', { name: 'Show all participants' })).not.toBeInTheDocument();
      expect(screen.getByTestId('participant-grid')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: "Focus on João's screen" })).toBeInTheDocument();
    });

    it('reverts to the plain grid when a manual watch is cleared and nobody is sharing', async () => {
      const user = userEvent.setup();
      useVoiceStore.setState({
        participants: [
          participant({ identity: 'u1', name: 'Felipe', isLocal: true, cameraEnabled: true }),
          participant({ identity: 'u2', name: 'João', isLocal: false, cameraEnabled: true }),
        ],
      });
      renderList();

      await user.click(screen.getByRole('button', { name: "Focus on João's camera" }));
      await user.click(screen.getByRole('button', { name: 'Show all participants' }));

      expect(screen.getByTestId('participant-grid')).toBeInTheDocument();
      expect(screen.queryByTestId('focusable-strip')).not.toBeInTheDocument();
    });

    it('clicking a watched tile removes just that one, keeping the rest of a multi-watch set', async () => {
      const user = userEvent.setup();
      const track = { attach: vi.fn(), detach: vi.fn() } as never;
      useVoiceStore.setState({
        participants: [
          participant({ identity: 'u1', name: 'Felipe', isLocal: false, screenShareTrack: track }),
          participant({ identity: 'u2', name: 'João', isLocal: false, screenShareTrack: track }),
        ],
      });
      renderList();
      await user.click(screen.getByRole('button', { name: "Focus on João's screen" }));
      expect(screen.getByText(/Felipe's screen/)).toBeInTheDocument();
      expect(screen.getByText(/João's screen/)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: "Stop watching Felipe's screen" }));

      expect(screen.queryByRole('button', { name: "Stop watching Felipe's screen" })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: "Focus on Felipe's screen" })).toBeInTheDocument();
      expect(screen.getByText(/João's screen/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Show all participants' })).toBeInTheDocument();
    });

    // The reported dead end: removing the only watched share drops the whole view back to the
    // plain grid, which lists participants but never their shares — leaving the share the user
    // just stopped watching with no way back, since useWatchTargets deliberately keeps a cleared
    // set cleared. Rejoining the channel was the only escape (it remounts the hook).
    it('keeps an active share reachable from the plain grid after the last watch is cleared', async () => {
      const user = userEvent.setup();
      const track = { attach: vi.fn(), detach: vi.fn() } as never;
      useVoiceStore.setState({
        participants: [
          participant({ identity: 'u1', name: 'Felipe', isLocal: true, cameraEnabled: true }),
          participant({ identity: 'u2', name: 'João', isLocal: false, screenShareTrack: track }),
        ],
      });
      renderList();

      await user.click(screen.getByRole('button', { name: "Stop watching João's screen" }));
      expect(screen.getByTestId('participant-grid')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: "Focus on João's screen" }));

      expect(screen.getByText(/João's screen/)).toBeInTheDocument();
    });

    // 502de0e hoisted the whole strip out of FocusedCallView and had to be reverted: in grid mode
    // every camera-on participant already is its own "Focus on X's camera" button, so listing
    // cameras again produced two buttons sharing one accessible name. Only shares belong here.
    it('does not list cameras twice while the plain grid is showing', async () => {
      const user = userEvent.setup();
      const track = { attach: vi.fn(), detach: vi.fn() } as never;
      useVoiceStore.setState({
        participants: [
          participant({ identity: 'u1', name: 'Felipe', isLocal: false, cameraEnabled: true }),
          participant({ identity: 'u2', name: 'João', isLocal: false, screenShareTrack: track }),
        ],
      });
      renderList();

      await user.click(screen.getByRole('button', { name: "Stop watching João's screen" }));

      expect(screen.getAllByRole('button', { name: "Focus on Felipe's camera" })).toHaveLength(1);
    });
  });

  // The reported bug, end to end: lower someone's volume in the grid, then have a screen share
  // start (which swaps the grid for FocusedCallView and remounts every tile below it) and the
  // level must still be both in effect and visible. It used to come back showing 100% — or, for
  // a mic-only participant pushed into the off-camera roster, not come back at all.
  describe('a volume set before a screen share starts', () => {
    const sharer = () => participant({
      identity: 'carol',
      name: 'Carol',
      screenShareEnabled: true,
      screenShareTrack: { attach: vi.fn(), detach: vi.fn() } as never,
    });

    it('stays visible and set for a mic-only participant, who moves to the off-camera roster', () => {
      useVoiceStore.setState({
        participants: [
          participant({ identity: 'me', name: 'Eu', isLocal: true }),
          participant({ identity: 'bob', name: 'Bob' }),
        ],
      });
      renderList();

      fireEvent.click(screen.getByRole('button', { name: 'Volume for Bob' }));
      fireEvent.change(screen.getByRole('slider', { name: 'Volume for Bob' }), { target: { value: '30' } });
      expect(voiceClient.setParticipantVolume).toHaveBeenCalledWith('bob', 0.3);

      act(() => {
        useVoiceStore.setState({
          participants: [
            participant({ identity: 'me', name: 'Eu', isLocal: true }),
            participant({ identity: 'bob', name: 'Bob' }),
            sharer(),
          ],
        });
      });

      expect(screen.getByTestId('watched-area')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Volume for Bob' }));
      expect(screen.getByRole('slider', { name: 'Volume for Bob' })).toHaveValue('30');
    });

    it('survives the share ending and the call returning to the grid', () => {
      useVoiceStore.setState({
        participants: [
          participant({ identity: 'me', name: 'Eu', isLocal: true }),
          participant({ identity: 'bob', name: 'Bob' }),
        ],
      });
      renderList();

      fireEvent.click(screen.getByRole('button', { name: 'Volume for Bob' }));
      fireEvent.change(screen.getByRole('slider', { name: 'Volume for Bob' }), { target: { value: '30' } });
      act(() => {
        useVoiceStore.setState({
          participants: [
            participant({ identity: 'me', name: 'Eu', isLocal: true }),
            participant({ identity: 'bob', name: 'Bob' }),
            sharer(),
          ],
        });
      });
      act(() => {
        useVoiceStore.setState({
          participants: [
            participant({ identity: 'me', name: 'Eu', isLocal: true }),
            participant({ identity: 'bob', name: 'Bob' }),
          ],
        });
      });

      fireEvent.click(screen.getByRole('button', { name: 'Volume for Bob' }));
      expect(screen.getByRole('slider', { name: 'Volume for Bob' })).toHaveValue('30');
      // Nothing re-sent a level on the way through: the audio was never actually reset.
      expect(vi.mocked(voiceClient.setParticipantVolume).mock.calls).toEqual([['bob', 0.3]]);
    });

    it('stays visible and set for a camera-on participant, who moves to the focusable strip', () => {
      const bobWithCamera = participant({
        identity: 'bob',
        name: 'Bob',
        cameraEnabled: true,
        videoTrack: { attach: vi.fn(), detach: vi.fn() } as never,
      });
      useVoiceStore.setState({
        participants: [participant({ identity: 'me', name: 'Eu', isLocal: true }), bobWithCamera],
      });
      renderList();

      fireEvent.click(screen.getByRole('button', { name: 'Volume for Bob' }));
      fireEvent.change(screen.getByRole('slider', { name: 'Volume for Bob' }), { target: { value: '30' } });

      act(() => {
        useVoiceStore.setState({
          participants: [participant({ identity: 'me', name: 'Eu', isLocal: true }), bobWithCamera, sharer()],
        });
      });

      // The strip suppresses the inline control (a range input cannot nest in its button), so
      // Bob is reached by focusing his camera — the level is what must survive, not the widget.
      fireEvent.click(screen.getByRole('button', { name: "Focus on Bob's camera" }));

      fireEvent.click(screen.getByRole('button', { name: 'Volume for Bob' }));
      expect(screen.getByRole('slider', { name: 'Volume for Bob' })).toHaveValue('30');
    });
  });
});
