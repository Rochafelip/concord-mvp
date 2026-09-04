import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { voiceClient } from '../../services/voiceClient';
import { useVoiceStore } from '../../stores/voiceStore';
import { VoiceControls } from './VoiceControls';

vi.mock('../../services/voiceClient', () => ({
  voiceClient: {
    toggleMute: vi.fn(),
    toggleCamera: vi.fn(),
    disconnect: vi.fn(),
  },
}));

function renderControls() {
  return render(
    <MemoryRouter initialEntries={['/app/servers/s1/channels/c1']}>
      <Routes>
        <Route path="/app/servers/:serverId" element={<div>No channel selected</div>} />
        <Route path="/app/servers/:serverId/channels/:channelId" element={<VoiceControls />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('VoiceControls', () => {
  beforeEach(() => {
    vi.mocked(voiceClient.toggleMute).mockClear();
    vi.mocked(voiceClient.toggleCamera).mockClear();
    vi.mocked(voiceClient.disconnect).mockClear();
    useVoiceStore.setState({
      status: 'connected',
      channelId: 'c1',
      participants: [
        { identity: 'me', name: 'Me', isLocal: true, micEnabled: true, cameraEnabled: false, videoTrack: null },
      ],
      error: null,
    });
  });

  it('shows a mute affordance when the local mic is on and calls toggleMute on click', async () => {
    const user = userEvent.setup();
    renderControls();

    const button = screen.getByRole('button', { name: /mute/i });
    await user.click(button);

    expect(voiceClient.toggleMute).toHaveBeenCalledTimes(1);
  });

  it('shows an unmute affordance when the local mic is off', () => {
    useVoiceStore.setState({
      participants: [
        { identity: 'me', name: 'Me', isLocal: true, micEnabled: false, cameraEnabled: false, videoTrack: null },
      ],
    });
    renderControls();

    expect(screen.getByRole('button', { name: /unmute/i })).toBeInTheDocument();
  });

  it('shows a "camera on" affordance when the local camera is off and calls toggleCamera on click', async () => {
    const user = userEvent.setup();
    renderControls();

    const button = screen.getByRole('button', { name: /camera on/i });
    await user.click(button);

    expect(voiceClient.toggleCamera).toHaveBeenCalledTimes(1);
  });

  it('shows a "camera off" affordance when the local camera is on', () => {
    useVoiceStore.setState({
      participants: [
        { identity: 'me', name: 'Me', isLocal: true, micEnabled: true, cameraEnabled: true, videoTrack: null },
      ],
    });
    renderControls();

    expect(screen.getByRole('button', { name: /camera off/i })).toBeInTheDocument();
  });

  it('leaves the call and navigates back to the server on click', async () => {
    const user = userEvent.setup();
    renderControls();

    await user.click(screen.getByRole('button', { name: /leave/i }));

    expect(voiceClient.disconnect).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('No channel selected')).toBeInTheDocument();
  });
});
