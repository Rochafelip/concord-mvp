import { Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';

interface VolumeControlProps {
  /** Display name used only to build distinct aria-labels, e.g. "Bob" or "Bob's screen". */
  label: string;
  onVolumeChange: (volume: number) => void;
  /** The level this control opens at, 0-1. Callers read it back from voiceClient, which
   * remembers it for the whole call — see the component comment below. 0 opens muted, which is
   * how ScreenShareTile renders a share nobody has turned up yet (see
   * docs/superpowers/specs/2026-09-08-screenshare-opt-in-watch-design.md). Defaults to 1, so a
   * source nobody has touched starts at full volume. */
  initialVolume?: number;
}

/**
 * A small, self-contained local volume control: a speaker icon that opens a vertical slider
 * popover, plus a mute toggle inside it — the same shape as the OS volume mixer flyouts this
 * mirrors. Muting doesn't discard the slider's remembered position; moving the slider while
 * muted un-mutes automatically, matching how those flyouts behave too.
 *
 * The *working* volume is component state, but the level a listener settled on is not: it
 * belongs to the call, and this control is mounted and unmounted several times during one.
 * ParticipantList swaps ParticipantGrid for FocusedCallView the moment anyone starts sharing a
 * screen, which remounts every tile below it, and a tile also remounts moving between the
 * watched area and FocusableStrip. With the level held only here, each of those remounts
 * resurfaced the slider at 100% over audio that was still attenuated — the UI half of the bug
 * 262415b fixed for the audio elements themselves. So callers pass the remembered level in via
 * `initialVolume` (from voiceClient.getParticipantVolume/getScreenShareVolume) and this seeds
 * its state from that instead of from a hardcoded default.
 *
 * Seeding, not syncing: `initialVolume` is read once per mount, so a later change to it does not
 * yank the slider out from under a listener who is mid-drag. voiceClient is already the only
 * writer, and it learns of every change through onVolumeChange, so the two cannot drift.
 */
export function VolumeControl({ label, onVolumeChange, initialVolume = 1 }: VolumeControlProps) {
  // A level of 0 means muted, and mute must keep a non-zero position to restore to — otherwise
  // un-muting a source that opened silent would restore it to silence.
  const [volume, setVolume] = useState(initialVolume === 0 ? 1 : initialVolume);
  const [muted, setMuted] = useState(initialVolume === 0);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function handleSliderChange(event: ChangeEvent<HTMLInputElement>) {
    const nextVolume = Number(event.target.value) / 100;
    setVolume(nextVolume);
    setMuted(false);
    onVolumeChange(nextVolume);
  }

  function handleMuteToggle() {
    const nextMuted = !muted;
    setMuted(nextMuted);
    onVolumeChange(nextMuted ? 0 : volume);
  }

  return (
    <div ref={containerRef} className="relative flex items-center rounded bg-black/60 px-1.5 py-1">
      <button
        type="button"
        aria-label={`Volume for ${label}`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-5 w-5 items-center justify-center rounded text-white hover:bg-white/10"
      >
        {muted ? <VolumeX size={14} aria-hidden="true" /> : <Volume2 size={14} aria-hidden="true" />}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={`Volume for ${label}`}
          className="absolute left-1/2 top-full z-10 mt-1 flex -translate-x-1/2 flex-col items-center gap-1.5 rounded bg-black/80 px-1.5 py-2 shadow-lg"
        >
          {/* The range input keeps its native horizontal layout box (w-16 h-1) so browsers still
              render and drag it correctly; centering it absolutely inside a slim, tall wrapper
              and rotating it -90deg is what turns it into a vertical slider without a custom
              slider implementation. */}
          <div className="relative h-20 w-6">
            <input
              type="range"
              aria-label={`Volume for ${label}`}
              min={0}
              max={100}
              value={muted ? 0 : Math.round(volume * 100)}
              onChange={handleSliderChange}
              className="absolute left-1/2 top-1/2 h-1 w-16 -translate-x-1/2 -translate-y-1/2 -rotate-90"
            />
          </div>
          <button
            type="button"
            aria-label={muted ? `Unmute ${label} for you` : `Mute ${label} for you`}
            onClick={handleMuteToggle}
            className="flex h-5 w-5 items-center justify-center rounded text-white hover:bg-white/10"
          >
            {muted ? <VolumeX size={14} aria-hidden="true" /> : <Volume2 size={14} aria-hidden="true" />}
          </button>
        </div>
      )}
    </div>
  );
}
