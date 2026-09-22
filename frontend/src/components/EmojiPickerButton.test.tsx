import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EmojiPickerButton } from './EmojiPickerButton';

describe('EmojiPickerButton', () => {
  it('does not show the emoji panel before the button is clicked', () => {
    render(<EmojiPickerButton onSelect={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'grinning face' })).not.toBeInTheDocument();
  });

  it(
    'shows the emoji panel after clicking the trigger',
    async () => {
      const user = userEvent.setup();
      render(<EmojiPickerButton onSelect={vi.fn()} />);

      await user.click(screen.getByRole('button', { name: 'Add emoji' }));

      expect(await screen.findByRole('button', { name: 'grinning face' })).toBeInTheDocument();
    },
    // emoji-picker-react renders its full ~1900-button grid on open (our IntersectionObserver
    // polyfill reports every row as immediately visible, since nothing in jsdom ever scrolls it
    // into view for real) — slow under a contended full-suite run, not stuck in a retry loop.
    20000,
  );

  it(
    'calls onSelect with the chosen emoji character',
    async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(<EmojiPickerButton onSelect={onSelect} />);

      await user.click(screen.getByRole('button', { name: 'Add emoji' }));
      await user.click(await screen.findByRole('button', { name: 'grinning face' }));

      expect(onSelect).toHaveBeenCalledWith('😀');
    },
    20000,
  );
});
