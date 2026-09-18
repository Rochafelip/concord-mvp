import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../auth/authStore';
import { AddFriendButton } from './AddFriendButton';
import * as hooksModule from './hooks';

vi.mock('./hooks', () => ({
  useFriends: vi.fn(),
  usePendingFriendRequests: vi.fn(),
  useSendFriendRequest: vi.fn(),
  useAcceptFriendRequest: vi.fn(),
  useCancelOrDeclineFriendRequest: vi.fn(),
}));

function mutation(mutate = vi.fn()) {
  return { mutate, isPending: false };
}

describe('AddFriendButton', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: 'me', username: 'me', displayName: 'Me', email: 'me@x.com', avatarUrl: null },
    });
    vi.mocked(hooksModule.useFriends).mockReturnValue({ data: [] } as never);
    vi.mocked(hooksModule.usePendingFriendRequests).mockReturnValue({
      data: { incoming: [], outgoing: [] },
    } as never);
    vi.mocked(hooksModule.useSendFriendRequest).mockReturnValue(mutation() as never);
    vi.mocked(hooksModule.useAcceptFriendRequest).mockReturnValue(mutation() as never);
    vi.mocked(hooksModule.useCancelOrDeclineFriendRequest).mockReturnValue(mutation() as never);
  });

  it('renders nothing for the current user themself', () => {
    render(<AddFriendButton userId="me" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows "Amigos" when already friends, with no action button', () => {
    vi.mocked(hooksModule.useFriends).mockReturnValue({
      data: [{ friendshipId: 'f1', user: { id: 'u2', username: 'b', displayName: 'B', avatarUrl: null }, online: false, since: '' }],
    } as never);

    render(<AddFriendButton userId="u2" />);

    expect(screen.getByText('Amigos')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers to accept an incoming request', async () => {
    const accept = vi.fn();
    vi.mocked(hooksModule.usePendingFriendRequests).mockReturnValue({
      data: { incoming: [{ friendshipId: 'f1', user: { id: 'u2', username: 'b', displayName: 'B', avatarUrl: null }, createdAt: '' }], outgoing: [] },
    } as never);
    vi.mocked(hooksModule.useAcceptFriendRequest).mockReturnValue(mutation(accept) as never);

    const user = userEvent.setup();
    render(<AddFriendButton userId="u2" />);
    await user.click(screen.getByRole('button', { name: /aceitar pedido/i }));

    expect(accept).toHaveBeenCalledWith('f1');
  });

  it('offers to cancel an outgoing request', async () => {
    const cancel = vi.fn();
    vi.mocked(hooksModule.usePendingFriendRequests).mockReturnValue({
      data: { incoming: [], outgoing: [{ friendshipId: 'f2', user: { id: 'u2', username: 'b', displayName: 'B', avatarUrl: null }, createdAt: '' }] },
    } as never);
    vi.mocked(hooksModule.useCancelOrDeclineFriendRequest).mockReturnValue(mutation(cancel) as never);

    const user = userEvent.setup();
    render(<AddFriendButton userId="u2" />);
    await user.click(screen.getByRole('button', { name: /cancelar pedido/i }));

    expect(cancel).toHaveBeenCalledWith('f2');
  });

  it('offers to send a friend request by default', async () => {
    const send = vi.fn();
    vi.mocked(hooksModule.useSendFriendRequest).mockReturnValue(mutation(send) as never);

    const user = userEvent.setup();
    render(<AddFriendButton userId="u2" />);
    await user.click(screen.getByRole('button', { name: /adicionar amigo/i }));

    expect(send).toHaveBeenCalledWith('u2');
  });
});
