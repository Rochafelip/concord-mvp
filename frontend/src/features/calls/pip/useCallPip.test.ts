import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCallPipStore } from '../../../stores/callPipStore';
import { useVoiceStore } from '../../../stores/voiceStore';
import { useCallPip } from './useCallPip';

describe('useCallPip', () => {
  beforeEach(() => {
    useCallPipStore.setState({ pipWindow: null });
    useVoiceStore.setState({ status: 'disconnected', channelId: null });
    delete (window as { documentPictureInPicture?: unknown }).documentPictureInPicture;
  });

  it('reports unsupported when the browser has no documentPictureInPicture API', () => {
    const { result } = renderHook(() => useCallPip());

    expect(result.current.isSupported).toBe(false);
  });

  it('reports supported when the browser exposes the API', () => {
    (window as { documentPictureInPicture?: unknown }).documentPictureInPicture = {
      requestPictureInPicture: vi.fn(),
    };

    const { result } = renderHook(() => useCallPip());

    expect(result.current.isSupported).toBe(true);
  });

  it('close() is a no-op when no window is open', () => {
    const { result } = renderHook(() => useCallPip());

    expect(() => result.current.close()).not.toThrow();
  });

  it('closes an open pip window once the call stops being connected', () => {
    const fakeWindow = { close: vi.fn() } as unknown as Window;
    useVoiceStore.setState({ status: 'connected', channelId: 'c1' });
    useCallPipStore.setState({ pipWindow: fakeWindow });

    renderHook(() => useCallPip());
    act(() => {
      useVoiceStore.setState({ status: 'disconnected', channelId: null });
    });

    expect(fakeWindow.close).toHaveBeenCalledTimes(1);
    expect(useCallPipStore.getState().pipWindow).toBeNull();
  });
});
