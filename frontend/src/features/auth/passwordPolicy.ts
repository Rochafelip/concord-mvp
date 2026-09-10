export interface PasswordRule {
  label: string;
  isMet: (value: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { label: 'At least 8 characters', isMet: (value) => value.length >= 8 },
  { label: 'One uppercase letter', isMet: (value) => /[A-Z]/.test(value) },
  { label: 'One lowercase letter', isMet: (value) => /[a-z]/.test(value) },
  { label: 'One number', isMet: (value) => /[0-9]/.test(value) },
];

export function isPasswordValid(value: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.isMet(value));
}
