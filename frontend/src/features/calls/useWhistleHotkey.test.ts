import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVoiceStore } from '../../stores/voiceStore';
import { useWhistleHotkey } from './useWhistleHotkey';

const { mockStartWhistle, mockStopWhistle } = vi.hoisted(() => ({
  mockStartWhistle: vi.fn(),
  mockStopWhistle: vi.fn(),
}));

vi.mock('../../services/voiceClient', () => ({
  voiceClient: { startWhistle: mockStartWhistle, stopWhistle: mockStopWhistle },
}));

function dispatchKey(type: 'keydown' | 'keyup', key: string, options: Partial<KeyboardEventInit> = {}) {
  window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, ...options }));
}

describe('useWhistleHotkey', () => {
  beforeEach(() => {
    mockStartWhistle.mockClear();
    mockStopWhistle.mockClear();
    useVoiceStore.setState({ armedWhistleTarget: null });
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });

  it('starts whistling to the armed target when W is pressed', () => {
    useVoiceStore.setState({ armedWhistleTarget: 'bob' });
    renderHook(() => useWhistleHotkey());

    dispatchKey('keydown', 'w');

    expect(mockStartWhistle).toHaveBeenCalledWith('bob');
  });

  it('is case-insensitive', () => {
    useVoiceStore.setState({ armedWhistleTarget: 'bob' });
    renderHook(() => useWhistleHotkey());

    dispatchKey('keydown', 'W');

    expect(mockStartWhistle).toHaveBeenCalledWith('bob');
  });

  it('does nothing when no target is armed', () => {
    renderHook(() => useWhistleHotkey());

    dispatchKey('keydown', 'w');

    expect(mockStartWhistle).not.toHaveBeenCalled();
  });

  it('does nothing for an unrelated key', () => {
    useVoiceStore.setState({ armedWhistleTarget: 'bob' });
    renderHook(() => useWhistleHotkey());

    dispatchKey('keydown', 'a');

    expect(mockStartWhistle).not.toHaveBeenCalled();
  });

  it('ignores OS key-repeat, so holding the key does not re-trigger start', () => {
    useVoiceStore.setState({ armedWhistleTarget: 'bob' });
    renderHook(() => useWhistleHotkey());

    dispatchKey('keydown', 'w');
    dispatchKey('keydown', 'w', { repeat: true });

    expect(mockStartWhistle).toHaveBeenCalledTimes(1);
  });

  it('does not start while typing in a text input', () => {
    useVoiceStore.setState({ armedWhistleTarget: 'bob' });
    renderHook(() => useWhistleHotkey());
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true }));

    expect(mockStartWhistle).not.toHaveBeenCalled();
    input.remove();
  });

  it('stops whistling when W is released', () => {
    renderHook(() => useWhistleHotkey());

    dispatchKey('keyup', 'w');

    expect(mockStopWhistle).toHaveBeenCalled();
  });

  it('stops whistling on window blur', () => {
    renderHook(() => useWhistleHotkey());

    window.dispatchEvent(new Event('blur'));

    expect(mockStopWhistle).toHaveBeenCalled();
  });

  it('stops whistling when the tab is hidden', () => {
    renderHook(() => useWhistleHotkey());

    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(mockStopWhistle).toHaveBeenCalled();
  });

  it('does not stop when visibilitychange fires while the tab is visible', () => {
    renderHook(() => useWhistleHotkey());

    document.dispatchEvent(new Event('visibilitychange'));

    expect(mockStopWhistle).not.toHaveBeenCalled();
  });

  it('removes its listeners on unmount', () => {
    useVoiceStore.setState({ armedWhistleTarget: 'bob' });
    const { unmount } = renderHook(() => useWhistleHotkey());
    unmount();

    dispatchKey('keydown', 'w');
    window.dispatchEvent(new Event('blur'));

    expect(mockStartWhistle).not.toHaveBeenCalled();
    expect(mockStopWhistle).not.toHaveBeenCalled();
  });
});
