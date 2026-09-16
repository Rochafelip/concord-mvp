import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

/**
 * userEvent has no API for pasting files, and jsdom's ClipboardEvent carries no `clipboardData`,
 * so the event is built by hand with the `items` shape the composer reads. Returns the event so a
 * test can assert whether the composer called preventDefault on it.
 */
function pasteFiles(target: Element, files: File[]): Event {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    value: {
      items: files.map((file) => ({
        kind: 'file' as const,
        type: file.type,
        getAsFile: () => file,
      })),
    },
  });
  fireEvent(target, event);
  return event;
}

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
    render(<MessageInput channelId="c1" canAttachFiles />);

    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).toBeDisabled();

    await user.click(sendButton);
    expect(hooksModule.sendMessage).not.toHaveBeenCalled();
  });

  it('blocks submitting whitespace-only content', async () => {
    const user = userEvent.setup();
    render(<MessageInput channelId="c1" canAttachFiles />);

    const input = screen.getByLabelText(/message/i);
    await user.type(input, '   ');
    // Enter triggers native form submission even though the (disabled) button can't be clicked.
    await user.keyboard('{Enter}');

    expect(hooksModule.sendMessage).not.toHaveBeenCalled();
  });

  it('calls sendMessage with trimmed content on valid submit and clears the input', async () => {
    const user = userEvent.setup();
    render(<MessageInput channelId="c1" canAttachFiles />);

    const input = screen.getByLabelText(/message/i) as HTMLInputElement;
    await user.type(input, '  hello world  ');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(hooksModule.sendMessage).toHaveBeenCalledWith('c1', 'hello world');
    expect(input.value).toBe('');
  });

  it('disables the send button and shows a note when not connected', async () => {
    useWsConnectionStore.setState({ status: 'disconnected' });
    const user = userEvent.setup();
    render(<MessageInput channelId="c1" canAttachFiles />);

    const input = screen.getByLabelText(/message/i);
    await user.type(input, 'hello');

    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
    expect(screen.getByText(/not connected/i)).toBeInTheDocument();
  });

  it('does not silently drop a send attempt while disconnected (guards even a direct form submit)', async () => {
    useWsConnectionStore.setState({ status: 'connecting' });
    render(<MessageInput channelId="c1" canAttachFiles />);

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
    render(<MessageInput channelId="c1" canAttachFiles />);

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
    render(<MessageInput channelId="c1" canAttachFiles />);

    expect(screen.getByLabelText(/attach file/i, { selector: 'input' })).toBeDisabled();
  });

  it('stages a picked file as a preview without uploading it yet', async () => {
    const user = userEvent.setup();
    render(<MessageInput channelId="c1" canAttachFiles />);

    const file = new File(['fake-image-bytes'], 'photo.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText(/attach file/i, { selector: 'input' }), file);

    // Nothing is uploaded until the user actually sends: removing the preview must not leave an
    // orphaned file on the server.
    expect(apiModule.uploadAttachment).not.toHaveBeenCalled();
    expect(hooksModule.sendMessage).not.toHaveBeenCalled();
    expect(screen.getByAltText('photo.png')).toBeInTheDocument();
  });

  it('uploads on send and passes the returned attachment list to sendMessage', async () => {
    vi.mocked(apiModule.uploadAttachment).mockResolvedValue({
      url: '/api/v1/uploads/abc.png',
      fileName: 'photo.png',
      fileSize: 2048,
    });
    const user = userEvent.setup();
    render(<MessageInput channelId="c1" canAttachFiles />);

    const file = new File(['fake-image-bytes'], 'photo.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText(/attach file/i, { selector: 'input' }), file);
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(apiModule.uploadAttachment).toHaveBeenCalledWith('c1', file);
    await waitFor(() =>
      expect(hooksModule.sendMessage).toHaveBeenCalledWith('c1', '', [
        { url: '/api/v1/uploads/abc.png', fileName: 'photo.png', fileSize: 2048 },
      ]),
    );
  });

  it('sends several attachments in one message, preserving the order they were staged in', async () => {
    vi.mocked(apiModule.uploadAttachment).mockImplementation(async (_channelId, file) => ({
      url: `/api/v1/uploads/${file.name}`,
      fileName: file.name,
      fileSize: file.size,
    }));
    const user = userEvent.setup();
    render(<MessageInput channelId="c1" canAttachFiles />);

    const input = screen.getByLabelText(/attach file/i, { selector: 'input' });
    await user.upload(input, [
      new File(['a'], 'a.png', { type: 'image/png' }),
      new File(['b'], 'b.png', { type: 'image/png' }),
    ]);
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => expect(hooksModule.sendMessage).toHaveBeenCalled());
    const [, , attachments] = vi.mocked(hooksModule.sendMessage).mock.calls[0];
    expect(attachments?.map((attachment) => attachment.url)).toEqual([
      '/api/v1/uploads/a.png',
      '/api/v1/uploads/b.png',
    ]);
  });

  it('uses the currently typed text as the caption when sending an attachment', async () => {
    vi.mocked(apiModule.uploadAttachment).mockResolvedValue({
      url: '/api/v1/uploads/abc.png',
      fileName: 'photo.png',
      fileSize: 2048,
    });
    const user = userEvent.setup();
    render(<MessageInput channelId="c1" canAttachFiles />);

    await user.type(screen.getByLabelText(/message/i), 'check this out');
    const file = new File(['fake-image-bytes'], 'photo.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText(/attach file/i, { selector: 'input' }), file);
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() =>
      expect(hooksModule.sendMessage).toHaveBeenCalledWith('c1', 'check this out', [
        { url: '/api/v1/uploads/abc.png', fileName: 'photo.png', fileSize: 2048 },
      ]),
    );
  });

  it('enables the send button for an attachment with no text at all', async () => {
    const user = userEvent.setup();
    render(<MessageInput channelId="c1" canAttachFiles />);

    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();

    await user.upload(
      screen.getByLabelText(/attach file/i, { selector: 'input' }),
      new File(['bytes'], 'photo.png', { type: 'image/png' }),
    );

    expect(screen.getByRole('button', { name: /send/i })).toBeEnabled();
  });

  it('stages an image pasted from the clipboard (Win + Shift + S screenshot)', async () => {
    render(<MessageInput channelId="c1" canAttachFiles />);

    // A fresh screenshot arrives as a nameless/generic image file with no filename of its own.
    pasteFiles(screen.getByLabelText(/message/i), [
      new File(['screenshot-bytes'], 'image.png', { type: 'image/png' }),
    ]);

    const preview = await screen.findByRole('img');
    expect(preview.getAttribute('alt')).toMatch(/^pasted-image-\d+\.png$/);
    expect(screen.getByRole('button', { name: /send/i })).toBeEnabled();
  });

  it('keeps a pasted image file name when the clipboard provides a real one', async () => {
    render(<MessageInput channelId="c1" canAttachFiles />);

    pasteFiles(screen.getByLabelText(/message/i), [
      new File(['bytes'], 'diagram.webp', { type: 'image/webp' }),
    ]);

    expect(await screen.findByAltText('diagram.webp')).toBeInTheDocument();
  });

  it('does not intercept a plain text paste', async () => {
    render(<MessageInput channelId="c1" canAttachFiles />);
    const input = screen.getByLabelText(/message/i);

    const event = pasteFiles(input, []);

    // preventDefault would swallow ordinary Ctrl+V and stop the text reaching the input.
    expect(event.defaultPrevented).toBe(false);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('stages files dropped onto the composer', async () => {
    render(<MessageInput channelId="c1" canAttachFiles />);

    const file = new File(['bytes'], 'dropped.png', { type: 'image/png' });
    fireEvent.drop(screen.getByTestId('message-composer'), {
      dataTransfer: { files: [file], types: ['Files'] },
    });

    expect(await screen.findByAltText('dropped.png')).toBeInTheDocument();
    expect(apiModule.uploadAttachment).not.toHaveBeenCalled();
  });

  it('removes a single pending attachment without touching the others', async () => {
    const user = userEvent.setup();
    render(<MessageInput channelId="c1" canAttachFiles />);

    await user.upload(screen.getByLabelText(/attach file/i, { selector: 'input' }), [
      new File(['a'], 'a.png', { type: 'image/png' }),
      new File(['b'], 'b.png', { type: 'image/png' }),
    ]);
    await user.click(screen.getByRole('button', { name: /remove a\.png/i }));

    expect(screen.queryByAltText('a.png')).not.toBeInTheDocument();
    expect(screen.getByAltText('b.png')).toBeInTheDocument();
  });

  it('leaves the composer sendable-by-text-only after the last attachment is removed', async () => {
    const user = userEvent.setup();
    render(<MessageInput channelId="c1" canAttachFiles />);

    await user.upload(
      screen.getByLabelText(/attach file/i, { selector: 'input' }),
      new File(['a'], 'a.png', { type: 'image/png' }),
    );
    await user.click(screen.getByRole('button', { name: /remove a\.png/i }));

    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
    expect(screen.queryByLabelText(/pending attachments/i)).not.toBeInTheDocument();
  });

  it('caps the composer at ten attachments and says so', async () => {
    const user = userEvent.setup();
    render(<MessageInput channelId="c1" canAttachFiles />);

    const eleven = Array.from({ length: 11 }, (_unused, index) =>
      new File(['bytes'], `file${index}.png`, { type: 'image/png' }),
    );
    await user.upload(screen.getByLabelText(/attach file/i, { selector: 'input' }), eleven);

    expect(screen.getAllByRole('img')).toHaveLength(10);
    expect(screen.getByText(/at most 10 attachments/i)).toBeInTheDocument();
    expect(screen.queryByAltText('file10.png')).not.toBeInTheDocument();
  });

  it('rejects an oversized image client-side without staging or uploading it', async () => {
    const user = userEvent.setup();
    render(<MessageInput channelId="c1" canAttachFiles />);

    const oversizedImage = new File([new Uint8Array(150 * 1024 * 1024 + 1)], 'huge.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText(/attach file/i, { selector: 'input' }), oversizedImage);

    expect(apiModule.uploadAttachment).not.toHaveBeenCalled();
    expect(hooksModule.sendMessage).not.toHaveBeenCalled();
    expect(screen.queryByAltText('huge.png')).not.toBeInTheDocument();
    expect(screen.getByText(/150 mb limit/i)).toBeInTheDocument();
  });

  it('rejects a non-image file over 150MB client-side without uploading', async () => {
    const user = userEvent.setup();
    render(<MessageInput channelId="c1" canAttachFiles />);

    const oversizedFile = new File([new Uint8Array(150 * 1024 * 1024 + 1)], 'huge.zip', { type: 'application/zip' });
    await user.upload(screen.getByLabelText(/attach file/i, { selector: 'input' }), oversizedFile);

    expect(apiModule.uploadAttachment).not.toHaveBeenCalled();
    expect(hooksModule.sendMessage).not.toHaveBeenCalled();
    expect(screen.getByText(/150 mb limit/i)).toBeInTheDocument();
  });

  it('sends a large non-image file under 150MB as a chip preview', async () => {
    vi.mocked(apiModule.uploadAttachment).mockResolvedValue({
      url: '/api/v1/uploads/abc.pdf',
      fileName: 'report.pdf',
      fileSize: 100 * 1024 * 1024,
    });
    const user = userEvent.setup();
    render(<MessageInput channelId="c1" canAttachFiles />);

    const file = new File([new Uint8Array(100 * 1024 * 1024)], 'report.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText(/attach file/i, { selector: 'input' }), file);

    // A non-image has no thumbnail to show, so it is previewed as a named chip instead.
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('report.pdf')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(apiModule.uploadAttachment).toHaveBeenCalledWith('c1', file);
    await waitFor(() =>
      expect(hooksModule.sendMessage).toHaveBeenCalledWith('c1', '', [
        { url: '/api/v1/uploads/abc.pdf', fileName: 'report.pdf', fileSize: 100 * 1024 * 1024 },
      ]),
    );
  });

  it('keeps the previews and the typed text when the upload fails, so the user can retry', async () => {
    vi.mocked(apiModule.uploadAttachment).mockRejectedValue(new Error('Network error'));
    const user = userEvent.setup();
    render(<MessageInput channelId="c1" canAttachFiles />);

    await user.type(screen.getByLabelText(/message/i), 'here you go');
    await user.upload(
      screen.getByLabelText(/attach file/i, { selector: 'input' }),
      new File(['fake-bytes'], 'photo.png', { type: 'image/png' }),
    );
    await user.click(screen.getByRole('button', { name: /send/i }));

    await screen.findByText(/failed to upload file/i);
    expect(hooksModule.sendMessage).not.toHaveBeenCalled();
    expect(screen.getByAltText('photo.png')).toBeInTheDocument();
    expect((screen.getByLabelText(/message/i) as HTMLInputElement).value).toBe('here you go');
  });

  it('does not send anything if one upload of several fails', async () => {
    vi.mocked(apiModule.uploadAttachment).mockImplementation(async (_channelId, file) => {
      if (file.name === 'b.png') throw new Error('Network error');
      return { url: `/api/v1/uploads/${file.name}`, fileName: file.name, fileSize: file.size };
    });
    const user = userEvent.setup();
    render(<MessageInput channelId="c1" canAttachFiles />);

    await user.upload(screen.getByLabelText(/attach file/i, { selector: 'input' }), [
      new File(['a'], 'a.png', { type: 'image/png' }),
      new File(['b'], 'b.png', { type: 'image/png' }),
    ]);
    await user.click(screen.getByRole('button', { name: /send/i }));

    // All or nothing: a half-sent message would either drop an attachment silently or post
    // without the one that failed.
    await screen.findByText(/failed to upload file/i);
    expect(hooksModule.sendMessage).not.toHaveBeenCalled();
  });

  it('does not silently drop the message if the connection drops mid-upload', async () => {
    let resolveUpload: (value: { url: string; fileName: string; fileSize: number }) => void = () => {};
    vi.mocked(apiModule.uploadAttachment).mockReturnValue(
      new Promise((resolve) => {
        resolveUpload = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<MessageInput channelId="c1" canAttachFiles />);

    await user.upload(
      screen.getByLabelText(/attach file/i, { selector: 'input' }),
      new File(['fake-bytes'], 'photo.png', { type: 'image/png' }),
    );
    await user.click(screen.getByRole('button', { name: /send/i }));

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
