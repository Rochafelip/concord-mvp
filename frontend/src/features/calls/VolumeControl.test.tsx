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
