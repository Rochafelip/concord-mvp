import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as dmCallApi from '../calls/dm/api';
import { useDmCallStore } from '../calls/dm/dmCallStore';
import * as friendsHooks from '../friends/hooks';
import * as dmHooks from './hooks';
import { DmConversationView } from './DmConversationView';

vi.mock('../friends/hooks', () => ({
  useFriends: vi.fn(),
}));

vi.mock('../calls/dm/api', () => ({
  inviteCall: vi.fn(),
}));

vi.mock('./hooks', () => ({
  useOpenDmConversation: vi.fn(),
}));

vi.mock('../calls/dm/DmCallView', () => ({
  DmCallView: () => <div data-testid="dm-call-view" />,
}));

vi.mock('./DmMessageList', () => ({
  DmMessageList: () => <div data-testid="dm-message-list" />,
}));

vi.mock('./DmMessageInput', () => ({
  DmMessageInput: () => <div data-testid="dm-message-input" />,
}));

const friend = {
  friendshipId: 'f1',
  user: { id: 'u2', username: 'bob', displayName: 'Bob', avatarUrl: null },
  online: true,
  since: '2026-01-01',
};

function renderView() {
  return render(
    <MemoryRouter initialEntries={['/app/dm/u2']}>
      <Routes>
        <Route path="/app/dm/:friendUserId" element={<DmConversationView />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DmConversationView', () => {
  beforeEach(() => {
    vi.mocked(dmCallApi.inviteCall).mockClear();
    useDmCallStore.setState({ status: 'idle', callId: null, role: null, peer: null });
    vi.mocked(friendsHooks.useFriends).mockReturnValue({ data: [friend], isLoading: false } as never);
    vi.mocked(dmHooks.useOpenDmConversation).mockReturnValue({ mutate: vi.fn() } as never);
  });

  it('shows an enabled Ligar button for an online friend', () => {
    renderView();

    expect(screen.getByRole('button', { name: 'Ligar' })).toBeEnabled();
  });

  it('disables the Ligar button when the friend is offline', () => {
    vi.mocked(friendsHooks.useFriends).mockReturnValue({
      data: [{ ...friend, online: false }],
      isLoading: false,
    } as never);

    renderView();

    expect(screen.getByRole('button', { name: 'Ligar' })).toBeDisabled();
  });

  it('clicking Ligar invites the call and starts ringing-out', async () => {
    vi.mocked(dmCallApi.inviteCall).mockResolvedValue({ callId: 'call-1' });
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole('button', { name: 'Ligar' }));

    expect(dmCallApi.inviteCall).toHaveBeenCalledWith('u2');
    await waitFor(() => {
      expect(useDmCallStore.getState().status).toBe('ringing-out');
    });
    expect(useDmCallStore.getState().callId).toBe('call-1');
  });

  it('renders DmCallView instead of the message list once connected to this friend', () => {
    useDmCallStore.setState({
      status: 'connected',
      callId: 'call-1',
      role: 'caller',
      peer: { id: 'u2', displayName: 'Bob', avatarUrl: null },
    });

    renderView();

    expect(screen.getByTestId('dm-call-view')).toBeInTheDocument();
    expect(screen.queryByTestId('dm-message-list')).not.toBeInTheDocument();
  });

  it('does not render DmCallView when connected to a different friend', () => {
    useDmCallStore.setState({
      status: 'connected',
      callId: 'call-1',
      role: 'caller',
      peer: { id: 'someone-else', displayName: 'Carol', avatarUrl: null },
    });

    renderView();

    expect(screen.queryByTestId('dm-call-view')).not.toBeInTheDocument();
    expect(screen.getByTestId('dm-message-list')).toBeInTheDocument();
  });

  it('opens the conversation on mount', () => {
    const mutate = vi.fn();
    vi.mocked(dmHooks.useOpenDmConversation).mockReturnValue({ mutate } as never);

    renderView();

    expect(mutate).toHaveBeenCalledWith('u2');
  });
});
