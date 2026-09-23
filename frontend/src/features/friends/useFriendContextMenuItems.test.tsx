import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDmCallStore } from '../calls/dm/dmCallStore';
import { startDmCall } from '../calls/dm/startDmCall';
import * as hooksModule from './hooks';
import { useFriendContextMenuItems } from './useFriendContextMenuItems';

const navigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

vi.mock('../calls/dm/startDmCall', () => ({ startDmCall: vi.fn() }));

vi.mock('./hooks', () => ({
  useFriends: vi.fn(),
  usePendingFriendRequests: vi.fn(),
  useSendFriendRequest: vi.fn(),
  useAcceptFriendRequest: vi.fn(),
  useCancelOrDeclineFriendRequest: vi.fn(),
  useRemoveFriend: vi.fn(),
}));

function mutation(mutate = vi.fn()) {
  return { mutate, isPending: false };
}

function friend(overrides: Partial<{ online: boolean }> = {}) {
  return {
    friendshipId: 'f1',
    user: { id: 'u2', username: 'b', displayName: 'B', avatarUrl: null },
    online: true,
    since: '',
    ...overrides,
  };
}

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useFriendContextMenuItems', () => {
  beforeEach(() => {
    navigate.mockClear();
    vi.mocked(startDmCall).mockClear();
    useDmCallStore.setState({ status: 'idle', callId: null, role: null, peer: null });
    vi.mocked(hooksModule.useFriends).mockReturnValue({ data: [] } as never);
    vi.mocked(hooksModule.usePendingFriendRequests).mockReturnValue({
      data: { incoming: [], outgoing: [] },
    } as never);
    vi.mocked(hooksModule.useSendFriendRequest).mockReturnValue(mutation() as never);
    vi.mocked(hooksModule.useAcceptFriendRequest).mockReturnValue(mutation() as never);
    vi.mocked(hooksModule.useCancelOrDeclineFriendRequest).mockReturnValue(mutation() as never);
    vi.mocked(hooksModule.useRemoveFriend).mockReturnValue(mutation() as never);
  });

  it('offers to send a friend request by default', () => {
    const send = vi.fn();
    vi.mocked(hooksModule.useSendFriendRequest).mockReturnValue(mutation(send) as never);

    const { result } = renderHook(() => useFriendContextMenuItems('u2'), { wrapper });

    expect(result.current).toHaveLength(1);
    expect(result.current[0].label).toBe('Adicionar amigo');
    result.current[0].onSelect();
    expect(send).toHaveBeenCalledWith('u2');
  });

  it('offers to accept an incoming request', () => {
    const accept = vi.fn();
    vi.mocked(hooksModule.usePendingFriendRequests).mockReturnValue({
      data: { incoming: [{ friendshipId: 'f1', user: { id: 'u2', username: 'b', displayName: 'B', avatarUrl: null }, createdAt: '' }], outgoing: [] },
    } as never);
    vi.mocked(hooksModule.useAcceptFriendRequest).mockReturnValue(mutation(accept) as never);

    const { result } = renderHook(() => useFriendContextMenuItems('u2'), { wrapper });

    expect(result.current[0].label).toBe('Aceitar pedido de amizade');
    result.current[0].onSelect();
    expect(accept).toHaveBeenCalledWith('f1');
  });

  it('offers to cancel an outgoing request', () => {
    const cancel = vi.fn();
    vi.mocked(hooksModule.usePendingFriendRequests).mockReturnValue({
      data: { incoming: [], outgoing: [{ friendshipId: 'f2', user: { id: 'u2', username: 'b', displayName: 'B', avatarUrl: null }, createdAt: '' }] },
    } as never);
    vi.mocked(hooksModule.useCancelOrDeclineFriendRequest).mockReturnValue(mutation(cancel) as never);

    const { result } = renderHook(() => useFriendContextMenuItems('u2'), { wrapper });

    expect(result.current[0].label).toBe('Cancelar pedido enviado');
    result.current[0].onSelect();
    expect(cancel).toHaveBeenCalledWith('f2');
  });

  it('offers to send a message and navigates to the DM route when already friends', () => {
    vi.mocked(hooksModule.useFriends).mockReturnValue({ data: [friend({ online: false })] } as never);

    const { result } = renderHook(() => useFriendContextMenuItems('u2'), { wrapper });

    expect(result.current[0].label).toBe('Enviar mensagem');
    result.current[0].onSelect();
    expect(navigate).toHaveBeenCalledWith('/app/dm/u2');
  });

  it('does not offer to start a call when the friend is offline', () => {
    vi.mocked(hooksModule.useFriends).mockReturnValue({ data: [friend({ online: false })] } as never);

    const { result } = renderHook(() => useFriendContextMenuItems('u2'), { wrapper });

    expect(result.current.map((item) => item.label)).not.toContain('Iniciar chamada');
  });

  it('offers to start a call when the friend is online and no dm call is in progress', () => {
    vi.mocked(hooksModule.useFriends).mockReturnValue({ data: [friend({ online: true })] } as never);

    const { result } = renderHook(() => useFriendContextMenuItems('u2'), { wrapper });

    const callItem = result.current.find((item) => item.label === 'Iniciar chamada');
    expect(callItem).toBeDefined();
    callItem?.onSelect();
    expect(startDmCall).toHaveBeenCalledWith({ id: 'u2', username: 'b', displayName: 'B', avatarUrl: null });
  });

  it('does not offer to start a call when a dm call is already in progress', () => {
    vi.mocked(hooksModule.useFriends).mockReturnValue({ data: [friend({ online: true })] } as never);
    useDmCallStore.setState({ status: 'ringing-out', callId: 'c1', role: 'caller', peer: null });

    const { result } = renderHook(() => useFriendContextMenuItems('u2'), { wrapper });

    expect(result.current.map((item) => item.label)).not.toContain('Iniciar chamada');
  });

  it('offers to remove the friend', () => {
    const remove = vi.fn();
    vi.mocked(hooksModule.useFriends).mockReturnValue({ data: [friend()] } as never);
    vi.mocked(hooksModule.useRemoveFriend).mockReturnValue(mutation(remove) as never);

    const { result } = renderHook(() => useFriendContextMenuItems('u2'), { wrapper });

    const removeItem = result.current.find((item) => item.label === 'Desfazer amizade');
    expect(removeItem).toBeDefined();
    removeItem?.onSelect();
    expect(remove).toHaveBeenCalledWith('f1');
  });
});
