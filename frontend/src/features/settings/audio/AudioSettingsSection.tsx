import { useState } from 'react';
import { voiceClient } from '../../../services/voiceClient';
import { getNoiseSuppressionPreference, setNoiseSuppressionPreference } from './noiseSuppressionPreference';
import {
  MIC_SENSITIVITY_MAX_THRESHOLD_DB,
  MIC_SENSITIVITY_MIN_THRESHOLD_DB,
  getMicSensitivityEnabled,
  getMicSensitivityThresholdDb,
  setMicSensitivityEnabled,
  setMicSensitivityThresholdDb,
} from './micSensitivityPreference';

export function AudioSettingsSection() {
  const [enabled, setEnabled] = useState(getNoiseSuppressionPreference);
  const [gateEnabled, setGateEnabled] = useState(getMicSensitivityEnabled);
  const [gateThresholdDb, setGateThresholdDb] = useState(getMicSensitivityThresholdDb);

  function handleChange(next: boolean) {
    setEnabled(next);
    setNoiseSuppressionPreference(next);
    void voiceClient.setNoiseSuppressionEnabled(next);
  }

  function handleGateEnabledChange(next: boolean) {
    setGateEnabled(next);
    setMicSensitivityEnabled(next);
    void voiceClient.setMicSensitivity(next, gateThresholdDb);
  }

  function handleGateThresholdChange(next: number) {
    setGateThresholdDb(next);
    setMicSensitivityThresholdDb(next);
    void voiceClient.setMicSensitivity(gateEnabled, next);
  }

  return (
    <section className="space-y-4">
      <h2 className="text-heading font-medium text-ink">Audio</h2>
      <label className="flex items-center gap-2 text-body text-ink">
        <input type="checkbox" checked={enabled} onChange={(event) => handleChange(event.target.checked)} />
        Suppress background noise
      </label>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-body text-ink">
          <input
            type="checkbox"
            checked={gateEnabled}
            onChange={(event) => handleGateEnabledChange(event.target.checked)}
          />
          Enable microphone sensitivity
        </label>
        <input
          type="range"
          aria-label="Microphone sensitivity threshold"
          min={MIC_SENSITIVITY_MIN_THRESHOLD_DB}
          max={MIC_SENSITIVITY_MAX_THRESHOLD_DB}
          value={gateThresholdDb}
          disabled={!gateEnabled}
          onChange={(event) => handleGateThresholdChange(Number(event.target.value))}
        />
      </div>
    </section>
  );
}
