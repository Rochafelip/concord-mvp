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
    useAuthStore.setState({ token: null, user: null });
    vi.mocked(api.login).mockReset();
  });

  it('renders the login form', () => {
    renderLoginPage();

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Register' })).toBeInTheDocument();
  });

  it('shows the backend error message when the mutation fails', async () => {
    vi.mocked(api.login).mockRejectedValue(new ApiError('Invalid email or password', 401));
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText('Email'), 'a@b.com');
    await user.type(screen.getByLabelText('Password'), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
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

    await user.type(screen.getByLabelText('Email'), 'a@b.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(screen.getByRole('button', { name: /Logging in/ })).toBeDisabled();

    resolveLogin({
      token: 't',
      userId: 'u1',
      username: 'a',
      displayName: 'A',
      email: 'a@b.com',
    });
  });

  it('updates the auth store on a successful login', async () => {
    vi.mocked(api.login).mockResolvedValue({
      token: 'jwt-token',
      userId: 'user-1',
      username: 'jdoe',
      displayName: 'John Doe',
      email: 'a@b.com',
    });
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText('Email'), 'a@b.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => {
      expect(useAuthStore.getState().token).toBe('jwt-token');
    });
    expect(useAuthStore.getState().user?.displayName).toBe('John Doe');
    expect(vi.mocked(api.login).mock.calls[0][0]).toEqual({ email: 'a@b.com', password: 'password123' });
  });
});
