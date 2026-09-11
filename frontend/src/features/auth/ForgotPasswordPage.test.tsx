import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRouter } from '../../routes/AppRouter';
import * as api from './api';
import { ForgotPasswordPage } from './ForgotPasswordPage';

vi.mock('./api', () => ({
  requestPasswordReset: vi.fn(),
}));

function renderPage(element: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{element}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.mocked(api.requestPasswordReset).mockReset();
  });

  it('shows a generic confirmation after requesting a reset', async () => {
    vi.mocked(api.requestPasswordReset).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText('E-mail'), 'alice@example.com');
    await user.click(screen.getByRole('button', { name: 'Enviar link de recuperação' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Se existir uma conta com esse e-mail, enviamos um link de recuperação.',
    );
  });

  it('rejects an invalid email without calling the API', async () => {
    const user = userEvent.setup();
    renderPage(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText('E-mail'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Enviar link de recuperação' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Digite um e-mail válido.');
    expect(api.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('links back to the login page', () => {
    renderPage(<ForgotPasswordPage />);

    expect(screen.getByRole('link', { name: 'Voltar para o login' })).toHaveAttribute('href', '/login');
  });

  it('is reachable at /forgot-password', () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/forgot-password']}>
          <AppRouter />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Esqueceu sua senha?' })).toBeInTheDocument();
  });
});
