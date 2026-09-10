import type { InputHTMLAttributes, ReactNode } from 'react';

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Keeps the label in the accessibility tree (via sr-only) but hides it visually — for
   * inputs like the chat message box where a visible form-style label doesn't fit the UI. */
  hideLabel?: boolean;
  /** Fully rounded corners, for pill-shaped inputs like the chat message box. */
  pill?: boolean;
  /** Control rendered inside the field's right edge, such as a password reveal toggle. */
  trailing?: ReactNode;
}

export function TextInput({
  label,
  id,
  hideLabel = false,
  pill = false,
  trailing,
  className = '',
  ...rest
}: TextInputProps) {
  const inputId = id ?? rest.name;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className={hideLabel ? 'sr-only' : 'text-body font-medium text-muted'}>
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          className={`h-10 w-full border bg-surface px-3 text-body text-ink focus:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
            pill ? 'rounded-full' : 'rounded'
          } ${trailing ? 'pr-10' : ''} ${className}`}
          {...rest}
        />
        {trailing && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-2">{trailing}</div>
        )}
      </div>
    </div>
  );
}
