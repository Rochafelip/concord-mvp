import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';

export interface GridLayout {
  containerRef: RefObject<HTMLDivElement | null>;
  containerClassName: string;
  tileClassName: string;
  style: CSSProperties;
}

const MIN_COLUMNS = 2;
const MAX_COLUMNS = 6;
const FALLBACK_ASPECT_RATIO = 16 / 9;

/**
 * Computes the camera grid's layout for the given camera-on participant count, per the tiers in
 * docs/superpowers/specs/2026-09-09-call-grid-layout-design.md §1: 1 (single centered tile), 2
 * (even split, stacked under `sm`), 3-4 (2x2, with 3 centering its last tile on its own row), 5+
 * (column count derived from the container's aspect ratio via ResizeObserver, so it adapts as the
 * window resizes — jsdom's ResizeObserver stub never actually fires the callback, so tests only
 * exercise the fallback 16:9 aspect ratio; real resize behavior is verified manually).
 */
export function useGridLayout(count: number): GridLayout {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (count <= 1) {
    return {
      containerRef,
      containerClassName: 'flex min-h-0 min-w-0 items-center justify-center',
      tileClassName: 'h-full min-h-0 min-w-0 w-full max-w-4xl',
      style: {},
    };
  }

  if (count === 2) {
    return {
      containerRef,
      containerClassName: 'flex min-h-0 min-w-0 flex-col items-center justify-center gap-2 sm:flex-row',
      tileClassName: 'min-h-0 min-w-0 max-h-full max-w-full flex-1',
      style: {},
    };
  }

  if (count <= 4) {
    return {
      containerRef,
      containerClassName:
        count === 3
          ? 'grid min-h-0 min-w-0 grid-cols-2 grid-rows-[repeat(2,minmax(0,1fr))] gap-2 [&>:nth-child(3)]:col-span-2 [&>:nth-child(3)]:mx-auto [&>:nth-child(3)]:w-1/2'
          : 'grid min-h-0 min-w-0 grid-cols-2 grid-rows-[repeat(2,minmax(0,1fr))] gap-2',
      tileClassName: 'h-full min-h-0 min-w-0 w-full',
      style: {},
    };
  }

  const aspect = size.height > 0 ? size.width / size.height : FALLBACK_ASPECT_RATIO;
  const columns = Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, Math.ceil(Math.sqrt(count * aspect))));

  return {
    containerRef,
    containerClassName: 'grid min-h-0 min-w-0 auto-rows-[minmax(0,1fr)] gap-2',
    tileClassName: 'h-full min-h-0 min-w-0 w-full',
    style: { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` },
  };
}
