import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { VolumeControl } from './VolumeControl';

function openPopover(user: ReturnType<typeof userEvent.setup>, label = 'Bob') {
  return user.click(screen.getByRole('button', { name: `Volume for ${label}` }));
}

describe('VolumeControl', () => {
  it('does not show the slider or mute button until the volume icon is clicked', () => {
    render(<VolumeControl label="Bob" onVolumeChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Volume for Bob' })).toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mute Bob for you' })).not.toBeInTheDocument();
  });

  it('starts at 100% and unmuted, without calling onVolumeChange on mount', async () => {
    const user = userEvent.setup();
    const onVolumeChange = vi.fn();
    render(<VolumeControl label="Bob" onVolumeChange={onVolumeChange} />);

    await openPopover(user);

    expect(screen.getByRole('slider', { name: 'Volume for Bob' })).toHaveValue('100');
    expect(screen.getByRole('button', { name: 'Mute Bob for you' })).toBeInTheDocument();
    expect(onVolumeChange).not.toHaveBeenCalled();
  });

  // A tile that remounts (grid <-> focused view, as screen shares come and go mid-call) must not
  // forget the level its listener already picked — the caller hands the remembered level back in.
  it('starts at the volume it is given rather than at 100%', async () => {
    const user = userEvent.setup();
    const onVolumeChange = vi.fn();
    render(<VolumeControl label="Bob" onVolumeChange={onVolumeChange} initialVolume={0.3} />);

    await openPopover(user);

    expect(screen.getByRole('slider', { name: 'Volume for Bob' })).toHaveValue('30');
    expect(screen.getByRole('button', { name: 'Mute Bob for you' })).toBeInTheDocument();
    expect(onVolumeChange).not.toHaveBeenCalled();
  });

  it('shows itself as muted when the volume it is given is 0', async () => {
    const user = userEvent.setup();
    render(<VolumeControl label="Bob" onVolumeChange={vi.fn()} initialVolume={0} />);

    await openPopover(user);

    expect(screen.getByRole('slider', { name: 'Volume for Bob' })).toHaveValue('0');
    expect(screen.getByRole('button', { name: 'Unmute Bob for you' })).toBeInTheDocument();
  });

  it('unmutes to full volume when the level it was given was 0', async () => {
    const user = userEvent.setup();
    const onVolumeChange = vi.fn();
    render(<VolumeControl label="Bob" onVolumeChange={onVolumeChange} initialVolume={0} />);

    await openPopover(user);
    await user.click(screen.getByRole('button', { name: 'Unmute Bob for you' }));

    expect(onVolumeChange).toHaveBeenLastCalledWith(1);
    expect(screen.getByRole('slider', { name: 'Volume for Bob' })).toHaveValue('100');
  });

  it('reports the new volume as a 0-1 fraction when the slider moves', async () => {
    const user = userEvent.setup();
    const onVolumeChange = vi.fn();
    render(<VolumeControl label="Bob" onVolumeChange={onVolumeChange} />);

    await openPopover(user);
    fireEvent.change(screen.getByRole('slider', { name: 'Volume for Bob' }), { target: { value: '40' } });

    expect(onVolumeChange).toHaveBeenCalledWith(0.4);
  });

  it("mutes without changing the slider's remembered position, reporting 0", async () => {
    const user = userEvent.setup();
    const onVolumeChange = vi.fn();
    render(<VolumeControl label="Bob" onVolumeChange={onVolumeChange} />);

    await openPopover(user);
    fireEvent.change(screen.getByRole('slider', { name: 'Volume for Bob' }), { target: { value: '70' } });
    await user.click(screen.getByRole('button', { name: 'Mute Bob for you' }));

    expect(onVolumeChange).toHaveBeenLastCalledWith(0);
    expect(screen.getByRole('slider', { name: 'Volume for Bob' })).toHaveValue('0');
  });

  it('restores the remembered volume on unmute', async () => {
    const user = userEvent.setup();
    const onVolumeChange = vi.fn();
    render(<VolumeControl label="Bob" onVolumeChange={onVolumeChange} />);

    await openPopover(user);
    fireEvent.change(screen.getByRole('slider', { name: 'Volume for Bob' }), { target: { value: '70' } });
    await user.click(screen.getByRole('button', { name: 'Mute Bob for you' }));
    await user.click(screen.getByRole('button', { name: 'Unmute Bob for you' }));

    expect(onVolumeChange).toHaveBeenLastCalledWith(0.7);
    expect(screen.getByRole('slider', { name: 'Volume for Bob' })).toHaveValue('70');
  });

  it('does not call onVolumeChange on mount when it opens muted', () => {
    const onVolumeChange = vi.fn();
    render(<VolumeControl label="Bob" onVolumeChange={onVolumeChange} initialVolume={0} />);

    expect(onVolumeChange).not.toHaveBeenCalled();
  });

  it('un-mutes and reports the new volume when the slider is moved while it opened muted', async () => {
    const user = userEvent.setup();
    const onVolumeChange = vi.fn();
    render(<VolumeControl label="Bob" onVolumeChange={onVolumeChange} initialVolume={0} />);

    await openPopover(user);
    fireEvent.change(screen.getByRole('slider', { name: 'Volume for Bob' }), { target: { value: '80' } });

    expect(screen.getByRole('button', { name: 'Mute Bob for you' })).toBeInTheDocument();
    expect(onVolumeChange).toHaveBeenLastCalledWith(0.8);
  });

  it('un-mutes automatically when the slider is moved while muted', async () => {
    const user = userEvent.setup();
    const onVolumeChange = vi.fn();
    render(<VolumeControl label="Bob" onVolumeChange={onVolumeChange} />);

    await openPopover(user);
    await user.click(screen.getByRole('button', { name: 'Mute Bob for you' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Volume for Bob' }), { target: { value: '55' } });

    expect(screen.getByRole('button', { name: 'Mute Bob for you' })).toBeInTheDocument();
    expect(onVolumeChange).toHaveBeenLastCalledWith(0.55);
  });

  it('closes the popover when clicking outside it', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <VolumeControl label="Bob" onVolumeChange={vi.fn()} />
        <button type="button">Elsewhere</button>
      </div>,
    );

    await openPopover(user);
    expect(screen.getByRole('slider')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));

    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });

  it('closes the popover on Escape', async () => {
    const user = userEvent.setup();
    render(<VolumeControl label="Bob" onVolumeChange={vi.fn()} />);

    await openPopover(user);
    expect(screen.getByRole('slider')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });
});
