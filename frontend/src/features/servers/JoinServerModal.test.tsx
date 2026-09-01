import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../services/apiClient';
import * as api from './api';
import { JoinServerModal } from './JoinServerModal';

vi.mock('./api');

function renderModal(onClose: () => void) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/join']}>
        <Routes>
          <Route path="/join" element={<JoinServerModal open onClose={onClose} />} />
          <Route path="/app/servers/:serverId" element={<div>Server view</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('JoinServerModal', () => {
  beforeEach(() => {
    vi.mocked(api.joinServer).mockReset();
  });

  it('shows the backend error message when joining fails', async () => {
    vi.mocked(api.joinServer).mockRejectedValue(new ApiError('Invalid invite code', 404));
    const user = userEvent.setup();
    renderModal(vi.fn());

    await user.type(screen.getByLabelText('Invite code'), 'bad-code');
    await user.click(screen.getByRole('button', { name: 'Join' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid invite code');
  });

  it('joins the server, closes the modal, and navigates to it on success', async () => {
    vi.mocked(api.joinServer).mockResolvedValue({
      id: 'joined-server',
      name: 'Friends',
      ownerId: 'u2',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    });
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal(onClose);

    await user.type(screen.getByLabelText('Invite code'), 'good-code');
    await user.click(screen.getByRole('button', { name: 'Join' }));

    expect(await screen.findByText('Server view')).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
    expect(vi.mocked(api.joinServer).mock.calls[0][0]).toEqual({ code: 'good-code' });
  });
});
