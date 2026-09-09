import { useState } from 'react';
import { voiceClient } from '../../../services/voiceClient';
import { getNoiseSuppressionPreference, setNoiseSuppressionPreference } from './noiseSuppressionPreference';

export function AudioSettingsSection() {
  const [enabled, setEnabled] = useState(getNoiseSuppressionPreference);

  function handleChange(next: boolean) {
    setEnabled(next);
    setNoiseSuppressionPreference(next);
    void voiceClient.setNoiseSuppressionEnabled(next);
  }

  return (
    <section className="space-y-4">
      <h2 className="text-heading font-medium text-ink">Audio</h2>
      <label className="flex items-center gap-2 text-body text-ink">
        <input type="checkbox" checked={enabled} onChange={(event) => handleChange(event.target.checked)} />
        Suppress background noise
      </label>
    </section>
  );
}
