import { useEffect, useRef } from 'react';
import { useScreenSharePreview } from './useScreenSharePreview';

interface ScreenShareHoverPreviewProps {
  channelId: string;
  identity: string;
  displayName: string;
}

/**
 * Floating popover shown while hovering a screen-sharing participant in ChannelSidebar, for a
 * viewer who isn't in that voice channel — mirrors Discord's sidebar stream preview. Mounted only
 * while hovered (ChannelSidebar owns the hover-delay timing); connects its own read-only LiveKit
 * session for the lifetime of the mount via useScreenSharePreview, torn down again on unmount.
 */
export function ScreenShareHoverPreview({ channelId, identity, displayName }: ScreenShareHoverPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { status, track } = useScreenSharePreview(channelId, identity);

  useEffect(() => {
    const element = videoRef.current;
    if (!track || !element) return;
    track.attach(element);
    return () => {
      track.detach(element);
    };
  }, [track]);

  return (
    <div
      role="tooltip"
      aria-label={`${displayName}'s screen`}
      className="absolute left-full top-0 z-30 ml-2 flex h-36 w-64 items-center justify-center overflow-hidden rounded bg-gray-900 text-caption text-white/70 shadow-lg"
    >
      {status === 'ready' && (
        <video
          ref={videoRef}
          data-testid="screen-share-preview-video"
          muted
          autoPlay
          playsInline
          className="h-full w-full object-contain"
        />
      )}
      {status === 'connecting' && <span>Loading…</span>}
      {status === 'unavailable' && <span>Preview unavailable</span>}
    </div>
  );
}
