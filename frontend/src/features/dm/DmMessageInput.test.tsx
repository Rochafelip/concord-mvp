import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWsConnectionStore } from '../../stores/wsConnectionStore';
import { DmMessageInput } from './DmMessageInput';
import * as hooksModule from './hooks';

vi.mock('./hooks', () => ({ sendDmMessage: vi.fn() }));

describe('DmMessageInput', () => {
  beforeEach(() => {
    vi.mocked(hooksModule.sendDmMessage).mockClear();
    useWsConnectionStore.setState({ status: 'connected' });
  });

  it('blocks submitting empty content (send button stays disabled)', async () => {
    const user = userEvent.setup();
    render(<DmMessageInput recipientId="u2" />);

    const sendButton = screen.getByRole('button', { name: /enviar/i });
    expect(sendButton).toBeDisabled();

    await user.click(sendButton);
    expect(hooksModule.sendDmMessage).not.toHaveBeenCalled();
  });

  it('blocks submitting whitespace-only content', async () => {
    const user = userEvent.setup();
    render(<DmMessageInput recipientId="u2" />);

    const input = screen.getByLabelText(/mensagem/i);
    await user.type(input, '   ');
    await user.keyboard('{Enter}');

    expect(hooksModule.sendDmMessage).not.toHaveBeenCalled();
  });

  it('sends trimmed content to the recipient on valid submit and clears the input', async () => {
    const user = userEvent.setup();
    render(<DmMessageInput recipientId="u2" />);

    const input = screen.getByLabelText(/mensagem/i);
    await user.type(input, '  olá  ');
    await user.keyboard('{Enter}');

    expect(hooksModule.sendDmMessage).toHaveBeenCalledWith('u2', 'olá');
    expect(input).toHaveValue('');
  });

  it('disables the composer while disconnected', () => {
    useWsConnectionStore.setState({ status: 'disconnected' });
    render(<DmMessageInput recipientId="u2" />);

    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();
    expect(screen.getByText(/sem conexão/i)).toBeInTheDocument();
  });

  it(
    'appends a picked emoji to the message text',
    async () => {
      const user = userEvent.setup();
      render(<DmMessageInput recipientId="u2" />);

      const input = screen.getByLabelText(/mensagem/i);
      await user.type(input, 'oi');
      await user.click(screen.getByRole('button', { name: 'Add emoji' }));
      await user.click(await screen.findByRole('button', { name: 'grinning face' }));

      expect(input).toHaveValue('oi😀');
    },
    // See the same timeout note in EmojiPickerButton.test.tsx — rendering the full emoji grid is
    // slow under a contended full-suite run.
    20000,
  );
});
