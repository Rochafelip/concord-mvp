import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

const server: Server = {
  id: 's1',
  name: 'Alpha',
  ownerId: 'owner-1',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

const channels: Channel[] = [
  { id: 'c1', serverId: 's1', name: 'general', type: 'TEXT', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  { id: 'c2', serverId: 's1', name: 'lobby', type: 'VOICE', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
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
      token: 't',
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
      token: 't',
      user: { id: 'owner-1', username: 'o', displayName: 'O', email: 'o@x.com', avatarUrl: null },
    });
    renderSidebar();

    await screen.findByText('Alpha');
    expect(screen.getByRole('button', { name: 'Create channel' })).toBeInTheDocument();
  });

  it('hides the Create Channel affordance for a non-owner member', async () => {
    useAuthStore.setState({
      token: 't',
      user: { id: 'member-1', username: 'm', displayName: 'M', email: 'm@x.com', avatarUrl: null },
    });
    renderSidebar();

    await screen.findByText('Alpha');
    expect(screen.queryByRole('button', { name: 'Create channel' })).not.toBeInTheDocument();
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
        ...overrides,
      };
    }

    beforeEach(() => {
      useAuthStore.setState({
        token: 't',
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

    it('only lists a participant under the voice channel they are actually in', async () => {
      vi.mocked(callsApi.getVoicePresence).mockResolvedValue([presence({ channelId: 'some-other-channel' })]);
      renderSidebar();

      await screen.findByRole('link', { name: /lobby/ });
      expect(screen.queryByText('Ana')).not.toBeInTheDocument();
    });
  });
});
