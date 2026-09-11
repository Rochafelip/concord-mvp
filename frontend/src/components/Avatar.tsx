import { useState } from 'react';
import { ConcordMark } from './ConcordMark';

interface AvatarProps {
  displayName: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  loading?: boolean;
}

const SIZE_CLASSES = {
  sm: 'h-8 w-8 text-body',
  md: 'h-10 w-10 text-heading',
  lg: 'h-20 w-20 text-3xl',
} as const;

export function Avatar({ displayName, avatarUrl, size = 'sm', className = '', loading = false }: AvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const sizeClasses = SIZE_CLASSES[size];

  if (avatarUrl && failedUrl !== avatarUrl && !loading) {
    return (
      <img
        src={avatarUrl}
        alt={displayName}
        className={`${sizeClasses} rounded-full object-cover ${className}`}
        onError={() => setFailedUrl(avatarUrl)}
      />
    );
  }

  return (
    <div
      aria-label={displayName}
      className={`relative flex ${sizeClasses} items-center justify-center overflow-hidden rounded-full bg-brand font-medium text-white ${className}`}
    >
      <ConcordMark size={size === 'lg' ? 40 : size === 'md' ? 24 : 18} />
      {loading && <span className="absolute inset-0 animate-pulse rounded-full bg-white/20" aria-hidden="true" />}
    </div>
  );
}
