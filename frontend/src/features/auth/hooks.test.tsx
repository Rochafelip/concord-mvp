import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from './api';
import { useAuthStore } from './authStore';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';

vi.mock('./api');

function CurrentPath() {
  return <span data-testid="path">{useLocation().pathname}</span>;
}

function renderLoginArrivingFrom(from: string | undefined) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[{ pathname: '/login', state: from ? { from } : null }]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<CurrentPath />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function renderRegisterArrivingFrom(from: string | undefined) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[{ pathname: '/register', state: from ? { from } : null }]}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="*" element={<CurrentPath />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function submitLogin() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('E-mail'), 'a@b.com');
  await user.type(screen.getByLabelText('Senha'), 'Password123');
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
}

async function submitRegister() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Nome de usuário'), 'jdoe');
  await user.type(screen.getByLabelText('Nome de exibição'), 'John Doe');
  await user.type(screen.getByLabelText('E-mail'), 'a@b.com');
  await user.type(screen.getByLabelText('Senha'), 'Password123');
  await user.click(screen.getByRole('button', { name: 'Criar conta' }));
}

describe('useLogin redirect target', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ isAuthenticated: false, user: null, sessionEndedReason: null });
    vi.mocked(api.login).mockReset();
    vi.mocked(api.login).mockResolvedValue({
      userId: 'u1',
      username: 'a',
      displayName: 'A',
      email: 'a@b.com',
    });
  });

  it('returns the user to the route they were trying to reach', async () => {
    renderLoginArrivingFrom('/app/servers/s1');
    await submitLogin();

    await waitFor(() => {
      expect(screen.getByTestId('path')).toHaveTextContent('/app/servers/s1');
    });
  });

  it('falls back to /app when there is no origin', async () => {
    renderLoginArrivingFrom(undefined);
    await submitLogin();

    await waitFor(() => {
      expect(screen.getByTestId('path')).toHaveTextContent('/app');
    });
  });

  it('ignores an absolute URL, which would be an open redirect', async () => {
    renderLoginArrivingFrom('https://evil.example.com/phish');
    await submitLogin();

    await waitFor(() => {
      expect(screen.getByTestId('path')).toHaveTextContent('/app');
    });
  });

  it('ignores a protocol-relative URL, which the browser treats as absolute', async () => {
    renderLoginArrivingFrom('//evil.example.com/phish');
    await submitLogin();

    await waitFor(() => {
      expect(screen.getByTestId('path')).toHaveTextContent('/app');
    });
  });

  it('ignores a same-looking path outside the authenticated area', async () => {
    renderLoginArrivingFrom('/appearances-are-deceiving');
    await submitLogin();

    await waitFor(() => {
      expect(screen.getByTestId('path')).toHaveTextContent('/app');
    });
  });

  it('returns the user to an invite link they were trying to reach', async () => {
    renderLoginArrivingFrom('/invite/abc123');
    await submitLogin();

    await waitFor(() => {
      expect(screen.getByTestId('path')).toHaveTextContent('/invite/abc123');
    });
  });

  it('ignores a same-looking path outside the invite area', async () => {
    renderLoginArrivingFrom('/invited-not-real');
    await submitLogin();

    await waitFor(() => {
      expect(screen.getByTestId('path')).toHaveTextContent('/app');
    });
  });
});

describe('useRegister redirect target', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ isAuthenticated: false, user: null, sessionEndedReason: null });
    vi.mocked(api.register).mockReset();
    vi.mocked(api.register).mockResolvedValue({
      userId: 'u1',
      username: 'jdoe',
      displayName: 'John Doe',
      email: 'a@b.com',
    });
  });

  it('returns the user to an invite link they were trying to reach', async () => {
    renderRegisterArrivingFrom('/invite/abc123');
    await submitRegister();

    await waitFor(() => {
      expect(screen.getByTestId('path')).toHaveTextContent('/invite/abc123');
    });
  });

  it('falls back to /app when there is no origin', async () => {
    renderRegisterArrivingFrom(undefined);
    await submitRegister();

    await waitFor(() => {
      expect(screen.getByTestId('path')).toHaveTextContent('/app');
    });
  });

  it('ignores an absolute URL, which would be an open redirect', async () => {
    renderRegisterArrivingFrom('https://evil.example.com/phish');
    await submitRegister();

    await waitFor(() => {
      expect(screen.getByTestId('path')).toHaveTextContent('/app');
    });
  });
});
