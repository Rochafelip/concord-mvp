import { useId } from 'react';

interface ConcordMarkProps {
  size?: number;
  className?: string;
}

export function ConcordMark({ size = 24, className = '' }: ConcordMarkProps) {
  const uid = useId();
  const gradientId = `concord-seam-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="24" y1="8" x2="24" y2="40">
          <stop offset="0%" style={{ stopColor: 'rgb(var(--color-brand))' }} />
          <stop offset="40%" style={{ stopColor: 'rgb(var(--color-brand))' }} />
          <stop
            offset="50%"
            style={{ stopColor: 'color-mix(in srgb, rgb(var(--color-brand)), rgb(var(--color-accent)))' }}
          />
          <stop offset="60%" style={{ stopColor: 'rgb(var(--color-accent))' }} />
          <stop offset="100%" style={{ stopColor: 'rgb(var(--color-accent))' }} />
        </linearGradient>
      </defs>
      <path
        d="M8 24 A16 16 0 0 1 37.86 16"
        stroke={`url(#${gradientId})`}
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M37.86 32 A16 16 0 0 1 8 24"
        stroke={`url(#${gradientId})`}
        strokeWidth="8"
        strokeLinecap="round"
      />
    </svg>
  );
}
