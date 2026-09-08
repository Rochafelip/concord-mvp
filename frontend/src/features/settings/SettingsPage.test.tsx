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
      token: 'tok',
      user: { id: 'u1', username: 'jdoe', displayName: 'John Doe', email: 'j@doe.com', avatarUrl: null },
    });
    vi.mocked(api.updateProfile).mockReset();
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
    expect(await screen.findByText('Alterações salvas com sucesso')).toBeInTheDocument();
  });

  it('shows the backend error message when the profile update fails', async () => {
    vi.mocked(api.updateProfile).mockRejectedValue(new ApiError('username: size must be between 0 and 50', 400));
    const user = userEvent.setup();
    renderSettingsPage();

    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('username: size must be between 0 and 50');
  });
});
