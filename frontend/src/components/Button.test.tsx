import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  // Card #18 requires visible focus states across the design system.
  it('shows a visible focus ring for keyboard users', () => {
    render(<Button>Save</Button>);

    expect(screen.getByRole('button', { name: 'Save' }).className).toContain('focus-visible:ring-brand');
  });

  it('keeps the focus ring on the secondary variant', () => {
    render(<Button variant="secondary">Cancel</Button>);

    expect(screen.getByRole('button', { name: 'Cancel' }).className).toContain('focus-visible:ring-brand');
  });
});
