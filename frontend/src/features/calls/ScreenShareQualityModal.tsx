import { useState } from 'react';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import type { ScreenShareFrameRate, ScreenShareOptions, ScreenShareQuality } from '../../types/voice';
import {
  getLastScreenShareAudioPreference,
  getLastScreenShareFrameRate,
  getLastScreenShareQuality,
  setLastScreenShareAudioPreference,
  setLastScreenShareFrameRate,
  setLastScreenShareQuality,
} from './screenShareQuality';

interface ScreenShareQualityModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (options: ScreenShareOptions) => void;
}

/**
 * Shown before a screen share actually starts (see ParticipantTile), never while stopping one.
 * Mirrors CreateChannelModal's shape: shared Modal shell, radio fieldsets, Cancel/confirm
 * buttons. All choices are read once as React state's lazy initializer and only written back to
 * storage on confirm, so canceling never overwrites a previously remembered preference.
 */
export function ScreenShareQualityModal({ open, onClose, onConfirm }: ScreenShareQualityModalProps) {
  const [quality, setQuality] = useState<ScreenShareQuality>(getLastScreenShareQuality);
  const [frameRate, setFrameRate] = useState<ScreenShareFrameRate>(getLastScreenShareFrameRate);
  const [withAudio, setWithAudio] = useState<boolean>(getLastScreenShareAudioPreference);

  function handleConfirm() {
    setLastScreenShareQuality(quality);
    setLastScreenShareFrameRate(frameRate);
    setLastScreenShareAudioPreference(withAudio);
    onConfirm({ quality, frameRate, withAudio });
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="w-64 space-y-4">
        <h2 className="text-heading font-semibold text-ink">Share your screen</h2>

        <fieldset className="space-y-1">
          <legend className="text-body font-medium text-muted">Quality</legend>
          <label className="flex items-center gap-2 text-body text-muted">
            <input
              type="radio"
              name="screenShareQuality"
              value="hd"
              checked={quality === 'hd'}
              onChange={() => setQuality('hd')}
            />
            HD (720p)
          </label>
          <label className="flex items-center gap-2 text-body text-muted">
            <input
              type="radio"
              name="screenShareQuality"
              value="fhd"
              checked={quality === 'fhd'}
              onChange={() => setQuality('fhd')}
            />
            FHD (1080p)
          </label>
        </fieldset>

        <fieldset className="space-y-1">
          <legend className="text-body font-medium text-muted">Frame rate</legend>
          <label className="flex items-center gap-2 text-body text-muted">
            <input
              type="radio"
              name="screenShareFrameRate"
              value="30"
              checked={frameRate === 30}
              onChange={() => setFrameRate(30)}
            />
            30 fps (steadier, less bandwidth)
          </label>
          <label className="flex items-center gap-2 text-body text-muted">
            <input
              type="radio"
              name="screenShareFrameRate"
              value="60"
              checked={frameRate === 60}
              onChange={() => setFrameRate(60)}
            />
            60 fps (more fluid motion)
          </label>
        </fieldset>

        <label className="flex items-center gap-2 text-body text-muted">
          <input type="checkbox" checked={withAudio} onChange={(event) => setWithAudio(event.target.checked)} />
          Share system/tab audio
        </label>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm}>
            Share
          </Button>
        </div>
      </div>
    </Modal>
  );
}
