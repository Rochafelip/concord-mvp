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

    expect(screen.getByLabelText('Nome de usuário')).toBeInTheDocument();
    expect(screen.getByLabelText('Nome de exibição')).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar conta' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('shows the backend validation message when the mutation fails', async () => {
    vi.mocked(api.register).mockRejectedValue(
      new ApiError('email: must be a well-formed email address', 400),
    );
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText('Nome de usuário'), 'jdoe');
    await user.type(screen.getByLabelText('Nome de exibição'), 'John Doe');
    await user.type(screen.getByLabelText('E-mail'), 'alice@example.com');
    await user.type(screen.getByLabelText('Senha'), 'Password123');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'email: must be a well-formed email address',
    );
  });

  it('does not call the API when the email format is invalid', async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText('Nome de usuário'), 'jdoe');
    await user.type(screen.getByLabelText('Nome de exibição'), 'John Doe');
    await user.type(screen.getByLabelText('E-mail'), 'not-an-email');
    await user.type(screen.getByLabelText('Senha'), 'Password123');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Digite um e-mail válido.');
    expect(api.register).not.toHaveBeenCalled();
  });

  it('shows the password requirements and updates them while typing', async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    const lengthRule = () =>
      screen.getAllByRole('listitem').find((item) => item.textContent?.includes('Pelo menos 8 caracteres'))!;

    expect(lengthRule()).toHaveTextContent('faltando');

    await user.type(screen.getByLabelText('Senha'), 'Password123');

    expect(lengthRule()).toHaveTextContent('atendido');
  });

  it('does not call the API when the password fails the requirements', async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText('Nome de usuário'), 'jdoe');
    await user.type(screen.getByLabelText('Nome de exibição'), 'John Doe');
    await user.type(screen.getByLabelText('E-mail'), 'a@b.com');
    await user.type(screen.getByLabelText('Senha'), 'password');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(api.register).not.toHaveBeenCalled();
  });

  it('moves focus to the password field when the requirements are unmet', async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText('Nome de usuário'), 'jdoe');
    await user.type(screen.getByLabelText('Nome de exibição'), 'John Doe');
    await user.type(screen.getByLabelText('E-mail'), 'a@b.com');
    await user.type(screen.getByLabelText('Senha'), 'password');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(screen.getByLabelText('Senha')).toHaveFocus();
  });

  it('describes the password field with the requirement list', () => {
    renderRegisterPage();

    const describedBy = screen.getByLabelText('Senha').getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent('Pelo menos 8 caracteres');
  });

  it('lets the user reveal the password', async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }));

    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'text');
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

    await user.type(screen.getByLabelText('Nome de usuário'), 'jdoe');
    await user.type(screen.getByLabelText('Nome de exibição'), 'John Doe');
    await user.type(screen.getByLabelText('E-mail'), 'a@b.com');
    await user.type(screen.getByLabelText('Senha'), 'Password123');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(screen.getByRole('button', { name: /Criando conta/ })).toBeDisabled();

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

    await user.type(screen.getByLabelText('Nome de usuário'), 'jdoe');
    await user.type(screen.getByLabelText('Nome de exibição'), 'John Doe');
    await user.type(screen.getByLabelText('E-mail'), 'a@b.com');
    await user.type(screen.getByLabelText('Senha'), 'Password123');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

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
