import { useEffect } from 'react';
import { useCallPipStore } from '../../../stores/callPipStore';
import { useVoiceStatus } from '../hooks';

interface DocumentPictureInPictureApi {
  requestPictureInPicture(options?: { width?: number; height?: number }): Promise<Window>;
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPictureApi;
  }
}

const PIP_WIDTH = 320;
const PIP_HEIGHT = 240;

/**
 * Copies every same-origin stylesheet's rules (Tailwind's compiled CSS, injected by Vite) into
 * the PiP window's otherwise-empty document, plus the current light/dark theme attribute — the
 * pattern Chrome's own Document Picture-in-Picture documentation recommends. A cross-origin
 * sheet (the Google Fonts <link> in index.html) throws reading .cssRules under CORS, so it
 * falls back to copying the <link> itself instead of inlining rules it can't read.
 */
function copyStylesInto(pipWindow: Window) {
  pipWindow.document.documentElement.setAttribute(
    'data-theme',
    document.documentElement.getAttribute('data-theme') ?? 'light',
  );
  [...document.styleSheets].forEach((styleSheet) => {
    try {
      const cssText = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
      const style = pipWindow.document.createElement('style');
      style.textContent = cssText;
      pipWindow.document.head.appendChild(style);
    } catch {
      if (!styleSheet.href) return;
      const link = pipWindow.document.createElement('link');
      link.rel = 'stylesheet';
      link.href = styleSheet.href;
      pipWindow.document.head.appendChild(link);
    }
  });
}

/**
 * Wraps the Document Picture-in-Picture API. `pipWindow` lives in callPipStore (see its doc
 * comment) so VoiceConnectionBar and CallControlBar both react to the same open/closed state
 * without a parent/child relationship. VoiceConnectionBar — mounted once in AppShell, alive on
 * every route while connected — is the one that actually createPortals into the window;
 * CallControlBar only ever calls open().
 */
export function useCallPip() {
  const pipWindow = useCallPipStore((state) => state.pipWindow);
  const setPipWindow = useCallPipStore((state) => state.setPipWindow);
  const { status } = useVoiceStatus();
  const isSupported = typeof window !== 'undefined' && 'documentPictureInPicture' in window;

  // Nothing else on the "call ends" path (Leave button, kicked, disconnected) closes the PiP
  // window — this is the one place that has to.
  useEffect(() => {
    if (status !== 'connected' && pipWindow) {
      pipWindow.close();
      setPipWindow(null);
    }
  }, [status, pipWindow, setPipWindow]);

  async function open() {
    if (!window.documentPictureInPicture || pipWindow) return;
    const opened = await window.documentPictureInPicture.requestPictureInPicture({
      width: PIP_WIDTH,
      height: PIP_HEIGHT,
    });
    copyStylesInto(opened);
    opened.addEventListener('pagehide', () => setPipWindow(null), { once: true });
    setPipWindow(opened);
  }

  function close() {
    pipWindow?.close();
  }

  return { isSupported, pipWindow, open, close };
}
