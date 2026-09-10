import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PasswordInput } from './PasswordInput';

describe('PasswordInput', () => {
  it('masks the password until the toggle is pressed', () => {
    render(<PasswordInput label="Senha" name="password" />);

    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toBeInTheDocument();
  });

  it('reveals the password when the toggle is pressed', async () => {
    const user = userEvent.setup();
    render(<PasswordInput label="Senha" name="password" />);

    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }));

    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Ocultar senha' })).toBeInTheDocument();
  });

  it('masks the password again when the toggle is pressed twice', async () => {
    const user = userEvent.setup();
    render(<PasswordInput label="Senha" name="password" />);

    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    await user.click(screen.getByRole('button', { name: 'Ocultar senha' }));

    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password');
  });

  it('does not submit the surrounding form when toggled', async () => {
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
    const user = userEvent.setup();
    render(
      <form onSubmit={onSubmit}>
        <PasswordInput label="Senha" name="password" />
      </form>,
    );

    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('forwards the typed value through onChange', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<PasswordInput label="Senha" name="password" value="" onChange={onChange} />);

    await user.type(screen.getByLabelText('Senha'), 'a');

    expect(onChange).toHaveBeenCalled();
  });
});
