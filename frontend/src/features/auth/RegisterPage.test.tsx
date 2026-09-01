import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../services/apiClient';
import * as api from './api';
import { useAuthStore } from './authStore';
import { RegisterPage } from './RegisterPage';

vi.mock('./api');

function renderRegisterPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RegisterPage', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ token: null, user: null });
    vi.mocked(api.register).mockReset();
  });

  it('renders the registration form', () => {
    renderRegisterPage();

    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Display name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Register' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument();
  });

  it('shows the backend validation message when the mutation fails', async () => {
    vi.mocked(api.register).mockRejectedValue(
      new ApiError('email: must be a well-formed email address; password: size must be between 8 and 100', 400),
    );
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText('Username'), 'jdoe');
    await user.type(screen.getByLabelText('Display name'), 'John Doe');
    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'email: must be a well-formed email address; password: size must be between 8 and 100',
    );
  });

  it('disables the submit button while the mutation is pending', async () => {
    let resolveRegister: (value: Awaited<ReturnType<typeof api.register>>) => void = () => {};
    vi.mocked(api.register).mockReturnValue(
      new Promise((resolve) => {
        resolveRegister = resolve;
      }),
    );
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText('Username'), 'jdoe');
    await user.type(screen.getByLabelText('Display name'), 'John Doe');
    await user.type(screen.getByLabelText('Email'), 'a@b.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(screen.getByRole('button', { name: /Creating account/ })).toBeDisabled();

    resolveRegister({
      token: 't',
      userId: 'u1',
      username: 'jdoe',
      displayName: 'John Doe',
      email: 'a@b.com',
    });
  });

  it('updates the auth store on a successful registration', async () => {
    vi.mocked(api.register).mockResolvedValue({
      token: 'jwt-token',
      userId: 'user-1',
      username: 'jdoe',
      displayName: 'John Doe',
      email: 'a@b.com',
    });
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText('Username'), 'jdoe');
    await user.type(screen.getByLabelText('Display name'), 'John Doe');
    await user.type(screen.getByLabelText('Email'), 'a@b.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      expect(useAuthStore.getState().token).toBe('jwt-token');
    });
    expect(vi.mocked(api.register).mock.calls[0][0]).toEqual({
      username: 'jdoe',
      displayName: 'John Doe',
      email: 'a@b.com',
      password: 'password123',
    });
  });
});
