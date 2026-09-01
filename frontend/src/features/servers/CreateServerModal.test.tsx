import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../services/apiClient';
import * as api from './api';
import { CreateServerModal } from './CreateServerModal';

vi.mock('./api');

function renderModal(onClose: () => void) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/create']}>
        <Routes>
          <Route path="/create" element={<CreateServerModal open onClose={onClose} />} />
          <Route path="/app/servers/:serverId" element={<div>Server view</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CreateServerModal', () => {
  beforeEach(() => {
    vi.mocked(api.createServer).mockReset();
  });

  it('shows the backend error message when creation fails', async () => {
    vi.mocked(api.createServer).mockRejectedValue(new ApiError('Name already taken', 400));
    const user = userEvent.setup();
    renderModal(vi.fn());

    await user.type(screen.getByLabelText('Server name'), 'My Server');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Name already taken');
  });

  it('creates the server, closes the modal, and navigates to it on success', async () => {
    vi.mocked(api.createServer).mockResolvedValue({
      id: 'new-server',
      name: 'My Server',
      ownerId: 'u1',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    });
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal(onClose);

    await user.type(screen.getByLabelText('Server name'), 'My Server');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByText('Server view')).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
    expect(vi.mocked(api.createServer).mock.calls[0][0]).toEqual({ name: 'My Server' });
  });
});
