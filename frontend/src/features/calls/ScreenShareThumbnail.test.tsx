import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ScreenShareThumbnail } from './ScreenShareThumbnail';

describe('ScreenShareThumbnail', () => {
  it("labels the thumbnail with the sharer's name", () => {
    render(<ScreenShareThumbnail name="Felipe" onClick={vi.fn()} />);

    expect(screen.getByText(/Felipe's screen/)).toBeInTheDocument();
  });

  it('never renders a video element', () => {
    const { container } = render(<ScreenShareThumbnail name="Felipe" onClick={vi.fn()} />);

    expect(container.querySelector('video')).toBeNull();
  });

  it('calls onClick when clicked, exposed with an accessible label naming the sharer', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<ScreenShareThumbnail name="Felipe" onClick={onClick} />);

    await user.click(screen.getByRole('button', { name: "Focus on Felipe's screen" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
