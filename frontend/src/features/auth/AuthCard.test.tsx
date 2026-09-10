import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthCard } from './AuthCard';

describe('AuthCard', () => {
  it('renders the title as the page heading', () => {
    render(<AuthCard title="Log in">form</AuthCard>);

    expect(screen.getByRole('heading', { level: 1, name: 'Log in' })).toBeInTheDocument();
  });

  it('renders its children', () => {
    render(
      <AuthCard title="Log in">
        <p>form body</p>
      </AuthCard>,
    );

    expect(screen.getByText('form body')).toBeInTheDocument();
  });

  it('renders a footer when given one', () => {
    render(
      <AuthCard title="Log in" footer={<span>footer body</span>}>
        form
      </AuthCard>,
    );

    expect(screen.getByText('footer body')).toBeInTheDocument();
  });

  it('omits the footer region when none is given', () => {
    render(<AuthCard title="Log in">form</AuthCard>);

    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });
});
