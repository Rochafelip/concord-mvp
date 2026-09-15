import { Volume2, VolumeX } from 'lucide-react';
import { useState, type ChangeEvent } from 'react';

interface VolumeControlProps {
  /** Display name used only to build distinct aria-labels, e.g. "Bob" or "Bob's screen". */
  label: string;
  onVolumeChange: (volume: number) => void;
  /** Initial muted state. Defaults to false (matches prior behavior). ScreenShareTile passes
   * `true` so this control's displayed state matches the muted-by-default screen-share audio
   * (see docs/superpowers/specs/2026-09-08-screenshare-opt-in-watch-design.md) — mic volume
   * controls (ParticipantTile) don't pass it and keep defaulting to unmuted. */
  defaultMuted?: boolean;
}

/**
 * A small, self-contained local volume control: a mute toggle plus a 0-100% slider. Owns its own
 * volume/muted state — there is nowhere else it needs to live, since this never persists across
 * calls and each mounting participant tile gets a fresh instance anyway. Muting doesn't discard
 * the slider's remembered position; moving the slider while muted un-mutes automatically,
 * matching how OS volume mixers behave.
 */
export function VolumeControl({ label, onVolumeChange, defaultMuted = false }: VolumeControlProps) {
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(defaultMuted);

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
    <div className="group/volume-control relative flex items-center rounded bg-black/60 px-1.5 py-1">
      <button
        type="button"
        aria-label={muted ? `Unmute ${label} for you` : `Mute ${label} for you`}
        onClick={handleMuteToggle}
        className="flex h-5 w-5 items-center justify-center rounded text-white hover:bg-white/10"
      >
        {muted ? <VolumeX size={14} aria-hidden="true" /> : <Volume2 size={14} aria-hidden="true" />}
      </button>
      <input
        type="range"
        aria-label={`Volume for ${label}`}
        min={0}
        max={100}
        value={muted ? 0 : Math.round(volume * 100)}
        onChange={handleSliderChange}
        className="pointer-events-none absolute right-full mr-1 h-1 w-16 origin-right opacity-0 transition-opacity group-hover/volume-control:pointer-events-auto group-hover/volume-control:opacity-100 group-focus-within/volume-control:pointer-events-auto group-focus-within/volume-control:opacity-100"
      />
    </div>
  );
}
