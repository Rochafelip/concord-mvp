import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTheme } from './useTheme';

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('reads the theme already set on <html> by the anti-flash script', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('dark');
  });

  it('defaults to light when no data-theme attribute is present', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('light');
  });

  it('toggle() flips the theme, updates the DOM attribute, and persists to localStorage', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    const { result } = renderHook(() => useTheme());

    act(() => result.current.toggle());

    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('toggling twice returns to the original theme', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    const { result } = renderHook(() => useTheme());

    act(() => result.current.toggle());
    act(() => result.current.toggle());

    expect(result.current.theme).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });
});
