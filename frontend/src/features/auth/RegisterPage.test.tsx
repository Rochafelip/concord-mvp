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
    useAuthStore.setState({ isAuthenticated: false, user: null });
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
      new ApiError('email: must be a well-formed email address', 400),
    );
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText('Username'), 'jdoe');
    await user.type(screen.getByLabelText('Display name'), 'John Doe');
    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.type(screen.getByLabelText('Password'), 'Password123');
    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'email: must be a well-formed email address',
    );
  });

  it('shows the password requirements and updates them while typing', async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    const lengthRule = () =>
      screen.getAllByRole('listitem').find((item) => item.textContent?.includes('At least 8 characters'))!;

    expect(lengthRule()).toHaveTextContent('missing');

    await user.type(screen.getByLabelText('Password'), 'Password123');

    expect(lengthRule()).toHaveTextContent('met');
  });

  it('does not call the API when the password fails the requirements', async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText('Username'), 'jdoe');
    await user.type(screen.getByLabelText('Display name'), 'John Doe');
    await user.type(screen.getByLabelText('Email'), 'a@b.com');
    await user.type(screen.getByLabelText('Password'), 'password');
    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(api.register).not.toHaveBeenCalled();
  });

  it('moves focus to the password field when the requirements are unmet', async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText('Username'), 'jdoe');
    await user.type(screen.getByLabelText('Display name'), 'John Doe');
    await user.type(screen.getByLabelText('Email'), 'a@b.com');
    await user.type(screen.getByLabelText('Password'), 'password');
    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(screen.getByLabelText('Password')).toHaveFocus();
  });

  it('describes the password field with the requirement list', () => {
    renderRegisterPage();

    const describedBy = screen.getByLabelText('Password').getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent('At least 8 characters');
  });

  it('lets the user reveal the password', async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await user.click(screen.getByRole('button', { name: 'Show password' }));

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
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
    await user.type(screen.getByLabelText('Password'), 'Password123');
    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(screen.getByRole('button', { name: /Creating account/ })).toBeDisabled();

    resolveRegister({
      userId: 'u1',
      username: 'jdoe',
      displayName: 'John Doe',
      email: 'a@b.com',
    });
  });

  it('updates the auth store on a successful registration', async () => {
    vi.mocked(api.register).mockResolvedValue({
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
    await user.type(screen.getByLabelText('Password'), 'Password123');
    await user.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });
    expect(vi.mocked(api.register).mock.calls[0][0]).toEqual({
      username: 'jdoe',
      displayName: 'John Doe',
      email: 'a@b.com',
      password: 'Password123',
    });
  });
});
