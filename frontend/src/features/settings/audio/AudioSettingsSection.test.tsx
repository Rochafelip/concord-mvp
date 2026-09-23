import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { voiceClient } from '../../../services/voiceClient';
import * as noiseSuppressionPreference from './noiseSuppressionPreference';
import * as micSensitivityPreference from './micSensitivityPreference';
import { AudioSettingsSection } from './AudioSettingsSection';

vi.mock('./noiseSuppressionPreference');
vi.mock('./micSensitivityPreference');
vi.mock('../../../services/voiceClient', () => ({
  voiceClient: {
    setNoiseSuppressionEnabled: vi.fn().mockResolvedValue(undefined),
    setMicSensitivity: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('AudioSettingsSection', () => {
  beforeEach(() => {
    vi.mocked(noiseSuppressionPreference.getNoiseSuppressionPreference).mockReturnValue(true);
    vi.mocked(noiseSuppressionPreference.setNoiseSuppressionPreference).mockReset();
    vi.mocked(micSensitivityPreference.getMicSensitivityEnabled).mockReturnValue(false);
    vi.mocked(micSensitivityPreference.getMicSensitivityThresholdDb).mockReturnValue(-50);
    vi.mocked(micSensitivityPreference.setMicSensitivityEnabled).mockReset();
    vi.mocked(micSensitivityPreference.setMicSensitivityThresholdDb).mockReset();
    vi.mocked(voiceClient.setNoiseSuppressionEnabled).mockClear();
    vi.mocked(voiceClient.setMicSensitivity).mockClear();
  });

  it('renders checked when the noise suppression preference is enabled', () => {
    render(<AudioSettingsSection />);

    expect(screen.getByRole('checkbox', { name: 'Suppress background noise' })).toBeChecked();
  });

  it('renders unchecked when the noise suppression preference is disabled', () => {
    vi.mocked(noiseSuppressionPreference.getNoiseSuppressionPreference).mockReturnValue(false);
    render(<AudioSettingsSection />);

    expect(screen.getByRole('checkbox', { name: 'Suppress background noise' })).not.toBeChecked();
  });

  it('persists the noise suppression preference and applies it live when toggled off', async () => {
    const user = userEvent.setup();
    render(<AudioSettingsSection />);

    await user.click(screen.getByRole('checkbox', { name: 'Suppress background noise' }));

    expect(noiseSuppressionPreference.setNoiseSuppressionPreference).toHaveBeenCalledWith(false);
    expect(voiceClient.setNoiseSuppressionEnabled).toHaveBeenCalledWith(false);
    expect(screen.getByRole('checkbox', { name: 'Suppress background noise' })).not.toBeChecked();
  });

  it('renders the sensitivity checkbox unchecked and the slider disabled by default', () => {
    render(<AudioSettingsSection />);

    expect(screen.getByRole('checkbox', { name: 'Enable microphone sensitivity' })).not.toBeChecked();
    expect(screen.getByRole('slider', { name: 'Microphone sensitivity threshold' })).toBeDisabled();
  });

  it('renders the slider enabled, at the stored threshold, when sensitivity is already enabled', () => {
    vi.mocked(micSensitivityPreference.getMicSensitivityEnabled).mockReturnValue(true);
    vi.mocked(micSensitivityPreference.getMicSensitivityThresholdDb).mockReturnValue(-30);
    render(<AudioSettingsSection />);

    const slider = screen.getByRole('slider', { name: 'Microphone sensitivity threshold' });
    expect(slider).not.toBeDisabled();
    expect(slider).toHaveValue('-30');
  });

  it('persists and applies the sensitivity toggle, and enables the slider', async () => {
    const user = userEvent.setup();
    render(<AudioSettingsSection />);

    await user.click(screen.getByRole('checkbox', { name: 'Enable microphone sensitivity' }));

    expect(micSensitivityPreference.setMicSensitivityEnabled).toHaveBeenCalledWith(true);
    expect(voiceClient.setMicSensitivity).toHaveBeenCalledWith(true, -50);
    expect(screen.getByRole('slider', { name: 'Microphone sensitivity threshold' })).not.toBeDisabled();
  });

  it('persists and applies the threshold when the slider changes', () => {
    vi.mocked(micSensitivityPreference.getMicSensitivityEnabled).mockReturnValue(true);
    render(<AudioSettingsSection />);

    fireEvent.change(screen.getByRole('slider', { name: 'Microphone sensitivity threshold' }), {
      target: { value: '-30' },
    });

    expect(micSensitivityPreference.setMicSensitivityThresholdDb).toHaveBeenCalledWith(-30);
    expect(voiceClient.setMicSensitivity).toHaveBeenCalledWith(true, -30);
  });
});
