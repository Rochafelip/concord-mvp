import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Channel } from '../../types/channel';
import * as channelHooks from '../channels/hooks';
import { ChatWindow } from './ChatWindow';
import * as chatHooks from './hooks';

vi.mock('../channels/hooks');
vi.mock('./hooks', () => ({
  useMessageHistory: vi.fn(),
  sendMessage: vi.fn(),
}));

function channel(overrides: Partial<Channel> = {}): Channel {
  return {
    id: 'c1',
    serverId: 's1',
    name: 'onboarding',
    type: 'TEXT',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

function renderChatWindow() {
  return render(
    <MemoryRouter initialEntries={['/app/servers/s1/channels/c1']}>
      <Routes>
        <Route path="/app/servers/:serverId/channels/:channelId" element={<ChatWindow />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ChatWindow', () => {
  beforeEach(() => {
    vi.mocked(chatHooks.useMessageHistory).mockReturnValue({
      data: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isPending: false,
    } as unknown as ReturnType<typeof chatHooks.useMessageHistory>);
  });

  it('shows the message composer for a TEXT channel', async () => {
    vi.mocked(channelHooks.useChannel).mockReturnValue(
      { data: channel({ type: 'TEXT' }) } as unknown as ReturnType<typeof channelHooks.useChannel>,
    );
    renderChatWindow();

    expect(await screen.findByLabelText(/message/i)).toBeInTheDocument();
  });

  it('replaces the composer with a read-only notice for an ONBOARDING channel', async () => {
    vi.mocked(channelHooks.useChannel).mockReturnValue(
      { data: channel({ type: 'ONBOARDING' }) } as unknown as ReturnType<typeof channelHooks.useChannel>,
    );
    renderChatWindow();

    expect(await screen.findByText(/read-only/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/message/i)).not.toBeInTheDocument();
  });
});
