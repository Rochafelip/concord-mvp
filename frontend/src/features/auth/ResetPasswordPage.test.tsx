import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../services/apiClient';
import * as api from './api';
import { ResetPasswordPage } from './ResetPasswordPage';

vi.mock('./api', () => ({
  verifyPasswordResetToken: vi.fn(),
  resetPassword: vi.fn(),
}));

function renderPage(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <ResetPasswordPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.mocked(api.verifyPasswordResetToken).mockReset();
    vi.mocked(api.resetPassword).mockReset();
  });

  it('validates the token before showing the form', async () => {
    vi.mocked(api.verifyPasswordResetToken).mockResolvedValue(undefined);

    renderPage('/reset-password?token=abc');

    expect(await screen.findByRole('heading', { name: 'Redefinir sua senha' })).toBeInTheDocument();
    expect(api.verifyPasswordResetToken).toHaveBeenCalledWith('abc', expect.any(Object));
  });

  it('shows an invalid-link error and a way to request a new link', async () => {
    vi.mocked(api.verifyPasswordResetToken).mockRejectedValue(
      new ApiError('Link de redefinição inválido ou expirado', 400),
    );

    renderPage('/reset-password?token=abc');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Link de redefinição inválido ou expirado',
    );
    expect(screen.getByRole('link', { name: 'Solicitar novo link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('requires matching passwords before submitting', async () => {
    vi.mocked(api.verifyPasswordResetToken).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage('/reset-password?token=abc');
    await screen.findByRole('heading', { name: 'Redefinir sua senha' });

    await user.type(screen.getByLabelText('Nova senha'), 'NewPassword1');
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'Different1');
    await user.click(screen.getByRole('button', { name: 'Confirmar nova senha' }));

    expect(screen.getByRole('alert')).toHaveTextContent('As senhas não coincidem');
    expect(api.resetPassword).not.toHaveBeenCalled();
  });

  it('shows success after changing the password', async () => {
    vi.mocked(api.verifyPasswordResetToken).mockResolvedValue(undefined);
    vi.mocked(api.resetPassword).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage('/reset-password?token=abc');
    await screen.findByRole('heading', { name: 'Redefinir sua senha' });

    await user.type(screen.getByLabelText('Nova senha'), 'NewPassword1');
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'NewPassword1');
    await user.click(screen.getByRole('button', { name: 'Confirmar nova senha' }));

    expect(await screen.findByRole('heading', { name: 'Senha alterada' })).toBeInTheDocument();
    expect(api.resetPassword).toHaveBeenCalledWith('abc', 'NewPassword1');
  });
});
