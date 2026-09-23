import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { voiceClient } from '../../../services/voiceClient';
import * as api from './api';
import { useDmCallStore } from './dmCallStore';
import { IncomingCallModal } from './IncomingCallModal';
import { playRingtone, stopRingtone } from './ringtone';

vi.mock('./api', () => ({
  acceptCall: vi.fn(),
  declineCall: vi.fn(() => Promise.resolve()),
}));

vi.mock('./ringtone', () => ({
  playRingtone: vi.fn(),
  stopRingtone: vi.fn(),
}));

vi.mock('../../../services/voiceClient', () => ({
  voiceClient: { connect: vi.fn(() => Promise.resolve()) },
}));

const peer = { id: 'u2', displayName: 'Bob', avatarUrl: null };

describe('IncomingCallModal', () => {
  beforeEach(() => {
    useDmCallStore.setState({ status: 'idle', callId: null, role: null, peer: null });
    vi.mocked(playRingtone).mockClear();
    vi.mocked(stopRingtone).mockClear();
    vi.mocked(api.acceptCall).mockClear();
    vi.mocked(api.declineCall).mockClear();
    vi.mocked(voiceClient.connect).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when idle', () => {
    const { container } = render(<IncomingCallModal />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the caller and plays a ringtone when ringing-in', () => {
    useDmCallStore.getState().receiveInvite('call-1', peer);

    render(<IncomingCallModal />);

    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(playRingtone).toHaveBeenCalledTimes(1);
  });

  it('stops the ringtone on unmount', () => {
    useDmCallStore.getState().receiveInvite('call-1', peer);
    const { unmount } = render(<IncomingCallModal />);

    unmount();

    expect(stopRingtone).toHaveBeenCalledTimes(1);
  });

  it('accepting connects with the returned token and marks the store connected', async () => {
    vi.mocked(api.acceptCall).mockResolvedValue({ token: 'tok', url: 'wss://x', roomName: 'dm-call-x' });
    useDmCallStore.getState().receiveInvite('call-1', peer);
    const user = userEvent.setup();
    render(<IncomingCallModal />);

    await user.click(screen.getByRole('button', { name: 'Aceitar' }));

    expect(api.acceptCall).toHaveBeenCalledWith('call-1');
    expect(voiceClient.connect).toHaveBeenCalledWith(null, 'tok', 'wss://x');
    expect(useDmCallStore.getState().status).toBe('connected');
  });

  it('resets the store if accepting fails', async () => {
    vi.mocked(api.acceptCall).mockRejectedValue(new Error('gone'));
    useDmCallStore.getState().receiveInvite('call-1', peer);
    const user = userEvent.setup();
    render(<IncomingCallModal />);

    await user.click(screen.getByRole('button', { name: 'Aceitar' }));

    expect(useDmCallStore.getState().status).toBe('idle');
  });

  it('declining calls declineCall and resets the store immediately', async () => {
    useDmCallStore.getState().receiveInvite('call-1', peer);
    const user = userEvent.setup();
    render(<IncomingCallModal />);

    await user.click(screen.getByRole('button', { name: 'Recusar' }));

    expect(api.declineCall).toHaveBeenCalledWith('call-1');
    expect(useDmCallStore.getState().status).toBe('idle');
  });

  it('self-dismisses after 30s of no response', () => {
    vi.useFakeTimers();
    useDmCallStore.getState().receiveInvite('call-1', peer);
    render(<IncomingCallModal />);

    vi.advanceTimersByTime(30_000);

    expect(useDmCallStore.getState().status).toBe('idle');
  });
});
