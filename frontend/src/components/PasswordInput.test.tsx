import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PasswordInput } from './PasswordInput';

describe('PasswordInput', () => {
  it('masks the password until the toggle is pressed', () => {
    render(<PasswordInput label="Password" name="password" />);

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument();
  });

  it('reveals the password when the toggle is pressed', async () => {
    const user = userEvent.setup();
    render(<PasswordInput label="Password" name="password" />);

    await user.click(screen.getByRole('button', { name: 'Show password' }));

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();
  });

  it('masks the password again when the toggle is pressed twice', async () => {
    const user = userEvent.setup();
    render(<PasswordInput label="Password" name="password" />);

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    await user.click(screen.getByRole('button', { name: 'Hide password' }));

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });

  it('does not submit the surrounding form when toggled', async () => {
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
    const user = userEvent.setup();
    render(
      <form onSubmit={onSubmit}>
        <PasswordInput label="Password" name="password" />
      </form>,
    );

    await user.click(screen.getByRole('button', { name: 'Show password' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('forwards the typed value through onChange', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<PasswordInput label="Password" name="password" value="" onChange={onChange} />);

    await user.type(screen.getByLabelText('Password'), 'a');

    expect(onChange).toHaveBeenCalled();
  });
});
