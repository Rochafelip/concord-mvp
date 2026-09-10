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

    expect(screen.getByLabelText('Username')).toHaveValue('jdoe');
    expect(screen.getByLabelText('Display name')).toHaveValue('John Doe');
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

    await user.clear(screen.getByLabelText('Username'));
    await user.type(screen.getByLabelText('Username'), 'jdoe2');
    await user.clear(screen.getByLabelText('Display name'));
    await user.type(screen.getByLabelText('Display name'), 'John Doe Two');
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => {
      expect(useAuthStore.getState().user?.username).toBe('jdoe2');
    });
    expect(await screen.findByText('Profile updated successfully')).toBeInTheDocument();
  });

  it('shows the backend error message when the profile update fails', async () => {
    vi.mocked(api.updateProfile).mockRejectedValue(new ApiError('username: size must be between 0 and 50', 400));
    const user = userEvent.setup();
    renderSettingsPage();

    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('username: size must be between 0 and 50');
  });

  it('blocks submission and shows an inline message when new password and confirmation differ', async () => {
    const user = userEvent.setup();
    renderSettingsPage();

    await user.type(screen.getByLabelText('Current password'), 'oldpassword');
    await user.type(screen.getByLabelText('New password'), 'NewPassword1');
    await user.type(screen.getByLabelText('Confirm new password'), 'NewPassword2');
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('New password and confirmation do not match');
    expect(api.changePassword).not.toHaveBeenCalled();
  });

  it('shows the password requirements and marks them as the new password meets them', async () => {
    const user = userEvent.setup();
    renderSettingsPage();

    expect(screen.getByText('Pelo menos 8 caracteres')).toBeInTheDocument();

    await user.type(screen.getByLabelText('New password'), 'Abcdefg1');

    const met = screen.getAllByText('atendido');
    expect(met).toHaveLength(4);
  });

  it('blocks submission when the new password does not meet the policy', async () => {
    const user = userEvent.setup();
    renderSettingsPage();

    await user.type(screen.getByLabelText('Current password'), 'OldPassword1');
    await user.type(screen.getByLabelText('New password'), 'nouppercase1');
    await user.type(screen.getByLabelText('Confirm new password'), 'nouppercase1');
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    expect(api.changePassword).not.toHaveBeenCalled();
    expect(screen.getByLabelText('New password')).toHaveFocus();
  });

  it('clears the password fields and shows a success message on save', async () => {
    vi.mocked(api.changePassword).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderSettingsPage();

    await user.type(screen.getByLabelText('Current password'), 'oldpassword');
    await user.type(screen.getByLabelText('New password'), 'NewPassword1');
    await user.type(screen.getByLabelText('Confirm new password'), 'NewPassword1');
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Current password')).toHaveValue('');
    });
    expect(screen.getByLabelText('New password')).toHaveValue('');
    expect(screen.getByLabelText('Confirm new password')).toHaveValue('');
    expect(await screen.findByText('Password changed successfully')).toBeInTheDocument();
  });

  it('shows the backend error message when the current password is wrong', async () => {
    vi.mocked(api.changePassword).mockRejectedValue(new ApiError('Current password is incorrect', 400));
    const user = userEvent.setup();
    renderSettingsPage();

    await user.type(screen.getByLabelText('Current password'), 'wrongpassword');
    await user.type(screen.getByLabelText('New password'), 'NewPassword1');
    await user.type(screen.getByLabelText('Confirm new password'), 'NewPassword1');
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Current password is incorrect');
  });
});
