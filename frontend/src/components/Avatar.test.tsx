import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('renders the Concord fallback at size lg when there is no avatarUrl', () => {
    render(<Avatar displayName="Felipe" size="lg" />);

    const fallback = screen.getByLabelText('Felipe');
    expect(fallback.querySelector('svg')).toBeInTheDocument();
    expect(fallback).toHaveClass('h-20', 'w-20');
  });

  it('renders an image at size lg when avatarUrl is provided', () => {
    render(<Avatar displayName="Felipe" avatarUrl="https://example.test/felipe.png" size="lg" />);

    const image = screen.getByRole('img', { name: 'Felipe' });
    expect(image).toHaveAttribute('src', 'https://example.test/felipe.png');
    expect(image).toHaveClass('h-20', 'w-20');
  });
});
