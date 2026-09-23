import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContextMenu } from '../../components/ContextMenu';
import { useVoiceStore } from '../../stores/voiceStore';
import type { Channel } from '../../types/channel';
import type { Server } from '../../types/server';
import type { VoicePresenceEntry } from '../../types/voice';
import { useAuthStore } from '../auth/authStore';
import * as callsApi from '../calls/api';
import * as serversApi from '../servers/api';
import * as api from './api';
import { ChannelSidebar } from './ChannelSidebar';

vi.mock('./api');
vi.mock('../servers/api');
vi.mock('../calls/api');
// Isolates ChannelSidebar's hover-gating logic (who/when a preview is offered) from the preview
// popover's own LiveKit connection — that behavior belongs to ScreenShareHoverPreview.test.tsx.
vi.mock('../calls/ScreenShareHoverPreview', () => ({
  ScreenShareHoverPreview: ({ displayName }: { displayName: string }) => (
    <div role="tooltip" aria-label={`${displayName}'s screen`} />
  ),
}));
// UserProfileCard needs a `../friends/api` mock this file doesn't set up, and its friend-action
// right-click item is covered by UserProfileCard.test.tsx — this stub keeps only the
// `contextMenuExtraItems` contract ChannelSidebar relies on for "Disconnect from voice".
vi.mock('../users/UserProfileCard', () => ({
  UserProfileCard: ({
    children,
    contextMenuExtraItems = [],
  }: {
    children: React.ReactNode;
    contextMenuExtraItems?: import('../../components/ContextMenu').ContextMenuItem[];
  }) => <ContextMenu items={contextMenuExtraItems}>{children}</ContextMenu>,
}));

const server: Server = {
  id: 's1',
  name: 'Alpha',
  ownerId: 'owner-1',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  // The sidebar's create/delete controls now hang off MANAGE_CHANNELS rather than ownership,
  // the voice context menu off DISCONNECT_MEMBERS, and the invite button off MANAGE_INVITES.
  permissions: ['MANAGE_CHANNELS', 'DISCONNECT_MEMBERS', 'VIEW_CHANNEL', 'MANAGE_INVITES'],
};

const channels: Channel[] = [
  { id: 'c1', serverId: 's1', name: 'general', type: 'TEXT', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  { id: 'c2', serverId: 's1', name: 'lobby', type: 'VOICE', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  { id: 'c3', serverId: 's1', name: 'onboarding', type: 'ONBOARDING', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
];

function renderSidebar(initialPath = '/app/servers/s1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/app/servers/:serverId" element={<ChannelSidebar />} />
          <Route path="/app/servers/:serverId/channels/:channelId" element={<ChannelSidebar />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ChannelSidebar', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(api.listChannels).mockResolvedValue(channels);
    vi.mocked(serversApi.getServer).mockResolvedValue(server);
    vi.mocked(serversApi.getServerMembers).mockResolvedValue([]);
    vi.mocked(serversApi.getInvite).mockResolvedValue({ code: 'ABC' });
    vi.mocked(callsApi.getVoicePresence).mockResolvedValue([]);
  });

  it('lists channels grouped into Text/Voice sections', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'member-1', username: 'm', displayName: 'M', email: 'm@x.com', avatarUrl: null },
    });
    renderSidebar();

    expect(screen.getByText('Text channels')).toBeInTheDocument();
    expect(screen.getByText('Voice channels')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /general/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /lobby/ })).toBeInTheDocument();
  });

  it('shows the Create Channel affordance for the server owner', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'owner-1', username: 'o', displayName: 'O', email: 'o@x.com', avatarUrl: null },
    });
    renderSidebar();

    await screen.findByText('Alpha');
    expect(screen.getByRole('button', { name: 'Create text channel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create voice channel' })).toBeInTheDocument();
  });

  it('renders an Onboarding section above Text channels, with no create-channel button of its own', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'owner-1', username: 'o', displayName: 'O', email: 'o@x.com', avatarUrl: null },
    });
    renderSidebar();

    await screen.findByText('Alpha');
    expect(screen.getByRole('link', { name: /onboarding/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Create (text|voice) channel/ })).toHaveLength(2);

    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings.indexOf('Onboarding')).toBeGreaterThanOrEqual(0);
    expect(headings.indexOf('Onboarding')).toBeLessThan(headings.indexOf('Text channels'));
  });

  it('hides the Create Channel affordance from a member without MANAGE_CHANNELS', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'member-1', username: 'm', displayName: 'M', email: 'm@x.com', avatarUrl: null },
    });
    vi.mocked(serversApi.getServer).mockResolvedValue({ ...server, permissions: ['VIEW_CHANNEL'] });
    renderSidebar();

    await screen.findByText('Alpha');
    expect(screen.queryByRole('button', { name: 'Create text channel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create voice channel' })).not.toBeInTheDocument();
  });

  it('opens a type-specific create form without showing a type selector', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'owner-1', username: 'o', displayName: 'O', email: 'o@x.com', avatarUrl: null },
    });
    const user = userEvent.setup();
    renderSidebar();

    await screen.findByText('Alpha');
    await user.click(screen.getByRole('button', { name: 'Create voice channel' }));

    expect(screen.getByRole('heading', { name: 'Create a voice channel' })).toBeInTheDocument();
    expect(screen.queryByText('Type')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('shows a delete icon for the owner on text and voice channels but not onboarding', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'owner-1', username: 'o', displayName: 'O', email: 'o@x.com', avatarUrl: null },
    });
    renderSidebar();

    await screen.findByText('Alpha');
    expect(screen.getByRole('button', { name: 'Delete text channel general' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete voice channel lobby' })).toBeInTheDocument();
  });

  it('hides the delete icon from a member without MANAGE_CHANNELS', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'member-1', username: 'm', displayName: 'M', email: 'm@x.com', avatarUrl: null },
    });
    vi.mocked(serversApi.getServer).mockResolvedValue({ ...server, permissions: ['VIEW_CHANNEL'] });
    renderSidebar();

    await screen.findByText('Alpha');
    expect(screen.queryByRole('button', { name: /Delete (text|voice) channel/ })).not.toBeInTheDocument();
  });

  it('opens the invite people modal for a member with MANAGE_INVITES', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'owner-1', username: 'o', displayName: 'O', email: 'o@x.com', avatarUrl: null },
    });
    const user = userEvent.setup();
    renderSidebar();

    await screen.findByText('Alpha');
    await user.click(screen.getByRole('button', { name: 'Invite people' }));

    expect(await screen.findByRole('heading', { name: 'Invite people' })).toBeInTheDocument();
  });

  it('hides the invite people button from a member without MANAGE_INVITES', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'member-1', username: 'm', displayName: 'M', email: 'm@x.com', avatarUrl: null },
    });
    vi.mocked(serversApi.getServer).mockResolvedValue({ ...server, permissions: ['VIEW_CHANNEL'] });
    renderSidebar();

    await screen.findByText('Alpha');
    expect(screen.queryByRole('button', { name: 'Invite people' })).not.toBeInTheDocument();
  });

  it('deletes the channel only after the confirmation dialog is accepted', async () => {
    vi.mocked(api.deleteChannel).mockResolvedValue(undefined);
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'owner-1', username: 'o', displayName: 'O', email: 'o@x.com', avatarUrl: null },
    });
    const user = userEvent.setup();
    renderSidebar();

    await screen.findByText('Alpha');
    await user.click(screen.getByRole('button', { name: 'Delete text channel general' }));

    expect(screen.getByText('Delete "general"? This cannot be undone.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(api.deleteChannel).not.toHaveBeenCalled();
    expect(screen.queryByText('Delete "general"? This cannot be undone.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete text channel general' }));
    await user.click(screen.getByRole('button', { name: 'Delete channel' }));

    expect(api.deleteChannel).toHaveBeenCalledWith('c1');
  });

  it('confirms the deletion of a voice channel by name too', async () => {
    vi.mocked(api.deleteChannel).mockResolvedValue(undefined);
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'owner-1', username: 'o', displayName: 'O', email: 'o@x.com', avatarUrl: null },
    });
    const user = userEvent.setup();
    renderSidebar();

    await screen.findByText('Alpha');
    await user.click(screen.getByRole('button', { name: 'Delete voice channel lobby' }));
    await user.click(screen.getByRole('button', { name: 'Delete channel' }));

    expect(api.deleteChannel).toHaveBeenCalledWith('c2');
  });

  describe('voice channel participant preview', () => {
    function presence(overrides: Partial<VoicePresenceEntry> = {}): VoicePresenceEntry {
      return {
        channelId: 'c2',
        userId: 'u2',
        displayName: 'Ana',
        avatarUrl: null,
        muted: false,
        cameraOn: false,
        screenSharing: false,
        speaking: false,
        deafened: false,
        ...overrides,
      };
    }

    beforeEach(() => {
      useAuthStore.setState({
        isAuthenticated: true,
        user: { id: 'member-1', username: 'm', displayName: 'M', email: 'm@x.com', avatarUrl: null },
      });
    });

    it('shows nothing under a voice channel with no one in it', async () => {
      renderSidebar();

      await screen.findByRole('link', { name: /lobby/ });
      expect(screen.queryByText('Ana')).not.toBeInTheDocument();
    });

    it('shows a row with the display name for each participant in that voice channel', async () => {
      vi.mocked(callsApi.getVoicePresence).mockResolvedValue([presence()]);
      renderSidebar();

      expect(await screen.findByText('Ana')).toBeInTheDocument();
    });

    it('shows no status icons for a participant with every flag false', async () => {
      vi.mocked(callsApi.getVoicePresence).mockResolvedValue([presence()]);
      renderSidebar();

      await screen.findByText('Ana');
      expect(screen.queryByLabelText('Muted')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Camera on')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Sharing screen')).not.toBeInTheDocument();
    });

    it('shows the muted, camera, and screen-share icons matching that participant\'s state', async () => {
      vi.mocked(callsApi.getVoicePresence).mockResolvedValue([
        presence({ muted: true, cameraOn: true, screenSharing: true }),
      ]);
      renderSidebar();

      await screen.findByText('Ana');
      expect(screen.getByLabelText('Muted')).toBeInTheDocument();
      expect(screen.getByLabelText('Camera on')).toBeInTheDocument();
      expect(screen.getByLabelText('Sharing screen')).toBeInTheDocument();
    });

    it('shows a distinct deafened icon instead of the muted icon when the participant is deafened', async () => {
      vi.mocked(callsApi.getVoicePresence).mockResolvedValue([presence({ muted: true, deafened: true })]);
      renderSidebar();

      await screen.findByText('Ana');
      expect(screen.getByLabelText('Deafened')).toBeInTheDocument();
      expect(screen.queryByLabelText('Muted')).not.toBeInTheDocument();
    });

    it('shows the muted icon, not deafened, for a participant who is only muted', async () => {
      vi.mocked(callsApi.getVoicePresence).mockResolvedValue([presence({ muted: true, deafened: false })]);
      renderSidebar();

      await screen.findByText('Ana');
      expect(screen.getByLabelText('Muted')).toBeInTheDocument();
      expect(screen.queryByLabelText('Deafened')).not.toBeInTheDocument();
    });

    it('only lists a participant under the voice channel they are actually in', async () => {
      vi.mocked(callsApi.getVoicePresence).mockResolvedValue([presence({ channelId: 'some-other-channel' })]);
      renderSidebar();

      await screen.findByRole('link', { name: /lobby/ });
      expect(screen.queryByText('Ana')).not.toBeInTheDocument();
    });

    it('makes a voice participant avatar and name open a profile card for that participant', async () => {
      vi.mocked(callsApi.getVoicePresence).mockResolvedValue([presence()]);
      renderSidebar();

      expect(await screen.findByRole('button', { name: 'Ana' })).toBeInTheDocument();
    });
  });

  describe('voice channel participant context menu', () => {
    function presence(overrides: Partial<VoicePresenceEntry> = {}): VoicePresenceEntry {
      return {
        channelId: 'c2',
        userId: 'u2',
        displayName: 'Ana',
        avatarUrl: null,
        muted: false,
        cameraOn: false,
        screenSharing: false,
        speaking: false,
        deafened: false,
        ...overrides,
      };
    }

    it('disconnects the participant from voice when the menu item is clicked (has DISCONNECT_MEMBERS, not self)', async () => {
      useAuthStore.setState({
        isAuthenticated: true,
        user: { id: 'member-1', username: 'm', displayName: 'M', email: 'm@x.com', avatarUrl: null },
      });
      vi.mocked(callsApi.getVoicePresence).mockResolvedValue([presence()]);
      const user = userEvent.setup();
      renderSidebar();

      fireEvent.contextMenu(await screen.findByText('Ana'));
      await user.click(await screen.findByText('Disconnect from voice'));

      expect(callsApi.disconnectVoiceParticipant).toHaveBeenCalledWith('c2', 'u2');
    });

    it('does not offer to disconnect yourself', async () => {
      useAuthStore.setState({
        isAuthenticated: true,
        user: { id: 'u2', username: 'ana', displayName: 'Ana', email: 'ana@x.com', avatarUrl: null },
      });
      vi.mocked(callsApi.getVoicePresence).mockResolvedValue([presence()]);
      renderSidebar();

      fireEvent.contextMenu(await screen.findByText('Ana'));

      expect(screen.queryByText('Disconnect from voice')).not.toBeInTheDocument();
    });

    it('does not offer to disconnect without the DISCONNECT_MEMBERS permission', async () => {
      vi.mocked(serversApi.getServer).mockResolvedValue({
        ...server,
        permissions: (server.permissions ?? []).filter((permission) => permission !== 'DISCONNECT_MEMBERS'),
      });
      useAuthStore.setState({
        isAuthenticated: true,
        user: { id: 'member-1', username: 'm', displayName: 'M', email: 'm@x.com', avatarUrl: null },
      });
      vi.mocked(callsApi.getVoicePresence).mockResolvedValue([presence()]);
      renderSidebar();

      fireEvent.contextMenu(await screen.findByText('Ana'));

      expect(screen.queryByText('Disconnect from voice')).not.toBeInTheDocument();
    });
  });

  describe('screen-share hover preview', () => {
    function presence(overrides: Partial<VoicePresenceEntry> = {}): VoicePresenceEntry {
      return {
        channelId: 'c2',
        userId: 'u2',
        displayName: 'Ana',
        avatarUrl: null,
        muted: false,
        cameraOn: false,
        screenSharing: true,
        speaking: false,
        deafened: false,
        ...overrides,
      };
    }

    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      useAuthStore.setState({
        isAuthenticated: true,
        user: { id: 'member-1', username: 'm', displayName: 'M', email: 'm@x.com', avatarUrl: null },
      });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('does not show a preview before the hover delay elapses', async () => {
      vi.mocked(callsApi.getVoicePresence).mockResolvedValue([presence()]);
      renderSidebar();
      const row = await screen.findByText('Ana');

      fireEvent.mouseEnter(row.closest('li')!);

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('shows the preview popover after hovering a screen-sharing participant', async () => {
      vi.mocked(callsApi.getVoicePresence).mockResolvedValue([presence()]);
      renderSidebar();
      const row = await screen.findByText('Ana');

      fireEvent.mouseEnter(row.closest('li')!);
      act(() => {
        vi.advanceTimersByTime(400);
      });

      expect(screen.getByRole('tooltip', { name: "Ana's screen" })).toBeInTheDocument();
    });

    it('cancels the pending preview if the mouse leaves before the delay elapses', async () => {
      vi.mocked(callsApi.getVoicePresence).mockResolvedValue([presence()]);
      renderSidebar();
      const row = (await screen.findByText('Ana')).closest('li')!;

      fireEvent.mouseEnter(row);
      fireEvent.mouseLeave(row);
      act(() => {
        vi.advanceTimersByTime(400);
      });

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('does not offer a preview for a participant who is not sharing their screen', async () => {
      vi.mocked(callsApi.getVoicePresence).mockResolvedValue([presence({ screenSharing: false })]);
      renderSidebar();
      const row = (await screen.findByText('Ana')).closest('li')!;

      fireEvent.mouseEnter(row);
      act(() => {
        vi.advanceTimersByTime(400);
      });

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('does not offer a preview for the viewer\'s own screen share', async () => {
      vi.mocked(callsApi.getVoicePresence).mockResolvedValue([presence({ userId: 'member-1', displayName: 'M' })]);
      renderSidebar();
      const row = (await screen.findByText('M')).closest('li')!;

      fireEvent.mouseEnter(row);
      act(() => {
        vi.advanceTimersByTime(400);
      });

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('does not offer a preview for a channel the viewer is already connected to', async () => {
      useVoiceStore.setState({ channelId: 'c2' });
      vi.mocked(callsApi.getVoicePresence).mockResolvedValue([presence()]);
      renderSidebar();
      const row = (await screen.findByText('Ana')).closest('li')!;

      fireEvent.mouseEnter(row);
      act(() => {
        vi.advanceTimersByTime(400);
      });

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      useVoiceStore.setState({ channelId: null });
    });
  });
});
