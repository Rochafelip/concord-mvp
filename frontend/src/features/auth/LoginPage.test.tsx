import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../services/apiClient';
import * as api from './api';
import { useAuthStore } from './authStore';
import { LoginPage } from './LoginPage';

vi.mock('./api');

function renderLoginPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ isAuthenticated: false, user: null, sessionEndedReason: null });
    vi.mocked(api.login).mockReset();
  });

  it('explains an expired session and consumes the reason', async () => {
    useAuthStore.setState({ isAuthenticated: false, user: null, sessionEndedReason: 'expired' });

    renderLoginPage();

    expect(screen.getByRole('status')).toHaveTextContent('Sua sessão expirou');
    await waitFor(() => {
      expect(useAuthStore.getState().sessionEndedReason).toBeNull();
    });
    // The notice must survive being consumed — clearing the store shouldn't blank the screen.
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows no session notice on a normal visit', () => {
    renderLoginPage();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders the login form', () => {
    renderLoginPage();

    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Criar conta' })).toBeInTheDocument();
  });

  it('lets the user reveal and re-hide the password', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: 'Ocultar senha' }));
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password');
  });

  it('offers a route to password recovery', () => {
    renderLoginPage();

    expect(screen.getByRole('link', { name: 'Esqueceu sua senha?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('shows the backend error message when the mutation fails', async () => {
    vi.mocked(api.login).mockRejectedValue(new ApiError('E-mail ou senha inválidos', 401));
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText('E-mail'), 'a@b.com');
    await user.type(screen.getByLabelText('Senha'), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos');
  });

  it('disables the submit button while the mutation is pending', async () => {
    let resolveLogin: (value: Awaited<ReturnType<typeof api.login>>) => void = () => {};
    vi.mocked(api.login).mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve;
      }),
    );
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText('E-mail'), 'a@b.com');
    await user.type(screen.getByLabelText('Senha'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(screen.getByRole('button', { name: /Entrando/ })).toBeDisabled();

    resolveLogin({
      userId: 'u1',
      username: 'a',
      displayName: 'A',
      email: 'a@b.com',
    });
  });

  it('updates the auth store on a successful login', async () => {
    vi.mocked(api.login).mockResolvedValue({
      userId: 'user-1',
      username: 'jdoe',
      displayName: 'John Doe',
      email: 'a@b.com',
    });
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText('E-mail'), 'a@b.com');
    await user.type(screen.getByLabelText('Senha'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });
    expect(useAuthStore.getState().user?.displayName).toBe('John Doe');
    expect(vi.mocked(api.login).mock.calls[0][0]).toEqual({ email: 'a@b.com', password: 'password123' });
  });
});
