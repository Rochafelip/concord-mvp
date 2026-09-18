import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DropdownMenu } from './DropdownMenu';

describe('DropdownMenu', () => {
  it('does not show items before the trigger is opened', () => {
    render(
      <DropdownMenu
        trigger={<button>Options</button>}
        items={[{ label: 'Rename', onSelect: vi.fn() }]}
      />,
    );

    expect(screen.queryByText('Rename')).not.toBeInTheDocument();
  });

  it('shows items after clicking the trigger', async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu
        trigger={<button>Options</button>}
        items={[{ label: 'Rename', onSelect: vi.fn() }]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Options' }));

    expect(await screen.findByText('Rename')).toBeInTheDocument();
  });

  it('calls onSelect when an item is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<DropdownMenu trigger={<button>Options</button>} items={[{ label: 'Rename', onSelect }]} />);

    await user.click(screen.getByRole('button', { name: 'Options' }));
    await user.click(await screen.findByText('Rename'));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
