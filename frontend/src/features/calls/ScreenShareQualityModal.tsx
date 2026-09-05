import { useState } from 'react';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import type { ScreenShareQuality } from '../../types/voice';
import { getLastScreenShareQuality, setLastScreenShareQuality } from './screenShareQuality';

interface ScreenShareQualityModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (quality: ScreenShareQuality) => void;
}

/**
 * Shown before a screen share actually starts (see ParticipantTile), never while stopping one.
 * Mirrors CreateChannelModal's shape: shared Modal shell, a radio fieldset, Cancel/confirm
 * buttons. The last choice is read once as React state's lazy initializer and only written back
 * to storage on confirm, so canceling never overwrites a previously remembered preference.
 */
export function ScreenShareQualityModal({ open, onClose, onConfirm }: ScreenShareQualityModalProps) {
  const [quality, setQuality] = useState<ScreenShareQuality>(getLastScreenShareQuality);

  function handleConfirm() {
    setLastScreenShareQuality(quality);
    onConfirm(quality);
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="w-64 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Choose share quality</h2>

        <fieldset className="space-y-1">
          <legend className="text-sm font-medium text-gray-700">Quality</legend>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              name="screenShareQuality"
              value="hd"
              checked={quality === 'hd'}
              onChange={() => setQuality('hd')}
            />
            HD (720p)
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
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
