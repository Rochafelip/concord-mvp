import { Camera, Mic, Speaker } from 'lucide-react';
import { ErrorBanner } from '../../components/ErrorBanner';
import type { DeviceError } from '../../stores/deviceStore';
import { useDeviceStore } from '../../stores/deviceStore';

const ERROR_MESSAGES: Record<DeviceError, string> = {
  'permission-denied': 'Permissão de câmera/microfone negada.',
  'not-found': 'Nenhum dispositivo encontrado.',
  'in-use': 'Dispositivo em uso por outro aplicativo.',
  'output-unsupported': 'Este navegador não suporta troca do dispositivo de saída de áudio.',
  unknown: 'Não foi possível acessar os dispositivos de áudio/vídeo.',
};

const SELECT_CLASSNAME = 'w-full rounded border border-border bg-surface px-3 py-2 text-body text-ink';
const LABEL_CLASSNAME = 'mb-2 flex items-center gap-2 text-body font-medium text-ink';

/**
 * Presentational device dropdowns shared by the in-call modal (DeviceSettingsPanel) and the
 * "Voz e Vídeo" Settings section — both wrap this same markup instead of duplicating it. Reads
 * and writes useDeviceStore directly rather than taking props, since every consumer needs the
 * exact same behavior with no variation.
 */
export function DeviceDropdowns() {
  const {
    cameras,
    microphones,
    speakers,
    selectedCameraId,
    selectedMicrophoneId,
    selectedSpeakerId,
    error,
    selectCamera,
    selectMicrophone,
    selectSpeaker,
  } = useDeviceStore();

  return (
    <div className="space-y-6">
      {error && <ErrorBanner message={ERROR_MESSAGES[error]} />}

      {cameras.length > 0 && (
        <div>
          <label className={LABEL_CLASSNAME}>
            <Camera size={16} aria-hidden="true" />
            Câmera
          </label>
          <select
            aria-label="Câmera"
            value={selectedCameraId ?? ''}
            onChange={(event) => void selectCamera(event.target.value)}
            className={SELECT_CLASSNAME}
          >
            {cameras.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {microphones.length > 0 && (
        <div>
          <label className={LABEL_CLASSNAME}>
            <Mic size={16} aria-hidden="true" />
            Microfone
          </label>
          <select
            aria-label="Microfone"
            value={selectedMicrophoneId ?? ''}
            onChange={(event) => void selectMicrophone(event.target.value)}
            className={SELECT_CLASSNAME}
          >
            {microphones.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {speakers.length > 0 && (
        <div>
          <label className={LABEL_CLASSNAME}>
            <Speaker size={16} aria-hidden="true" />
            Dispositivo de saída
          </label>
          <select
            aria-label="Dispositivo de saída"
            value={selectedSpeakerId ?? ''}
            onChange={(event) => void selectSpeaker(event.target.value)}
            className={SELECT_CLASSNAME}
          >
            {speakers.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
