import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as screenShareQuality from './screenShareQuality';
import { ScreenShareQualityModal } from './ScreenShareQualityModal';

vi.mock('./screenShareQuality', async () => {
  const actual = await vi.importActual<typeof import('./screenShareQuality')>('./screenShareQuality');
  return {
    ...actual,
    getLastScreenShareQuality: vi.fn(),
    setLastScreenShareQuality: vi.fn(),
  };
});

describe('ScreenShareQualityModal', () => {
  beforeEach(() => {
    vi.mocked(screenShareQuality.getLastScreenShareQuality).mockReturnValue('fhd');
    vi.mocked(screenShareQuality.setLastScreenShareQuality).mockClear();
  });

  it('renders nothing when closed', () => {
    render(<ScreenShareQualityModal open={false} onClose={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.queryByText('Choose share quality')).not.toBeInTheDocument();
  });

  it('pre-selects the last stored quality', () => {
    vi.mocked(screenShareQuality.getLastScreenShareQuality).mockReturnValue('hd');

    render(<ScreenShareQualityModal open onClose={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.getByLabelText('HD (720p)')).toBeChecked();
    expect(screen.getByLabelText('FHD (1080p)')).not.toBeChecked();
  });

  it('confirms with the selected quality and remembers it', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ScreenShareQualityModal open onClose={vi.fn()} onConfirm={onConfirm} />);

    await user.click(screen.getByLabelText('HD (720p)'));
    await user.click(screen.getByRole('button', { name: 'Share' }));

    expect(screenShareQuality.setLastScreenShareQuality).toHaveBeenCalledWith('hd');
    expect(onConfirm).toHaveBeenCalledWith('hd');
  });

  it('cancels without confirming or saving a preference', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(<ScreenShareQualityModal open onClose={onClose} onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screenShareQuality.setLastScreenShareQuality).not.toHaveBeenCalled();
  });
});
