interface AvatarProps {
  displayName: string;
  avatarUrl?: string | null;
  className?: string;
}

export function Avatar({ displayName, avatarUrl, className = '' }: AvatarProps) {
  const initial = displayName.trim().charAt(0).toUpperCase() || '?';

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={displayName}
        className={`h-8 w-8 rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      aria-label={displayName}
      className={`flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-medium text-white ${className}`}
    >
      {initial}
    </div>
  );
}
