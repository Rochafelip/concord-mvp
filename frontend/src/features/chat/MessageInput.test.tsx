import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWsConnectionStore } from '../../stores/wsConnectionStore';
import { MessageInput } from './MessageInput';
import * as hooksModule from './hooks';

vi.mock('./hooks', () => ({
  sendMessage: vi.fn(),
}));

describe('MessageInput', () => {
  beforeEach(() => {
    vi.mocked(hooksModule.sendMessage).mockClear();
    // Most tests below exercise the empty/whitespace/valid-content guard, not the connection
    // guard, so default to 'connected' here and override per-test where the connection state
    // itself is under test.
    useWsConnectionStore.setState({ status: 'connected' });
  });

  it('blocks submitting empty content (send button stays disabled)', async () => {
    const user = userEvent.setup();
    render(<MessageInput channelId="c1" />);

    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).toBeDisabled();

    await user.click(sendButton);
    expect(hooksModule.sendMessage).not.toHaveBeenCalled();
  });

  it('blocks submitting whitespace-only content', async () => {
    const user = userEvent.setup();
    render(<MessageInput channelId="c1" />);

    const input = screen.getByLabelText(/message/i);
    await user.type(input, '   ');
    // Enter triggers native form submission even though the (disabled) button can't be clicked.
    await user.keyboard('{Enter}');

    expect(hooksModule.sendMessage).not.toHaveBeenCalled();
  });

  it('calls sendMessage with trimmed content on valid submit and clears the input', async () => {
    const user = userEvent.setup();
    render(<MessageInput channelId="c1" />);

    const input = screen.getByLabelText(/message/i) as HTMLInputElement;
    await user.type(input, '  hello world  ');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(hooksModule.sendMessage).toHaveBeenCalledWith('c1', 'hello world');
    expect(input.value).toBe('');
  });

  it('disables the send button and shows a note when not connected', async () => {
    useWsConnectionStore.setState({ status: 'disconnected' });
    const user = userEvent.setup();
    render(<MessageInput channelId="c1" />);

    const input = screen.getByLabelText(/message/i);
    await user.type(input, 'hello');

    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
    expect(screen.getByText(/not connected/i)).toBeInTheDocument();
  });

  it('does not silently drop a send attempt while disconnected (guards even a direct form submit)', async () => {
    useWsConnectionStore.setState({ status: 'connecting' });
    render(<MessageInput channelId="c1" />);

    const input = screen.getByLabelText(/message/i) as HTMLInputElement;
    const user = userEvent.setup();
    await user.type(input, 'hello{Enter}');

    // Enter still fires the form's submit event even though the button is disabled — the
    // component's own connection guard (not just the disabled button) must stop the send.
    expect(hooksModule.sendMessage).not.toHaveBeenCalled();
    // And the input is NOT cleared, so the user can see their message was not sent.
    expect(input.value).toBe('hello');
  });

  it('re-enables the send button once the connection is restored', async () => {
    useWsConnectionStore.setState({ status: 'disconnected' });
    const user = userEvent.setup();
    render(<MessageInput channelId="c1" />);

    const input = screen.getByLabelText(/message/i);
    await user.type(input, 'hello');
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();

    act(() => {
      useWsConnectionStore.setState({ status: 'connected' });
    });

    expect(screen.getByRole('button', { name: /send/i })).toBeEnabled();
  });
});
