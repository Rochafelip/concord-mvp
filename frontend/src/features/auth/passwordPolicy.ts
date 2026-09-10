export interface PasswordRule {
  label: string;
  isMet: (value: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { label: 'Pelo menos 8 caracteres', isMet: (value) => value.length >= 8 },
  { label: 'Uma letra maiúscula', isMet: (value) => /[A-Z]/.test(value) },
  { label: 'Uma letra minúscula', isMet: (value) => /[a-z]/.test(value) },
  { label: 'Um número', isMet: (value) => /[0-9]/.test(value) },
];

export function isPasswordValid(value: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.isMet(value));
}
