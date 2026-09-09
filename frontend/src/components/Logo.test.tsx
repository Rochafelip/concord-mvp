import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Logo } from './Logo';

describe('Logo', () => {
  it('renders the Concord wordmark by default', () => {
    render(<Logo />);

    expect(screen.getByText('Concord')).toBeInTheDocument();
  });

  it('omits the wordmark when showWordmark is false', () => {
    render(<Logo showWordmark={false} />);

    expect(screen.queryByText('Concord')).not.toBeInTheDocument();
  });
});
