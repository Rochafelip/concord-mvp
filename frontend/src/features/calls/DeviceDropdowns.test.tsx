import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeviceStore } from '../../stores/deviceStore';
import { DeviceDropdowns } from './DeviceDropdowns';

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

function resetStore() {
  useDeviceStore.setState({
    cameras: [],
    microphones: [],
    speakers: [],
    selectedCameraId: null,
    selectedMicrophoneId: null,
    selectedSpeakerId: null,
    error: null,
  });
}

describe('DeviceDropdowns', () => {
  beforeEach(() => {
    resetStore();
  });

  it('renders a dropdown per non-empty device list with the current selection', () => {
    useDeviceStore.setState({
      cameras: [{ deviceId: 'cam-1', label: 'Integrated Camera' }],
      microphones: [
        { deviceId: 'mic-1', label: 'Internal Mic' },
        { deviceId: 'mic-2', label: 'USB Headset' },
      ],
      speakers: [{ deviceId: 'spk-1', label: 'Speakers' }],
      selectedCameraId: 'cam-1',
      selectedMicrophoneId: 'mic-2',
      selectedSpeakerId: 'spk-1',
    });

    render(<DeviceDropdowns />);

    expect(screen.getByRole('combobox', { name: 'Câmera' })).toHaveValue('cam-1');
    expect(screen.getByRole('combobox', { name: 'Microfone' })).toHaveValue('mic-2');
    expect(screen.getByRole('combobox', { name: 'Dispositivo de saída' })).toHaveValue('spk-1');
  });

  it('omits the camera dropdown entirely when there are no cameras', () => {
    useDeviceStore.setState({
      microphones: [{ deviceId: 'mic-1', label: 'Internal Mic' }],
      speakers: [{ deviceId: 'spk-1', label: 'Speakers' }],
    });

    render(<DeviceDropdowns />);

    expect(screen.queryByRole('combobox', { name: 'Câmera' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Microfone' })).toBeInTheDocument();
  });

  it('calls selectMicrophone when a different microphone is chosen', async () => {
    const user = userEvent.setup();
    useDeviceStore.setState({
      microphones: [
        { deviceId: 'mic-1', label: 'Internal Mic' },
        { deviceId: 'mic-2', label: 'USB Headset' },
      ],
      selectedMicrophoneId: 'mic-1',
    });
    render(<DeviceDropdowns />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Microfone' }), 'mic-2');

    expect(useDeviceStore.getState().selectedMicrophoneId).toBe('mic-2');
  });

  it.each([
    ['permission-denied', 'Permissão de câmera/microfone negada.'],
    ['not-found', 'Nenhum dispositivo encontrado.'],
    ['in-use', 'Dispositivo em uso por outro aplicativo.'],
    ['output-unsupported', 'Este navegador não suporta troca do dispositivo de saída de áudio.'],
    ['unknown', 'Não foi possível acessar os dispositivos de áudio/vídeo.'],
  ] as const)('renders the message for a "%s" error', (kind, expectedMessage) => {
    useDeviceStore.setState({ error: kind });

    render(<DeviceDropdowns />);

    expect(screen.getByRole('alert')).toHaveTextContent(expectedMessage);
  });

  it('renders no error banner when there is no error', () => {
    render(<DeviceDropdowns />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
