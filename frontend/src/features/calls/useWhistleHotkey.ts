import { useEffect } from 'react';
import { voiceClient } from '../../services/voiceClient';
import { useVoiceStore } from '../../stores/voiceStore';

const WHISTLE_KEY = 'w';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

/**
 * Push-to-hold trigger for the private whistle feature
 * (docs/superpowers/specs/2026-09-22-private-whistle-design.md): hold W while a participant tile
 * is hovered (ParticipantTile arms `voiceStore.armedWhistleTarget` on hover) to whistle to them.
 * Mounted once by CallView, so it's only active while actually in a call.
 *
 * stopWhistle() is safe to call unconditionally (a no-op when nothing is active), so every
 * cleanup trigger here just calls it rather than tracking whether a whistle is actually running.
 */
export function useWhistleHotkey(): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat) return;
      if (event.key.toLowerCase() !== WHISTLE_KEY) return;
      if (isTypingTarget(event.target)) return;
      const target = useVoiceStore.getState().armedWhistleTarget;
      if (!target) return;
      voiceClient.startWhistle(target);
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== WHISTLE_KEY) return;
      voiceClient.stopWhistle();
    }

    function handleBlur() {
      voiceClient.stopWhistle();
    }

    function handleVisibilityChange() {
      if (document.hidden) voiceClient.stopWhistle();
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
}
