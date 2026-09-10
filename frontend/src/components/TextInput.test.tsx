import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TextInput } from './TextInput';

describe('TextInput', () => {
  it('associates the visible label with the input', () => {
    render(<TextInput label="Email" name="email" />);

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('renders trailing content alongside the input', () => {
    render(<TextInput label="Password" name="password" trailing={<button type="button">Show</button>} />);

    expect(screen.getByRole('button', { name: 'Show' })).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('leaves room for trailing content so text cannot run underneath it', () => {
    render(<TextInput label="Password" name="password" trailing={<span>icon</span>} />);

    expect(screen.getByLabelText('Password').className).toContain('pr-10');
  });

  it('keeps default right padding when there is no trailing content', () => {
    render(<TextInput label="Email" name="email" />);

    expect(screen.getByLabelText('Email').className).not.toContain('pr-10');
  });

  // Card #18 requires visible focus states in Concord's own palette. The browser's default
  // outline is black on light and white on dark, so it has to be replaced by a brand ring
  // rather than merely suppressed.
  it('replaces the default focus outline with a brand-colored ring', () => {
    render(<TextInput label="Email" name="email" />);

    const input = screen.getByLabelText('Email');
    expect(input.className).toContain('focus-visible:outline-none');
    expect(input.className).toContain('focus-visible:ring-2');
    expect(input.className).toContain('focus-visible:ring-brand');
  });
});
