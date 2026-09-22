import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../services/apiClient';
import * as api from './api';
import { InvitePeopleModal } from './InvitePeopleModal';

vi.mock('./api');

function renderModal(onClose: () => void = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <InvitePeopleModal serverId="s1" open onClose={onClose} />
    </QueryClientProvider>,
  );
}

describe('InvitePeopleModal', () => {
  beforeEach(() => {
    vi.mocked(api.getInvite).mockReset();
    vi.mocked(api.regenerateInvite).mockReset();
  });

  it('shows the full shareable link, not just the bare code', async () => {
    vi.mocked(api.getInvite).mockResolvedValue({ code: 'abc123' });
    renderModal();

    const link = await screen.findByText(/\/invite\/abc123/);
    expect(link).toHaveTextContent(`${window.location.origin}/invite/abc123`);
  });

  it('copies the full link to the clipboard and shows confirmation', async () => {
    vi.mocked(api.getInvite).mockResolvedValue({ code: 'abc123' });
    // userEvent.setup() installs its own navigator.clipboard stub, so the mock is grabbed
    // afterwards rather than replaced beforehand.
    const user = userEvent.setup();
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    renderModal();
    await screen.findByText(/\/invite\/abc123/);

    await user.click(screen.getByRole('button', { name: 'Copy link' }));

    expect(writeTextSpy).toHaveBeenCalledWith(`${window.location.origin}/invite/abc123`);
    expect(await screen.findByText('Copied!')).toBeInTheDocument();
  });

  it('clears the pending "copied" reset timeout on unmount (security audit, Baixa finding)', async () => {
    vi.mocked(api.getInvite).mockResolvedValue({ code: 'abc123' });
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    const { unmount } = renderModal();
    await screen.findByText(/\/invite\/abc123/);

    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    await screen.findByText('Copied!');

    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('regenerates the invite after confirming', async () => {
    vi.mocked(api.getInvite).mockResolvedValue({ code: 'abc123' });
    vi.mocked(api.regenerateInvite).mockResolvedValue({ code: 'xyz789' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderModal();
    await screen.findByText(/\/invite\/abc123/);

    await user.click(screen.getByRole('button', { name: 'Regenerate link' }));

    expect(await screen.findByText(/\/invite\/xyz789/)).toBeInTheDocument();
  });

  it('shows the backend error message when the invite fails to load', async () => {
    vi.mocked(api.getInvite).mockRejectedValue(new ApiError('Forbidden', 403));
    renderModal();

    expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden');
  });
});
