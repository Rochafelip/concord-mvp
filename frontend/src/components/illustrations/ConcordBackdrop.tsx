import { useId } from 'react';

interface ConcordBackdropProps {
  className?: string;
}

export function ConcordBackdrop({ className = '' }: ConcordBackdropProps) {
  const uid = useId();
  const violetId = `concord-backdrop-violet-${uid}`;
  const coralId = `concord-backdrop-coral-${uid}`;

  return (
    <svg
      viewBox="0 0 400 400"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className={`pointer-events-none ${className}`}
    >
      <defs>
        <radialGradient id={violetId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" style={{ stopColor: 'rgb(var(--color-brand))' }} stopOpacity="0.35" />
          <stop offset="100%" style={{ stopColor: 'rgb(var(--color-brand))' }} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={coralId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" style={{ stopColor: 'rgb(var(--color-accent))' }} stopOpacity="0.3" />
          <stop offset="100%" style={{ stopColor: 'rgb(var(--color-accent))' }} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="110" cy="100" r="180" fill={`url(#${violetId})`} />
      <circle cx="300" cy="320" r="200" fill={`url(#${coralId})`} />
    </svg>
  );
}
