import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={vi.fn()}>
        content
      </Modal>,
    );

    expect(screen.queryByText('content')).not.toBeInTheDocument();
  });

  it('renders children when open', () => {
    render(
      <Modal open onClose={vi.fn()}>
        content
      </Modal>,
    );

    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose}>
        content
      </Modal>,
    );

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape is pressed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose}>
        content
      </Modal>,
    );

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not listen for Escape while closed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal open={false} onClose={onClose}>
        content
      </Modal>,
    );

    await user.keyboard('{Escape}');

    expect(onClose).not.toHaveBeenCalled();
  });

  it('still closes on backdrop click', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(
      <Modal open onClose={onClose}>
        content
      </Modal>,
    );

    await user.click(container.firstElementChild as Element);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
