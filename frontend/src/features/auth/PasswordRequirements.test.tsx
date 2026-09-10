import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PasswordRequirements } from './PasswordRequirements';
import { isPasswordValid } from './passwordPolicy';

function ruleFor(label: string): HTMLElement {
  const match = screen.getAllByRole('listitem').find((item) => item.textContent?.includes(label));
  if (!match) throw new Error(`No requirement item found for "${label}"`);
  return match;
}

describe('PasswordRequirements', () => {
  it('lists every requirement as missing for an empty password', () => {
    render(<PasswordRequirements value="" />);

    expect(ruleFor('Pelo menos 8 caracteres')).toHaveTextContent('faltando');
    expect(ruleFor('Uma letra maiúscula')).toHaveTextContent('faltando');
    expect(ruleFor('Uma letra minúscula')).toHaveTextContent('faltando');
    expect(ruleFor('Um número')).toHaveTextContent('faltando');
  });

  it('marks the length rule met once the password is long enough', () => {
    render(<PasswordRequirements value="abcdefgh" />);

    expect(ruleFor('Pelo menos 8 caracteres')).toHaveTextContent('atendido');
    expect(ruleFor('Pelo menos 8 caracteres')).not.toHaveTextContent('faltando');
  });

  it('marks the uppercase rule met only when an uppercase letter is present', () => {
    const { rerender } = render(<PasswordRequirements value="abcdefgh" />);
    expect(ruleFor('Uma letra maiúscula')).toHaveTextContent('faltando');

    rerender(<PasswordRequirements value="abcdefgH" />);
    expect(ruleFor('Uma letra maiúscula')).toHaveTextContent('atendido');
  });

  it('marks the lowercase rule met only when a lowercase letter is present', () => {
    const { rerender } = render(<PasswordRequirements value="ABCDEFGH" />);
    expect(ruleFor('Uma letra minúscula')).toHaveTextContent('faltando');

    rerender(<PasswordRequirements value="ABCDEFGh" />);
    expect(ruleFor('Uma letra minúscula')).toHaveTextContent('atendido');
  });

  it('marks the number rule met only when a digit is present', () => {
    const { rerender } = render(<PasswordRequirements value="abcdefgh" />);
    expect(ruleFor('Um número')).toHaveTextContent('faltando');

    rerender(<PasswordRequirements value="abcdefg1" />);
    expect(ruleFor('Um número')).toHaveTextContent('atendido');
  });

  it('distinguishes met from missing without relying on color', () => {
    render(<PasswordRequirements value="abcdefgh" />);

    const met = ruleFor('Pelo menos 8 caracteres').querySelector('svg');
    const missing = ruleFor('Um número').querySelector('svg');

    expect(met).toBeTruthy();
    expect(missing).toBeTruthy();
    // Different glyphs, not merely different colors, so the state survives greyscale.
    expect(met!.innerHTML).not.toEqual(missing!.innerHTML);
  });
});

describe('isPasswordValid', () => {
  it('accepts a password satisfying every rule', () => {
    expect(isPasswordValid('Passw0rdd')).toBe(true);
  });

  it.each([
    ['too short', 'Pass0rd'],
    ['no uppercase', 'passw0rdd'],
    ['no lowercase', 'PASSW0RDD'],
    ['no number', 'Passwordd'],
  ])('rejects a password with %s', (_reason, password) => {
    expect(isPasswordValid(password)).toBe(false);
  });
});
