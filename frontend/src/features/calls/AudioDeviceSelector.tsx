import { Mic, Speaker, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AudioDevice {
  deviceId: string;
  label: string;
}

interface AudioDeviceSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AudioDeviceSelector({ isOpen, onClose }: AudioDeviceSelectorProps) {
  const [inputDevices, setInputDevices] = useState<AudioDevice[]>([]);
  const [outputDevices, setOutputDevices] = useState<AudioDevice[]>([]);
  const [selectedInput, setSelectedInput] = useState<string>('');
  const [selectedOutput, setSelectedOutput] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      loadDevices();
    }
  }, [isOpen]);

  async function loadDevices() {
    setError('');
    try {
      // Request permission first
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Get all devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const inputs = devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Microfone ${device.deviceId.slice(0, 8)}`
        }));
      
      const outputs = devices
        .filter(device => device.kind === 'audiooutput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Alto-falante ${device.deviceId.slice(0, 8)}`
        }));

      setInputDevices(inputs);
      setOutputDevices(outputs);

      // Get current devices from localStorage
      const savedInput = localStorage.getItem('preferredAudioInput');
      const savedOutput = localStorage.getItem('preferredAudioOutput');
      
      if (savedInput) setSelectedInput(savedInput);
      if (savedOutput) setSelectedOutput(savedOutput);
      
      // Set defaults if nothing saved
      if (inputs.length > 0 && !savedInput) setSelectedInput(inputs[0].deviceId);
      if (outputs.length > 0 && !savedOutput) setSelectedOutput(outputs[0].deviceId);
      
    } catch (err) {
      setError('Não foi possível acessar os dispositivos de áudio. Verifique as permissões.');
      console.error('Error loading audio devices:', err);
    }
  }

  async function handleInputChange(deviceId: string) {
    setSelectedInput(deviceId);
    localStorage.setItem('preferredAudioInput', deviceId);
    
    // Apply the change by reconnecting with new device
    // Note: This would require voiceClient to support device switching
    // For now, we just save the preference
  }

  async function handleOutputChange(deviceId: string) {
    setSelectedOutput(deviceId);
    localStorage.setItem('preferredAudioOutput', deviceId);
    
    // Apply output device change
    try {
      const audioElements = document.querySelectorAll('audio');
      audioElements.forEach((audio: HTMLAudioElement) => {
        audio.setSinkId(deviceId).catch(console.error);
      });
    } catch (err) {
      console.error('Error setting output device:', err);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-surface border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-title font-semibold text-ink">Dispositivos de Áudio</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded text-muted hover:text-ink"
            aria-label="Fechar"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded border border-warning/40 bg-warning/15 p-3 text-body text-ink">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Input Device Selection */}
          <div>
            <label className="mb-2 flex items-center gap-2 text-body font-medium text-ink">
              <Mic size={16} aria-hidden="true" />
              Microfone (Entrada)
            </label>
            {inputDevices.length === 0 ? (
              <p className="text-body text-muted">Nenhum dispositivo de entrada encontrado</p>
            ) : (
              <select
                value={selectedInput}
                onChange={(e) => handleInputChange(e.target.value)}
                className="w-full rounded border border-border bg-surface px-3 py-2 text-body text-ink"
              >
                {inputDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Output Device Selection */}
          <div>
            <label className="mb-2 flex items-center gap-2 text-body font-medium text-ink">
              <Speaker size={16} aria-hidden="true" />
              Alto-falante (Saída)
            </label>
            {outputDevices.length === 0 ? (
              <p className="text-body text-muted">Nenhum dispositivo de saída encontrado</p>
            ) : (
              <select
                value={selectedOutput}
                onChange={(e) => handleOutputChange(e.target.value)}
                className="w-full rounded border border-border bg-surface px-3 py-2 text-body text-ink"
              >
                {outputDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-border bg-surface px-4 py-2 text-body text-ink hover:bg-border/40"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                loadDevices();
                onClose();
              }}
              className="rounded bg-brand px-4 py-2 text-body text-white hover:bg-brand/90"
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
