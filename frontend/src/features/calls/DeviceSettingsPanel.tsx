import { X } from 'lucide-react';
import { useEffect } from 'react';
import { useDeviceStore } from '../../stores/deviceStore';
import { DeviceDropdowns } from './DeviceDropdowns';

interface DeviceSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * In-call modal for picking camera/microphone/speaker, opened from CallControlBar's gear icon.
 * Wraps the same DeviceDropdowns content the "Voz e Vídeo" Settings section renders inline (see
 * VideoVoiceSettingsSection.tsx) — this component only adds the modal chrome around it.
 */
export function DeviceSettingsPanel({ isOpen, onClose }: DeviceSettingsPanelProps) {
  const refresh = useDeviceStore((state) => state.refresh);

  useEffect(() => {
    if (isOpen) void refresh();
  }, [isOpen, refresh]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-label="Dispositivos" className="w-full max-w-md rounded-lg bg-surface border border-border p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-title font-semibold text-ink">Dispositivos</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded text-muted hover:text-ink"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <DeviceDropdowns />
      </div>
    </div>
  );
}
