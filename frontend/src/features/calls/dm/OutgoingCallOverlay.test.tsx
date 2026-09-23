import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from './api';
import { useDmCallStore } from './dmCallStore';
import { OutgoingCallOverlay } from './OutgoingCallOverlay';

vi.mock('./api', () => ({
  cancelCall: vi.fn(() => Promise.resolve()),
}));

const peer = { id: 'u2', displayName: 'Bob', avatarUrl: null };

describe('OutgoingCallOverlay', () => {
  beforeEach(() => {
    useDmCallStore.setState({ status: 'idle', callId: null, role: null, peer: null });
    vi.mocked(api.cancelCall).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when idle', () => {
    const { container } = render(<OutgoingCallOverlay />);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows who is being called when ringing-out', () => {
    useDmCallStore.getState().startOutgoing('call-1', peer);

    render(<OutgoingCallOverlay />);

    expect(screen.getByText('Chamando Bob…')).toBeInTheDocument();
  });

  it('renders nothing once connected', () => {
    useDmCallStore.getState().startOutgoing('call-1', peer);
    useDmCallStore.getState().setConnected();

    const { container } = render(<OutgoingCallOverlay />);

    expect(container).toBeEmptyDOMElement();
  });

  it('cancelling calls cancelCall and resets the store', async () => {
    useDmCallStore.getState().startOutgoing('call-1', peer);
    const user = userEvent.setup();
    render(<OutgoingCallOverlay />);

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(api.cancelCall).toHaveBeenCalledWith('call-1');
    expect(useDmCallStore.getState().status).toBe('idle');
  });

  it('auto-cancels after 30s of no answer', () => {
    vi.useFakeTimers();
    useDmCallStore.getState().startOutgoing('call-1', peer);
    render(<OutgoingCallOverlay />);

    vi.advanceTimersByTime(30_000);

    expect(api.cancelCall).toHaveBeenCalledWith('call-1');
    expect(useDmCallStore.getState().status).toBe('idle');
  });

  it('does not auto-cancel once the call is accepted before the timeout', () => {
    vi.useFakeTimers();
    useDmCallStore.getState().startOutgoing('call-1', peer);
    const { rerender } = render(<OutgoingCallOverlay />);

    useDmCallStore.getState().setConnected();
    rerender(<OutgoingCallOverlay />);
    vi.advanceTimersByTime(30_000);

    expect(api.cancelCall).not.toHaveBeenCalled();
  });
});
