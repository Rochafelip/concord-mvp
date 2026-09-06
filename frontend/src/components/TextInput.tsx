import type { InputHTMLAttributes } from 'react';

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Keeps the label in the accessibility tree (via sr-only) but hides it visually — for
   * inputs like the chat message box where a visible form-style label doesn't fit the UI. */
  hideLabel?: boolean;
  /** Fully rounded corners, for pill-shaped inputs like the chat message box. */
  pill?: boolean;
}

export function TextInput({
  label,
  id,
  hideLabel = false,
  pill = false,
  className = '',
  ...rest
}: TextInputProps) {
  const inputId = id ?? rest.name;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className={hideLabel ? 'sr-only' : 'text-sm font-medium text-muted'}>
        {label}
      </label>
      <input
        id={inputId}
        className={`h-10 border bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none ${
          pill ? 'rounded-full' : 'rounded'
        } ${className}`}
        {...rest}
      />
    </div>
  );
}
