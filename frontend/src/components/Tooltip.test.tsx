import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  it('does not show the tooltip content before hovering', () => {
    render(
      <Tooltip content="Mute">
        <button>Toggle mic</button>
      </Tooltip>,
    );

    expect(screen.queryByText('Mute')).not.toBeInTheDocument();
  });

  it('shows the tooltip content when the trigger is hovered', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Mute">
        <button>Toggle mic</button>
      </Tooltip>,
    );

    await user.hover(screen.getByRole('button', { name: 'Toggle mic' }));

    expect(await screen.findByText('Mute')).toBeInTheDocument();
  });
});
