import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { VolumeControl } from './VolumeControl';

describe('VolumeControl', () => {
  it('starts at 100% and unmuted, without calling onVolumeChange on mount', () => {
    const onVolumeChange = vi.fn();
    render(<VolumeControl label="Bob" onVolumeChange={onVolumeChange} />);

    expect(screen.getByRole('slider', { name: 'Volume for Bob' })).toHaveValue('100');
    expect(screen.getByRole('button', { name: 'Mute Bob for you' })).toBeInTheDocument();
    expect(onVolumeChange).not.toHaveBeenCalled();
  });

  // A tile that remounts (grid <-> focused view, as screen shares come and go mid-call) must not
  // forget the level its listener already picked — the caller hands the remembered level back in.
  it('starts at the volume it is given rather than at 100%', () => {
    const onVolumeChange = vi.fn();
    render(<VolumeControl label="Bob" onVolumeChange={onVolumeChange} initialVolume={0.3} />);

    expect(screen.getByRole('slider', { name: 'Volume for Bob' })).toHaveValue('30');
    expect(screen.getByRole('button', { name: 'Mute Bob for you' })).toBeInTheDocument();
    expect(onVolumeChange).not.toHaveBeenCalled();
  });

  it('shows itself as muted when the volume it is given is 0', () => {
    render(<VolumeControl label="Bob" onVolumeChange={vi.fn()} initialVolume={0} />);

    expect(screen.getByRole('slider', { name: 'Volume for Bob' })).toHaveValue('0');
    expect(screen.getByRole('button', { name: 'Unmute Bob for you' })).toBeInTheDocument();
  });

  it('unmutes to full volume when the level it was given was 0', async () => {
    const user = userEvent.setup();
    const onVolumeChange = vi.fn();
    render(<VolumeControl label="Bob" onVolumeChange={onVolumeChange} initialVolume={0} />);

    await user.click(screen.getByRole('button', { name: 'Unmute Bob for you' }));

    expect(onVolumeChange).toHaveBeenLastCalledWith(1);
    expect(screen.getByRole('slider', { name: 'Volume for Bob' })).toHaveValue('100');
  });

  it('reports the new volume as a 0-1 fraction when the slider moves', () => {
    const onVolumeChange = vi.fn();
    render(<VolumeControl label="Bob" onVolumeChange={onVolumeChange} />);

    fireEvent.change(screen.getByRole('slider', { name: 'Volume for Bob' }), { target: { value: '40' } });

    expect(onVolumeChange).toHaveBeenCalledWith(0.4);
  });

  it("mutes without changing the slider's remembered position, reporting 0", async () => {
    const user = userEvent.setup();
    const onVolumeChange = vi.fn();
    render(<VolumeControl label="Bob" onVolumeChange={onVolumeChange} />);

    fireEvent.change(screen.getByRole('slider', { name: 'Volume for Bob' }), { target: { value: '70' } });
    await user.click(screen.getByRole('button', { name: 'Mute Bob for you' }));

    expect(onVolumeChange).toHaveBeenLastCalledWith(0);
    expect(screen.getByRole('slider', { name: 'Volume for Bob' })).toHaveValue('0');
  });

  it('restores the remembered volume on unmute', async () => {
    const user = userEvent.setup();
    const onVolumeChange = vi.fn();
    render(<VolumeControl label="Bob" onVolumeChange={onVolumeChange} />);

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

  it('un-mutes and reports the new volume when the slider is moved while it opened muted', () => {
    const onVolumeChange = vi.fn();
    render(<VolumeControl label="Bob" onVolumeChange={onVolumeChange} initialVolume={0} />);

    fireEvent.change(screen.getByRole('slider', { name: 'Volume for Bob' }), { target: { value: '80' } });

    expect(screen.getByRole('button', { name: 'Mute Bob for you' })).toBeInTheDocument();
    expect(onVolumeChange).toHaveBeenLastCalledWith(0.8);
  });

  it('un-mutes automatically when the slider is moved while muted', async () => {
    const user = userEvent.setup();
    const onVolumeChange = vi.fn();
    render(<VolumeControl label="Bob" onVolumeChange={onVolumeChange} />);

    await user.click(screen.getByRole('button', { name: 'Mute Bob for you' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Volume for Bob' }), { target: { value: '55' } });

    expect(screen.getByRole('button', { name: 'Mute Bob for you' })).toBeInTheDocument();
    expect(onVolumeChange).toHaveBeenLastCalledWith(0.55);
  });
});
