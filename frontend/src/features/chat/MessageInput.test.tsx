import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageInput } from './MessageInput';
import * as hooksModule from './hooks';

vi.mock('./hooks', () => ({
  sendMessage: vi.fn(),
}));

describe('MessageInput', () => {
  beforeEach(() => {
    vi.mocked(hooksModule.sendMessage).mockClear();
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
});
