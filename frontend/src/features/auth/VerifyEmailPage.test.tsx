import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../services/apiClient';
import { useAuthStore } from './authStore';
import * as api from './api';
import { VerifyEmailPage } from './VerifyEmailPage';

vi.mock('./api', () => ({
  verifyEmail: vi.fn(),
}));

function renderPage(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <VerifyEmailPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    vi.mocked(api.verifyEmail).mockReset();
    useAuthStore.setState({ isAuthenticated: false, user: null, sessionEndedReason: null });
  });

  it('confirms the account when the token is valid', async () => {
    vi.mocked(api.verifyEmail).mockResolvedValue(undefined);

    renderPage('/verify-email?token=abc');

    expect(await screen.findByRole('heading', { name: 'Conta confirmada' })).toBeInTheDocument();
    expect(api.verifyEmail).toHaveBeenCalledWith('abc', expect.any(Object));
  });

  it('shows the API error for an invalid token', async () => {
    vi.mocked(api.verifyEmail).mockRejectedValue(
      new ApiError('Link de confirmação inválido ou expirado', 400),
    );

    renderPage('/verify-email?token=abc');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Link de confirmação inválido ou expirado',
    );
  });

  it('does not call the API when the token is missing', () => {
    renderPage('/verify-email');

    expect(api.verifyEmail).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('incompleto');
  });
});
