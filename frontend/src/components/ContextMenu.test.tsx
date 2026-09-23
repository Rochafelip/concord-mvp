import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ContextMenu } from './ContextMenu';

describe('ContextMenu', () => {
  it('does not show items before right-clicking', () => {
    render(
      <ContextMenu items={[{ label: 'Disconnect from voice', onSelect: vi.fn() }]}>
        <div>tile</div>
      </ContextMenu>,
    );

    expect(screen.queryByText('Disconnect from voice')).not.toBeInTheDocument();
  });

  it('shows items after right-clicking the wrapped content', async () => {
    render(
      <ContextMenu items={[{ label: 'Disconnect from voice', onSelect: vi.fn() }]}>
        <div>tile</div>
      </ContextMenu>,
    );

    fireEvent.contextMenu(screen.getByText('tile'));

    expect(await screen.findByText('Disconnect from voice')).toBeInTheDocument();
  });

  it('calls onSelect when an item is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ContextMenu items={[{ label: 'Disconnect from voice', onSelect }]}>
        <div>tile</div>
      </ContextMenu>,
    );

    fireEvent.contextMenu(screen.getByText('tile'));
    await user.click(await screen.findByText('Disconnect from voice'));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('renders a separator between two groups of items without treating it as an item', () => {
    render(
      <ContextMenu
        items={[{ label: 'Enviar mensagem', onSelect: vi.fn() }, { separator: true }, { label: 'Disconnect from voice', onSelect: vi.fn() }]}
      >
        <div>tile</div>
      </ContextMenu>,
    );

    fireEvent.contextMenu(screen.getByText('tile'));

    expect(screen.getByText('Enviar mensagem')).toBeInTheDocument();
    expect(screen.getByText('Disconnect from voice')).toBeInTheDocument();
  });

  it('never opens a menu when disabled, leaving the native context menu untouched', () => {
    render(
      <ContextMenu disabled items={[{ label: 'Disconnect from voice', onSelect: vi.fn() }]}>
        <div>tile</div>
      </ContextMenu>,
    );

    fireEvent.contextMenu(screen.getByText('tile'));

    expect(screen.queryByText('Disconnect from voice')).not.toBeInTheDocument();
  });
});
