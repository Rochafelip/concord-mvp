import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../services/apiClient';
import { useAuthStore } from '../auth/authStore';
import * as api from './api';
import { InvitePreviewPage } from './InvitePreviewPage';

vi.mock('./api');

function LoginStub() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? 'none';
  return <span data-testid="login-page">login page, from={from}</span>;
}

function RegisterStub() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? 'none';
  return <span data-testid="register-page">register page, from={from}</span>;
}

function ServerStub() {
  const { serverId } = useParams<{ serverId: string }>();
  return <span data-testid="server-page">server page {serverId}</span>;
}

function renderPage(code = 'abc123') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/invite/${code}`]}>
        <Routes>
          <Route path="/invite/:code" element={<InvitePreviewPage />} />
          <Route path="/login" element={<LoginStub />} />
          <Route path="/register" element={<RegisterStub />} />
          <Route path="/app/servers/:serverId" element={<ServerStub />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const preview = { serverId: 'server-1', serverName: 'Amigos do Concord', memberCount: 4 };

describe('InvitePreviewPage', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ isAuthenticated: false, user: null });
    vi.mocked(api.getInvitePreview).mockReset();
    vi.mocked(api.joinServer).mockReset();
    vi.mocked(api.listServers).mockReset();
    vi.mocked(api.listServers).mockResolvedValue([]);
  });

  it('shows a loading state while the preview is being fetched', () => {
    vi.mocked(api.getInvitePreview).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows a friendly message for an invalid or expired invite', async () => {
    vi.mocked(api.getInvitePreview).mockRejectedValue(new ApiError('Invalid invite code', 404));
    renderPage();

    expect(await screen.findByText(/convite é inválido ou expirou/i)).toBeInTheDocument();
  });

  describe('not authenticated', () => {
    beforeEach(() => {
      vi.mocked(api.getInvitePreview).mockResolvedValue(preview);
    });

    it('shows the server preview without fetching the private servers list', async () => {
      renderPage();

      expect(await screen.findByText('Amigos do Concord')).toBeInTheDocument();
      expect(screen.getByText(/4/)).toBeInTheDocument();
      expect(api.listServers).not.toHaveBeenCalled();
    });

    it('sends the user to login preserving the invite as the return destination', async () => {
      const user = userEvent.setup();
      renderPage('abc123');
      await screen.findByText('Amigos do Concord');

      await user.click(screen.getByRole('button', { name: 'Entrar' }));

      expect(await screen.findByTestId('login-page')).toHaveTextContent('from=/invite/abc123');
    });

    it('sends the user to register preserving the invite as the return destination', async () => {
      const user = userEvent.setup();
      renderPage('abc123');
      await screen.findByText('Amigos do Concord');

      await user.click(screen.getByRole('button', { name: 'Criar conta' }));

      expect(await screen.findByTestId('register-page')).toHaveTextContent('from=/invite/abc123');
    });
  });

  describe('authenticated, not yet a member', () => {
    beforeEach(() => {
      useAuthStore.setState({
        isAuthenticated: true,
        user: { id: 'user-1', username: 'alice', displayName: 'Alice', email: 'a@b.com', avatarUrl: null },
      });
      vi.mocked(api.getInvitePreview).mockResolvedValue(preview);
      vi.mocked(api.listServers).mockResolvedValue([]);
    });

    it('joins the server and navigates to it', async () => {
      vi.mocked(api.joinServer).mockResolvedValue({
        id: 'server-1',
        name: 'Amigos do Concord',
        ownerId: 'owner-1',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      });
      const user = userEvent.setup();
      renderPage('abc123');
      await screen.findByText('Amigos do Concord');

      await user.click(screen.getByRole('button', { name: 'Entrar no servidor' }));

      expect(await screen.findByTestId('server-page')).toHaveTextContent('server-1');
      expect(vi.mocked(api.joinServer).mock.calls[0][0]).toEqual({ code: 'abc123' });
    });
  });

  describe('authenticated, already a member', () => {
    beforeEach(() => {
      useAuthStore.setState({
        isAuthenticated: true,
        user: { id: 'user-1', username: 'alice', displayName: 'Alice', email: 'a@b.com', avatarUrl: null },
      });
      vi.mocked(api.getInvitePreview).mockResolvedValue(preview);
      vi.mocked(api.listServers).mockResolvedValue([
        { id: 'server-1', name: 'Amigos do Concord', ownerId: 'owner-1', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
      ]);
    });

    it('offers to go straight to the server instead of joining again', async () => {
      const user = userEvent.setup();
      renderPage('abc123');

      expect(await screen.findByText(/você já está neste servidor/i)).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Ir para o servidor' }));

      expect(await screen.findByTestId('server-page')).toHaveTextContent('server-1');
      expect(api.joinServer).not.toHaveBeenCalled();
    });
  });
});
