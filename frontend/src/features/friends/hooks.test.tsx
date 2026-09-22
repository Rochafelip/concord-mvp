import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from '../../services/toast';
import * as api from './api';
import {
  useAcceptFriendRequest,
  useCancelOrDeclineFriendRequest,
  useRemoveFriend,
  useSendFriendRequest,
} from './hooks';

vi.mock('./api');
vi.mock('../../services/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('friend mutation error feedback', () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
  });

  it('shows a toast when sending a friend request fails', async () => {
    vi.mocked(api.sendFriendRequest).mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() => useSendFriendRequest(), { wrapper });

    result.current.mutate('user-2');

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
  });

  it('shows a toast when accepting a friend request fails', async () => {
    vi.mocked(api.acceptFriendRequest).mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() => useAcceptFriendRequest(), { wrapper });

    result.current.mutate('friendship-1');

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
  });

  it('shows a toast when cancelling/declining a friend request fails', async () => {
    vi.mocked(api.cancelOrDeclineFriendRequest).mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() => useCancelOrDeclineFriendRequest(), { wrapper });

    result.current.mutate('friendship-1');

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
  });

  it('shows a toast when removing a friend fails', async () => {
    vi.mocked(api.removeFriend).mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() => useRemoveFriend(), { wrapper });

    result.current.mutate('friendship-1');

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
  });
});
