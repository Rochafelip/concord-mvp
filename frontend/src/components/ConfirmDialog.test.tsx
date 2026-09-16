import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('shows the title and message', () => {
    render(
      <ConfirmDialog
        open
        title="Delete channel"
        message='Delete "general"? This cannot be undone.'
        confirmLabel="Delete"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Delete channel' })).toBeInTheDocument();
    expect(screen.getByText('Delete "general"? This cannot be undone.')).toBeInTheDocument();
  });

  it('renders nothing while closed', () => {
    render(
      <ConfirmDialog
        open={false}
        title="Delete channel"
        message="Gone for good."
        confirmLabel="Delete"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByRole('heading', { name: 'Delete channel' })).not.toBeInTheDocument();
  });

  it('calls onConfirm when the confirm button is clicked', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        open
        title="Delete channel"
        message="Gone for good."
        confirmLabel="Delete"
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onClose and never onConfirm when cancelled', async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        open
        title="Delete channel"
        message="Gone for good."
        confirmLabel="Delete"
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('disables the confirm button while the action is pending', () => {
    render(
      <ConfirmDialog
        open
        title="Delete channel"
        message="Gone for good."
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        pending
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled();
  });
});
