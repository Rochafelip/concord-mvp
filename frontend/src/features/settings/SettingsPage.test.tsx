import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../services/apiClient';
import { useAuthStore } from '../auth/authStore';
import * as api from './api';
import { SettingsPage } from './SettingsPage';

vi.mock('./api');

function renderSettingsPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsPage />
    </QueryClientProvider>,
  );
}

describe('SettingsPage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'u1', username: 'jdoe', displayName: 'John Doe', email: 'j@doe.com', avatarUrl: null },
    });
    vi.mocked(api.updateProfile).mockReset();
    vi.mocked(api.changePassword).mockReset();
  });

  it('pre-fills the profile form with the current user', () => {
    renderSettingsPage();

    expect(screen.getByLabelText('Nome de usuário')).toHaveValue('jdoe');
    expect(screen.getByLabelText('Nome de exibição')).toHaveValue('John Doe');
  });

  it('updates the auth store and shows a success message on save', async () => {
    vi.mocked(api.updateProfile).mockResolvedValue({
      id: 'u1',
      username: 'jdoe2',
      displayName: 'John Doe Two',
      email: 'j@doe.com',
      avatarUrl: null,
    });
    const user = userEvent.setup();
    renderSettingsPage();

    await user.clear(screen.getByLabelText('Nome de usuário'));
    await user.type(screen.getByLabelText('Nome de usuário'), 'jdoe2');
    await user.clear(screen.getByLabelText('Nome de exibição'));
    await user.type(screen.getByLabelText('Nome de exibição'), 'John Doe Two');
    await user.click(screen.getByRole('button', { name: 'Salvar perfil' }));

    await waitFor(() => {
      expect(useAuthStore.getState().user?.username).toBe('jdoe2');
    });
    expect(await screen.findByText('Perfil atualizado com sucesso')).toBeInTheDocument();
  });

  it('shows the backend error message when the profile update fails', async () => {
    vi.mocked(api.updateProfile).mockRejectedValue(new ApiError('username: size must be between 0 and 50', 400));
    const user = userEvent.setup();
    renderSettingsPage();

    await user.click(screen.getByRole('button', { name: 'Salvar perfil' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('username: size must be between 0 and 50');
  });

  it('blocks submission and shows an inline message when new password and confirmation differ', async () => {
    const user = userEvent.setup();
    renderSettingsPage();

    await user.type(screen.getByLabelText('Senha atual'), 'oldpassword');
    await user.type(screen.getByLabelText('Nova senha'), 'NewPassword1');
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'NewPassword2');
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('A nova senha e a confirmação não coincidem');
    expect(api.changePassword).not.toHaveBeenCalled();
  });

  it('shows the password requirements and marks them as the new password meets them', async () => {
    const user = userEvent.setup();
    renderSettingsPage();

    expect(screen.getByText('Pelo menos 8 caracteres')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Nova senha'), 'Abcdefg1');

    const met = screen.getAllByText('atendido');
    expect(met).toHaveLength(4);
  });

  it('blocks submission when the new password does not meet the policy', async () => {
    const user = userEvent.setup();
    renderSettingsPage();

    await user.type(screen.getByLabelText('Senha atual'), 'OldPassword1');
    await user.type(screen.getByLabelText('Nova senha'), 'nouppercase1');
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'nouppercase1');
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }));

    expect(api.changePassword).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Nova senha')).toHaveFocus();
  });

  it('clears the password fields and shows a success message on save', async () => {
    vi.mocked(api.changePassword).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderSettingsPage();

    await user.type(screen.getByLabelText('Senha atual'), 'oldpassword');
    await user.type(screen.getByLabelText('Nova senha'), 'NewPassword1');
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'NewPassword1');
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Senha atual')).toHaveValue('');
    });
    expect(screen.getByLabelText('Nova senha')).toHaveValue('');
    expect(screen.getByLabelText('Confirmar nova senha')).toHaveValue('');
    expect(await screen.findByText('Senha alterada com sucesso')).toBeInTheDocument();
  });

  it('shows the backend error message when the current password is wrong', async () => {
    vi.mocked(api.changePassword).mockRejectedValue(new ApiError('Current password is incorrect', 400));
    const user = userEvent.setup();
    renderSettingsPage();

    await user.type(screen.getByLabelText('Senha atual'), 'wrongpassword');
    await user.type(screen.getByLabelText('Nova senha'), 'NewPassword1');
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'NewPassword1');
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Current password is incorrect');
  });
});
