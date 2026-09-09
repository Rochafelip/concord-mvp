interface AvatarProps {
  displayName: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'h-8 w-8 text-body',
  md: 'h-10 w-10 text-heading',
  lg: 'h-20 w-20 text-3xl',
} as const;

export function Avatar({ displayName, avatarUrl, size = 'sm', className = '' }: AvatarProps) {
  const initial = displayName.trim().charAt(0).toUpperCase() || '?';
  const sizeClasses = SIZE_CLASSES[size];

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={displayName}
        className={`${sizeClasses} rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      aria-label={displayName}
      className={`flex ${sizeClasses} items-center justify-center rounded-full bg-brand font-medium text-white ${className}`}
    >
      {initial}
    </div>
  );
}
