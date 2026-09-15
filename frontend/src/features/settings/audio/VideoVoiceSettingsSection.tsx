import { useEffect } from 'react';
import { DeviceDropdowns } from '../../calls/DeviceDropdowns';
import { useDeviceStore } from '../../../stores/deviceStore';

/**
 * Settings-page counterpart to CallControlBar's DeviceSettingsPanel modal — same DeviceDropdowns
 * content, reachable outside of a call. Selecting a device here only persists the preference
 * (DeviceDropdowns/useDeviceStore only apply it live via voiceClient when isInCall() is true).
 */
export function VideoVoiceSettingsSection() {
  const refresh = useDeviceStore((state) => state.refresh);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section className="space-y-4">
      <h2 className="text-heading font-medium text-ink">Voz e Vídeo</h2>
      <DeviceDropdowns />
    </section>
  );
}
