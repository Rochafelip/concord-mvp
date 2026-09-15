import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeviceStore } from '../../stores/deviceStore';
import { DeviceSettingsPanel } from './DeviceSettingsPanel';

vi.mock('../../services/deviceManager', () => ({
  refreshDevices: vi.fn().mockResolvedValue({ cameras: [], microphones: [], speakers: [], error: null }),
  getPreferred: vi.fn(() => null),
  setPreferred: vi.fn(),
  watchDeviceChanges: vi.fn(() => () => {}),
}));
vi.mock('../../services/voiceClient', () => ({
  voiceClient: {
    isInCall: vi.fn(() => false),
    setCameraDevice: vi.fn().mockResolvedValue(undefined),
    setMicrophoneDevice: vi.fn().mockResolvedValue(undefined),
    setSpeakerDevice: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('DeviceSettingsPanel', () => {
  beforeEach(() => {
    vi.spyOn(useDeviceStore.getState(), 'refresh').mockClear().mockResolvedValue(undefined);
    useDeviceStore.setState({ cameras: [], microphones: [], speakers: [], error: null });
  });

  it('renders nothing when closed', () => {
    render(<DeviceSettingsPanel isOpen={false} onClose={vi.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('refreshes the device lists when opened', () => {
    render(<DeviceSettingsPanel isOpen={true} onClose={vi.fn()} />);

    expect(useDeviceStore.getState().refresh).toHaveBeenCalledTimes(1);
  });

  it('renders the shared device dropdowns content', () => {
    useDeviceStore.setState({ microphones: [{ deviceId: 'mic-1', label: 'Internal Mic' }] });
    render(<DeviceSettingsPanel isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByRole('combobox', { name: 'Microfone' })).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DeviceSettingsPanel isOpen={true} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
