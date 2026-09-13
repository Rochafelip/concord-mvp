import { MonitorUp } from 'lucide-react';

interface ScreenShareThumbnailProps {
  name: string;
  onClick: () => void;
}

export function ScreenShareThumbnail({
  name,
  onClick,
}: ScreenShareThumbnailProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Focus on ${name}'s screen`}
      className="flex h-24 w-40 min-w-40 flex-shrink-0 flex-col items-center justify-center gap-1 overflow-hidden rounded bg-gray-800 p-2 text-center hover:bg-gray-700"
    >
      <MonitorUp
        size={16}
        className="flex-shrink-0 text-gray-300"
        aria-hidden="true"
      />

      <span
        className="block min-w-0 max-w-full truncate text-caption text-gray-100"
        title={`${name}'s screen`}
      >
        {name}'s screen
      </span>
    </button>
  );
}
