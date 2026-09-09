import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWsConnectionStore } from '../../stores/wsConnectionStore';
import { MessageInput } from './MessageInput';
import * as hooksModule from './hooks';
import * as apiModule from './api';

vi.mock('./hooks', () => ({
  sendMessage: vi.fn(),
}));

vi.mock('./api', () => ({ uploadAttachment: vi.fn() }));

describe('MessageInput', () => {
  beforeEach(() => {
    vi.mocked(hooksModule.sendMessage).mockClear();
    vi.mocked(apiModule.uploadAttachment).mockReset();
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

  it('disables the attach-file input when not connected', () => {
    useWsConnectionStore.setState({ status: 'disconnected' });
    render(<MessageInput channelId="c1" />);

    expect(screen.getByLabelText(/attach file/i, { selector: 'input' })).toBeDisabled();
  });

  it('uploads a picked image and sends the message with the returned attachment info', async () => {
    vi.mocked(apiModule.uploadAttachment).mockResolvedValue({
      url: '/api/v1/uploads/abc.png',
      fileName: 'photo.png',
      fileSize: 2048,
    });
    const user = userEvent.setup();
    render(<MessageInput channelId="c1" />);

    const file = new File(['fake-image-bytes'], 'photo.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText(/attach file/i, { selector: 'input' }), file);

    expect(apiModule.uploadAttachment).toHaveBeenCalledWith('c1', file);
    await screen.findByRole('button', { name: /send/i });
    expect(hooksModule.sendMessage).toHaveBeenCalledWith('c1', '', '/api/v1/uploads/abc.png', 'photo.png', 2048);
  });

  it('uses the currently typed text as the caption when sending an attachment', async () => {
    vi.mocked(apiModule.uploadAttachment).mockResolvedValue({
      url: '/api/v1/uploads/abc.png',
      fileName: 'photo.png',
      fileSize: 2048,
    });
    const user = userEvent.setup();
    render(<MessageInput channelId="c1" />);

    await user.type(screen.getByLabelText(/message/i), 'check this out');
    const file = new File(['fake-image-bytes'], 'photo.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText(/attach file/i, { selector: 'input' }), file);

    expect(hooksModule.sendMessage).toHaveBeenCalledWith('c1', 'check this out', '/api/v1/uploads/abc.png', 'photo.png', 2048);
  });

  it('rejects an oversized image client-side without uploading', async () => {
    const user = userEvent.setup();
    render(<MessageInput channelId="c1" />);

    const oversizedImage = new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'huge.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText(/attach file/i, { selector: 'input' }), oversizedImage);

    expect(apiModule.uploadAttachment).not.toHaveBeenCalled();
    expect(hooksModule.sendMessage).not.toHaveBeenCalled();
    expect(screen.getByText(/8 mb limit/i)).toBeInTheDocument();
  });

  it('uploads a non-image file under 50MB successfully', async () => {
    vi.mocked(apiModule.uploadAttachment).mockResolvedValue({
      url: '/api/v1/uploads/abc.pdf',
      fileName: 'report.pdf',
      fileSize: 20 * 1024 * 1024,
    });
    const user = userEvent.setup();
    render(<MessageInput channelId="c1" />);

    // 20MB — over the 8MB image limit, under the 50MB file limit, proving the higher limit
    // applies since this file's MIME type isn't one of the recognized image types.
    const file = new File([new Uint8Array(20 * 1024 * 1024)], 'report.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText(/attach file/i, { selector: 'input' }), file);

    expect(apiModule.uploadAttachment).toHaveBeenCalledWith('c1', file);
    await screen.findByRole('button', { name: /send/i });
    expect(hooksModule.sendMessage).toHaveBeenCalledWith(
      'c1', '', '/api/v1/uploads/abc.pdf', 'report.pdf', 20 * 1024 * 1024,
    );
  });

  it('rejects a non-image file over 50MB client-side without uploading', async () => {
    const user = userEvent.setup();
    render(<MessageInput channelId="c1" />);

    const oversizedFile = new File([new Uint8Array(50 * 1024 * 1024 + 1)], 'huge.zip', { type: 'application/zip' });
    await user.upload(screen.getByLabelText(/attach file/i, { selector: 'input' }), oversizedFile);

    expect(apiModule.uploadAttachment).not.toHaveBeenCalled();
    expect(hooksModule.sendMessage).not.toHaveBeenCalled();
    expect(screen.getByText(/50 mb limit/i)).toBeInTheDocument();
  });

  it('shows an error and does not send when the upload fails', async () => {
    vi.mocked(apiModule.uploadAttachment).mockRejectedValue(new Error('Network error'));
    const user = userEvent.setup();
    render(<MessageInput channelId="c1" />);

    const file = new File(['fake-bytes'], 'photo.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText(/attach file/i, { selector: 'input' }), file);

    await screen.findByText(/failed to upload file/i);
    expect(hooksModule.sendMessage).not.toHaveBeenCalled();
  });

  it('does not block sending a plain text message while an upload is in flight', async () => {
    let resolveUpload: (value: { url: string; fileName: string; fileSize: number }) => void = () => {};
    vi.mocked(apiModule.uploadAttachment).mockReturnValue(
      new Promise((resolve) => {
        resolveUpload = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<MessageInput channelId="c1" />);

    const file = new File(['fake-bytes'], 'photo.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText(/attach file/i, { selector: 'input' }), file);

    await user.type(screen.getByLabelText(/message/i), 'hello');
    await user.click(screen.getByRole('button', { name: /send/i }));
    expect(hooksModule.sendMessage).toHaveBeenCalledWith('c1', 'hello');

    resolveUpload({ url: '/api/v1/uploads/abc.png', fileName: 'photo.png', fileSize: 100 });
  });

  it('does not silently drop the message if the connection drops mid-upload', async () => {
    let resolveUpload: (value: { url: string; fileName: string; fileSize: number }) => void = () => {};
    vi.mocked(apiModule.uploadAttachment).mockReturnValue(
      new Promise((resolve) => {
        resolveUpload = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<MessageInput channelId="c1" />);

    const file = new File(['fake-bytes'], 'photo.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText(/attach file/i, { selector: 'input' }), file);

    // The upload succeeded, but the socket dropped while it was in flight — sendMessage would
    // silently no-op (see websocketClient.ts), so the user must be told explicitly rather than
    // seeing nothing happen.
    act(() => {
      useWsConnectionStore.setState({ status: 'disconnected' });
    });
    await act(async () => {
      resolveUpload({ url: '/api/v1/uploads/abc.png', fileName: 'photo.png', fileSize: 100 });
    });

    expect(hooksModule.sendMessage).not.toHaveBeenCalled();
    expect(await screen.findByText(/could not be sent/i)).toBeInTheDocument();
  });
});
