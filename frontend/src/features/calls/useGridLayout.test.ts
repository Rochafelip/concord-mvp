import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useGridLayout } from './useGridLayout';

describe('useGridLayout', () => {
  it('centers a single tile, sized to fill available space', () => {
    const { result } = renderHook(() => useGridLayout(1));

    expect(result.current.containerClassName).toContain('items-center');
    expect(result.current.containerClassName).toContain('justify-center');
    expect(result.current.tileClassName).toContain('h-full');
  });

  it('splits two tiles evenly, stacking under the sm breakpoint', () => {
    const { result } = renderHook(() => useGridLayout(2));

    expect(result.current.containerClassName).toContain('flex-col');
    expect(result.current.containerClassName).toContain('sm:flex-row');
  });

  it('arranges 3 tiles in a 2x2 grid with the third centered on its own row', () => {
    const { result } = renderHook(() => useGridLayout(3));

    expect(result.current.containerClassName).toContain('grid-cols-2');
    expect(result.current.containerClassName).toContain('[&>:nth-child(3)]:col-span-2');
  });

  it('arranges 4 tiles in a plain 2x2 grid, with no third-child override', () => {
    const { result } = renderHook(() => useGridLayout(4));

    expect(result.current.containerClassName).toContain('grid-cols-2');
    expect(result.current.containerClassName).not.toContain('nth-child');
  });

  it.each([
    [5, 3],
    [9, 4],
    [16, 6],
  ])(
    'computes the column count for %i participants using the fallback 16:9 aspect ratio (jsdom never fires a ResizeObserver entry)',
    (count, expectedColumns) => {
      const { result } = renderHook(() => useGridLayout(count));

      expect(result.current.style).toEqual({ gridTemplateColumns: `repeat(${expectedColumns}, minmax(0, 1fr))` });
    },
  );

  it('clamps the column count to a maximum of 6 even for very large groups', () => {
    const { result } = renderHook(() => useGridLayout(100));

    expect(result.current.style).toEqual({ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' });
  });
});
