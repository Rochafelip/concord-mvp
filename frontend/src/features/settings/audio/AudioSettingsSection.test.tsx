import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { voiceClient } from '../../../services/voiceClient';
import * as preference from './noiseSuppressionPreference';
import { AudioSettingsSection } from './AudioSettingsSection';

vi.mock('./noiseSuppressionPreference');
vi.mock('../../../services/voiceClient', () => ({
  voiceClient: { setNoiseSuppressionEnabled: vi.fn().mockResolvedValue(undefined) },
}));

describe('AudioSettingsSection', () => {
  beforeEach(() => {
    vi.mocked(preference.getNoiseSuppressionPreference).mockReturnValue(true);
    vi.mocked(preference.setNoiseSuppressionPreference).mockReset();
    vi.mocked(voiceClient.setNoiseSuppressionEnabled).mockClear();
  });

  it('renders checked when the stored preference is enabled', () => {
    render(<AudioSettingsSection />);

    expect(screen.getByRole('checkbox', { name: 'Suppress background noise' })).toBeChecked();
  });

  it('renders unchecked when the stored preference is disabled', () => {
    vi.mocked(preference.getNoiseSuppressionPreference).mockReturnValue(false);
    render(<AudioSettingsSection />);

    expect(screen.getByRole('checkbox', { name: 'Suppress background noise' })).not.toBeChecked();
  });

  it('persists the preference and applies it live when toggled off', async () => {
    const user = userEvent.setup();
    render(<AudioSettingsSection />);

    await user.click(screen.getByRole('checkbox', { name: 'Suppress background noise' }));

    expect(preference.setNoiseSuppressionPreference).toHaveBeenCalledWith(false);
    expect(voiceClient.setNoiseSuppressionEnabled).toHaveBeenCalledWith(false);
    expect(screen.getByRole('checkbox', { name: 'Suppress background noise' })).not.toBeChecked();
  });
});
