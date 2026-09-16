import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Channel } from '../../types/channel';
import * as api from './api';
import { CreateChannelModal } from './CreateChannelModal';

vi.mock('./api');

const created: Channel = {
  id: 'c9',
  serverId: 's1',
  name: 'general',
  type: 'TEXT',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

function renderModal(onClose = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/app/servers/s1']}>
        <CreateChannelModal serverId="s1" open type="TEXT" onClose={onClose} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return onClose;
}

describe('CreateChannelModal', () => {
  beforeEach(() => {
    // No global clearMocks in vite.config.ts, so call counts would leak between tests.
    vi.clearAllMocks();
    vi.mocked(api.createChannel).mockResolvedValue(created);
  });

  // The backend caps the name at 100 characters (@Size(max = 100)); stopping the typing here
  // saves a round trip that could only ever come back as a 400.
  it('caps the channel name at the length the backend accepts', () => {
    renderModal();

    expect(screen.getByLabelText('Channel name')).toHaveAttribute('maxLength', '100');
  });

  it('trims surrounding whitespace before sending the name', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText('Channel name'), '  general  ');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(api.createChannel).toHaveBeenCalledWith('s1', { name: 'general', type: 'TEXT' });
  });

  it('does not submit a name that is only whitespace', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText('Channel name'), '   ');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(api.createChannel).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a channel name.')).toBeInTheDocument();
  });
});
