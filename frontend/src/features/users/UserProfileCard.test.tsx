import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../auth/authStore';
import * as friendsHooks from '../friends/hooks';
import { UserProfileCard } from './UserProfileCard';

vi.mock('../friends/hooks', () => ({
  useIsFriend: vi.fn(),
  useFriends: vi.fn(),
  usePendingFriendRequests: vi.fn(),
  useSendFriendRequest: vi.fn(),
  useAcceptFriendRequest: vi.fn(),
  useCancelOrDeclineFriendRequest: vi.fn(),
}));

function mutation(mutate = vi.fn()) {
  return { mutate, isPending: false };
}

function renderCard(userId = 'u2', displayName = 'Bob', onNavigate?: () => void) {
  return render(
    <MemoryRouter>
      <UserProfileCard user={{ id: userId, displayName, avatarUrl: null }} onNavigate={onNavigate}>
        <button type="button">{displayName}</button>
      </UserProfileCard>
    </MemoryRouter>,
  );
}

describe('UserProfileCard', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: 'me', username: 'me', displayName: 'Me', email: 'me@x.com', avatarUrl: null },
    });
    vi.mocked(friendsHooks.useIsFriend).mockReturnValue(false);
    vi.mocked(friendsHooks.useFriends).mockReturnValue({ data: [] } as never);
    vi.mocked(friendsHooks.usePendingFriendRequests).mockReturnValue({
      data: { incoming: [], outgoing: [] },
    } as never);
    vi.mocked(friendsHooks.useSendFriendRequest).mockReturnValue(mutation() as never);
    vi.mocked(friendsHooks.useAcceptFriendRequest).mockReturnValue(mutation() as never);
    vi.mocked(friendsHooks.useCancelOrDeclineFriendRequest).mockReturnValue(mutation() as never);
  });

  it('does not show popover content until the trigger is clicked', () => {
    renderCard();

    expect(screen.getByRole('button', { name: 'Bob' })).toBeInTheDocument();
    expect(screen.queryByText('Adicionar amigo')).not.toBeInTheDocument();
  });

  it('opens the popover with the friend action on click', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole('button', { name: 'Bob' }));

    expect(screen.getByRole('button', { name: /adicionar amigo/i })).toBeInTheDocument();
  });

  it('does not show a message link when not friends', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole('button', { name: 'Bob' }));

    expect(screen.queryByRole('link', { name: /enviar mensagem/i })).not.toBeInTheDocument();
  });

  it('shows a message link to the DM route when already friends', async () => {
    vi.mocked(friendsHooks.useIsFriend).mockReturnValue(true);
    const user = userEvent.setup();
    renderCard('u2', 'Bob');

    await user.click(screen.getByRole('button', { name: 'Bob' }));

    expect(screen.getByRole('link', { name: /enviar mensagem/i })).toHaveAttribute('href', '/app/dm/u2');
  });

  it('renders children unwrapped for the current user, with no popover trigger behavior', async () => {
    const user = userEvent.setup();
    renderCard('me', 'Me');

    await user.click(screen.getByRole('button', { name: 'Me' }));

    expect(screen.queryByText('Adicionar amigo')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /enviar mensagem/i })).not.toBeInTheDocument();
  });

  it('calls onNavigate when the message link is clicked, not merely when the popover opens', async () => {
    vi.mocked(friendsHooks.useIsFriend).mockReturnValue(true);
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    renderCard('u2', 'Bob', onNavigate);

    await user.click(screen.getByRole('button', { name: 'Bob' }));
    expect(onNavigate).not.toHaveBeenCalled();

    await user.click(screen.getByRole('link', { name: /enviar mensagem/i }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
