import type { InputHTMLAttributes } from 'react';

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function TextInput({ label, id, className = '', ...rest }: TextInputProps) {
  const inputId = id ?? rest.name;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id={inputId}
        className={`rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none ${className}`}
        {...rest}
      />
    </div>
  );
}
