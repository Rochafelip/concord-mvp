import { act, renderHook } from '@testing-library/react';
import { ConnectionQuality } from 'livekit-client';
import { describe, expect, it, vi } from 'vitest';
import type { VoiceParticipant } from '../../types/voice';
import { useFocusTarget } from './useFocusTarget';

function participant(overrides: Partial<VoiceParticipant> = {}): VoiceParticipant {
  return {
    identity: 'u1',
    name: 'Felipe',
    isLocal: false,
    micEnabled: true,
    cameraEnabled: false,
    videoTrack: null,
    screenShareEnabled: false,
    screenShareTrack: null,
    screenShareHasAudio: false,
    screenShareAudioEnabled: false,
    connectionQuality: ConnectionQuality.Unknown,
    speaking: false,
    ...overrides,
  };
}

describe('useFocusTarget', () => {
  it('resolves to null when there are no shares and no pin', () => {
    const { result } = renderHook(() => useFocusTarget([participant({ identity: 'u1' })]));

    expect(result.current.focusTarget).toBeNull();
    expect(result.current.isManual).toBe(false);
  });

  it('auto-focuses the only sharing participant when there is no pin', () => {
    const track = { attach: vi.fn(), detach: vi.fn() } as never;
    const participants = [participant({ identity: 'u1' }), participant({ identity: 'u2', screenShareTrack: track })];
    const { result } = renderHook(() => useFocusTarget(participants));

    expect(result.current.focusTarget).toEqual({ type: 'share', identity: 'u2' });
    expect(result.current.isManual).toBe(false);
  });

  it('picks the first sharing participant by array order when several are sharing', () => {
    const track = { attach: vi.fn(), detach: vi.fn() } as never;
    const participants = [
      participant({ identity: 'u1', screenShareTrack: track }),
      participant({ identity: 'u2', screenShareTrack: track }),
    ];
    const { result } = renderHook(() => useFocusTarget(participants));

    expect(result.current.focusTarget).toEqual({ type: 'share', identity: 'u1' });
  });

  it('lets a manual pin override the auto-focused share', () => {
    const track = { attach: vi.fn(), detach: vi.fn() } as never;
    const participants = [
      participant({ identity: 'u1', cameraEnabled: true }),
      participant({ identity: 'u2', screenShareTrack: track }),
    ];
    const { result } = renderHook(() => useFocusTarget(participants));

    act(() => result.current.setFocus({ type: 'camera', identity: 'u1' }));

    expect(result.current.focusTarget).toEqual({ type: 'camera', identity: 'u1' });
    expect(result.current.isManual).toBe(true);
  });

  it('falls back to the auto-focused share once a manual camera pin becomes invalid (camera turned off)', () => {
    const track = { attach: vi.fn(), detach: vi.fn() } as never;
    const { result, rerender } = renderHook(({ participants }) => useFocusTarget(participants), {
      initialProps: {
        participants: [
          participant({ identity: 'u1', cameraEnabled: true }),
          participant({ identity: 'u2', screenShareTrack: track }),
        ],
      },
    });

    act(() => result.current.setFocus({ type: 'camera', identity: 'u1' }));
    expect(result.current.focusTarget).toEqual({ type: 'camera', identity: 'u1' });

    rerender({
      participants: [
        participant({ identity: 'u1', cameraEnabled: false }),
        participant({ identity: 'u2', screenShareTrack: track }),
      ],
    });

    expect(result.current.focusTarget).toEqual({ type: 'share', identity: 'u2' });
    expect(result.current.isManual).toBe(false);
  });

  it('falls back to null once a manual share pin becomes invalid and nobody else is sharing', () => {
    const track = { attach: vi.fn(), detach: vi.fn() } as never;
    const { result, rerender } = renderHook(({ participants }) => useFocusTarget(participants), {
      initialProps: { participants: [participant({ identity: 'u1', screenShareTrack: track })] },
    });

    act(() => result.current.setFocus({ type: 'share', identity: 'u1' }));
    expect(result.current.focusTarget).toEqual({ type: 'share', identity: 'u1' });

    rerender({ participants: [participant({ identity: 'u1', screenShareTrack: null })] });

    expect(result.current.focusTarget).toBeNull();
    expect(result.current.isManual).toBe(false);
  });

  it('falls back once a manual pin becomes invalid because that participant left the call', () => {
    const { result, rerender } = renderHook(({ participants }) => useFocusTarget(participants), {
      initialProps: {
        participants: [
          participant({ identity: 'u1', cameraEnabled: true }),
          participant({ identity: 'u2', cameraEnabled: true }),
        ],
      },
    });

    act(() => result.current.setFocus({ type: 'camera', identity: 'u2' }));
    expect(result.current.focusTarget).toEqual({ type: 'camera', identity: 'u2' });

    rerender({ participants: [participant({ identity: 'u1', cameraEnabled: true })] });

    expect(result.current.focusTarget).toBeNull();
  });

  it('clearFocus returns to the automatic default', () => {
    const track = { attach: vi.fn(), detach: vi.fn() } as never;
    const participants = [
      participant({ identity: 'u1', cameraEnabled: true }),
      participant({ identity: 'u2', screenShareTrack: track }),
    ];
    const { result } = renderHook(() => useFocusTarget(participants));

    act(() => result.current.setFocus({ type: 'camera', identity: 'u1' }));
    act(() => result.current.clearFocus());

    expect(result.current.focusTarget).toEqual({ type: 'share', identity: 'u2' });
    expect(result.current.isManual).toBe(false);
  });
});
