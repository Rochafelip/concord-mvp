import { useState, type ChangeEvent } from 'react';

interface VolumeControlProps {
  /** Display name used only to build distinct aria-labels, e.g. "Bob" or "Bob's screen". */
  label: string;
  onVolumeChange: (volume: number) => void;
}

/**
 * A small, self-contained local volume control: a mute toggle plus a 0-100% slider. Owns its own
 * volume/muted state — there is nowhere else it needs to live, since this never persists across
 * calls and each mounting participant tile gets a fresh instance anyway. Muting doesn't discard
 * the slider's remembered position; moving the slider while muted un-mutes automatically,
 * matching how OS volume mixers behave.
 */
export function VolumeControl({ label, onVolumeChange }: VolumeControlProps) {
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

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
    <div className="flex items-center gap-1 rounded bg-black/60 px-1.5 py-1">
      <button
        type="button"
        aria-label={muted ? `Unmute ${label} for you` : `Mute ${label} for you`}
        onClick={handleMuteToggle}
        className="text-xs leading-none text-white"
      >
        {muted ? '🔇' : '🔊'}
      </button>
      <input
        type="range"
        aria-label={`Volume for ${label}`}
        min={0}
        max={100}
        value={muted ? 0 : Math.round(volume * 100)}
        onChange={handleSliderChange}
        className="h-1 w-16"
      />
    </div>
  );
}
