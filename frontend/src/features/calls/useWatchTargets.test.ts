import { act, renderHook } from '@testing-library/react';
import { ConnectionQuality } from 'livekit-client';
import { describe, expect, it, vi } from 'vitest';
import type { VoiceParticipant } from '../../types/voice';
import { useWatchTargets } from './useWatchTargets';

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

describe('useWatchTargets', () => {
  it('resolves to an empty array when there are no shares and nothing manually watched', () => {
    const { result } = renderHook(() => useWatchTargets([participant({ identity: 'u1' })]));

    expect(result.current.watchTargets).toEqual([]);
    expect(result.current.isManual).toBe(false);
  });

  it('auto-watches the only sharing participant when nothing is manual', () => {
    const track = { attach: vi.fn(), detach: vi.fn() } as never;
    const participants = [participant({ identity: 'u1' }), participant({ identity: 'u2', screenShareTrack: track })];
    const { result } = renderHook(() => useWatchTargets(participants));

    expect(result.current.watchTargets).toEqual([{ type: 'share', identity: 'u2' }]);
    expect(result.current.isManual).toBe(false);
  });

  it('auto-watches only the first sharing participant by array order when several are sharing', () => {
    const track = { attach: vi.fn(), detach: vi.fn() } as never;
    const participants = [
      participant({ identity: 'u1', screenShareTrack: track }),
      participant({ identity: 'u2', screenShareTrack: track }),
    ];
    const { result } = renderHook(() => useWatchTargets(participants));

    expect(result.current.watchTargets).toEqual([{ type: 'share', identity: 'u1' }]);
  });

  it('addWatch seeds from the current auto default and appends the new target', () => {
    const track = { attach: vi.fn(), detach: vi.fn() } as never;
    const participants = [
      participant({ identity: 'u1', screenShareTrack: track }),
      participant({ identity: 'u2', screenShareTrack: track }),
    ];
    const { result } = renderHook(() => useWatchTargets(participants));

    act(() => result.current.addWatch({ type: 'share', identity: 'u2' }));

    expect(result.current.watchTargets).toEqual([
      { type: 'share', identity: 'u1' },
      { type: 'share', identity: 'u2' },
    ]);
    expect(result.current.isManual).toBe(true);
  });

  it('addWatch does not duplicate a target that is already watched', () => {
    const track = { attach: vi.fn(), detach: vi.fn() } as never;
    const participants = [participant({ identity: 'u1', screenShareTrack: track })];
    const { result } = renderHook(() => useWatchTargets(participants));

    act(() => result.current.addWatch({ type: 'share', identity: 'u1' }));

    expect(result.current.watchTargets).toEqual([{ type: 'share', identity: 'u1' }]);
  });

  it('removeWatch on the only auto-watched share results in an empty set, not a snap-back to auto', () => {
    const track = { attach: vi.fn(), detach: vi.fn() } as never;
    const participants = [participant({ identity: 'u1', screenShareTrack: track })];
    const { result } = renderHook(() => useWatchTargets(participants));

    act(() => result.current.removeWatch({ type: 'share', identity: 'u1' }));

    expect(result.current.watchTargets).toEqual([]);
    expect(result.current.isManual).toBe(true);
  });

  it('removeWatch drops just the given target, keeping the rest of a multi-watch set', () => {
    const track = { attach: vi.fn(), detach: vi.fn() } as never;
    const participants = [
      participant({ identity: 'u1', screenShareTrack: track }),
      participant({ identity: 'u2', screenShareTrack: track }),
    ];
    const { result } = renderHook(() => useWatchTargets(participants));
    act(() => result.current.addWatch({ type: 'share', identity: 'u2' }));

    act(() => result.current.removeWatch({ type: 'share', identity: 'u1' }));

    expect(result.current.watchTargets).toEqual([{ type: 'share', identity: 'u2' }]);
  });

  it('drops a manual entry whose participant becomes invalid (camera turned off), keeping valid ones', () => {
    const track = { attach: vi.fn(), detach: vi.fn() } as never;
    const { result, rerender } = renderHook(({ participants }) => useWatchTargets(participants), {
      initialProps: {
        participants: [
          participant({ identity: 'u1', cameraEnabled: true }),
          participant({ identity: 'u2', screenShareTrack: track }),
        ],
      },
    });

    act(() => result.current.addWatch({ type: 'camera', identity: 'u1' }));
    expect(result.current.watchTargets).toEqual([
      { type: 'share', identity: 'u2' },
      { type: 'camera', identity: 'u1' },
    ]);

    rerender({
      participants: [
        participant({ identity: 'u1', cameraEnabled: false }),
        participant({ identity: 'u2', screenShareTrack: track }),
      ],
    });

    expect(result.current.watchTargets).toEqual([{ type: 'share', identity: 'u2' }]);
    expect(result.current.isManual).toBe(true);
  });

  it('drops a manual entry whose participant left the call entirely', () => {
    const { result, rerender } = renderHook(({ participants }) => useWatchTargets(participants), {
      initialProps: {
        participants: [
          participant({ identity: 'u1', cameraEnabled: true }),
          participant({ identity: 'u2', cameraEnabled: true }),
        ],
      },
    });

    act(() => result.current.addWatch({ type: 'camera', identity: 'u2' }));
    expect(result.current.watchTargets).toEqual([{ type: 'camera', identity: 'u2' }]);

    rerender({ participants: [participant({ identity: 'u1', cameraEnabled: true })] });

    expect(result.current.watchTargets).toEqual([]);
    expect(result.current.isManual).toBe(true);
  });

  it('clearManual returns to the pure automatic default', () => {
    const track = { attach: vi.fn(), detach: vi.fn() } as never;
    const participants = [
      participant({ identity: 'u1', cameraEnabled: true }),
      participant({ identity: 'u2', screenShareTrack: track }),
    ];
    const { result } = renderHook(() => useWatchTargets(participants));

    act(() => result.current.addWatch({ type: 'camera', identity: 'u1' }));
    act(() => result.current.clearManual());

    expect(result.current.watchTargets).toEqual([{ type: 'share', identity: 'u2' }]);
    expect(result.current.isManual).toBe(false);
  });
});
