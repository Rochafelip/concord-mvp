import { MonitorUp } from 'lucide-react';

interface ScreenShareThumbnailProps {
  name: string;
  onClick: () => void;
}

/**
 * A static, non-focused preview of someone's active screen share — no <video>, no track
 * subscription. Deliberately not "a small ScreenShareTile": showing live video for every
 * simultaneous share just to render a thumbnail would subscribe to tracks nobody chose to watch,
 * silently reintroducing the bandwidth/privacy cost that
 * docs/superpowers/specs/2026-09-08-screenshare-opt-in-watch-design.md avoided. See
 * docs/superpowers/specs/2026-09-09-call-focus-mode-design.md §5.
 */
export function ScreenShareThumbnail({ name, onClick }: ScreenShareThumbnailProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Focus on ${name}'s screen`}
      className="flex h-24 w-40 flex-shrink-0 flex-col items-center justify-center gap-1 rounded bg-gray-800 p-2 text-center hover:bg-gray-700"
    >
      <MonitorUp size={16} className="text-gray-300" aria-hidden="true" />
      <span className="truncate text-caption text-gray-100">{name}'s screen</span>
    </button>
  );
}
