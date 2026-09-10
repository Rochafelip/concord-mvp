import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppRouter } from '../../routes/AppRouter';
import { ForgotPasswordPage } from './ForgotPasswordPage';

describe('ForgotPasswordPage', () => {
  it('explains that password recovery is not available yet', () => {
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Esqueceu sua senha?' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/not available yet/i);
  });

  it('links back to the login page', () => {
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Voltar para o login' })).toHaveAttribute('href', '/login');
  });

  it('is reachable at /forgot-password', () => {
    render(
      <MemoryRouter initialEntries={['/forgot-password']}>
        <AppRouter />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Esqueceu sua senha?' })).toBeInTheDocument();
  });
});
