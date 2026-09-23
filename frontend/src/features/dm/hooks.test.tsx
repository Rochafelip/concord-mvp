import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from './api';
import { useDmConversations, useOpenDmConversation } from './hooks';

vi.mock('./api');

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useDmConversations', () => {
  it('returns the visible conversation ids', async () => {
    vi.mocked(api.listConversations).mockResolvedValue(['u2', 'u3']);

    const { result } = renderHook(() => useDmConversations(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(['u2', 'u3']));
  });
});

describe('useOpenDmConversation', () => {
  beforeEach(() => {
    vi.mocked(api.openConversation).mockResolvedValue(undefined);
  });

  it('calls the open endpoint with the given user id', async () => {
    const { result } = renderHook(() => useOpenDmConversation(), { wrapper });

    result.current.mutate('u2');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.openConversation).toHaveBeenCalledWith('u2');
  });
});
