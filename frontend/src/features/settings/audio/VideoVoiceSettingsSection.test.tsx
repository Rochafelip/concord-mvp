import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeviceStore } from '../../../stores/deviceStore';
import { VideoVoiceSettingsSection } from './VideoVoiceSettingsSection';

vi.mock('../../../services/deviceManager', () => ({
  refreshDevices: vi.fn().mockResolvedValue({ cameras: [], microphones: [], speakers: [], error: null }),
  getPreferred: vi.fn(() => null),
  setPreferred: vi.fn(),
  watchDeviceChanges: vi.fn(() => () => {}),
}));
vi.mock('../../../services/voiceClient', () => ({
  voiceClient: {
    isInCall: vi.fn(() => false),
    setCameraDevice: vi.fn().mockResolvedValue(undefined),
    setMicrophoneDevice: vi.fn().mockResolvedValue(undefined),
    setSpeakerDevice: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('VideoVoiceSettingsSection', () => {
  beforeEach(() => {
    vi.spyOn(useDeviceStore.getState(), 'refresh').mockClear().mockResolvedValue(undefined);
    useDeviceStore.setState({ cameras: [], microphones: [], speakers: [], error: null });
  });

  it('renders the section heading', () => {
    render(<VideoVoiceSettingsSection />);

    expect(screen.getByRole('heading', { name: 'Voz e Vídeo' })).toBeInTheDocument();
  });

  it('refreshes the device lists on mount', () => {
    render(<VideoVoiceSettingsSection />);

    expect(useDeviceStore.getState().refresh).toHaveBeenCalledTimes(1);
  });

  it('renders the shared device dropdowns content', () => {
    useDeviceStore.setState({ microphones: [{ deviceId: 'mic-1', label: 'Internal Mic' }] });
    render(<VideoVoiceSettingsSection />);

    expect(screen.getByRole('combobox', { name: 'Microfone' })).toBeInTheDocument();
  });
});
