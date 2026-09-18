import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScreenShareHoverPreview } from './ScreenShareHoverPreview';
import { useScreenSharePreview } from './useScreenSharePreview';

vi.mock('./useScreenSharePreview');

describe('ScreenShareHoverPreview', () => {
  it('shows a loading state while connecting', () => {
    vi.mocked(useScreenSharePreview).mockReturnValue({ status: 'connecting', track: null });

    render(<ScreenShareHoverPreview channelId="c1" identity="bob" displayName="Bob" />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.queryByTestId('screen-share-preview-video')).not.toBeInTheDocument();
  });

  it('shows an unavailable message when the preview cannot be shown', () => {
    vi.mocked(useScreenSharePreview).mockReturnValue({ status: 'unavailable', track: null });

    render(<ScreenShareHoverPreview channelId="c1" identity="bob" displayName="Bob" />);

    expect(screen.getByText(/unavailable/i)).toBeInTheDocument();
    expect(screen.queryByTestId('screen-share-preview-video')).not.toBeInTheDocument();
  });

  it('attaches the track to a muted video element once ready', () => {
    const attach = vi.fn();
    const detach = vi.fn();
    vi.mocked(useScreenSharePreview).mockReturnValue({
      status: 'ready',
      track: { attach, detach } as never,
    });

    const { unmount } = render(<ScreenShareHoverPreview channelId="c1" identity="bob" displayName="Bob" />);

    const video = screen.getByTestId('screen-share-preview-video');
    expect(video).toHaveProperty('muted', true);
    expect(attach).toHaveBeenCalledWith(video);

    unmount();
    expect(detach).toHaveBeenCalledWith(video);
  });

  it('labels the popover with the sharer\'s name for assistive tech', () => {
    vi.mocked(useScreenSharePreview).mockReturnValue({ status: 'connecting', track: null });

    render(<ScreenShareHoverPreview channelId="c1" identity="bob" displayName="Bob" />);

    expect(screen.getByRole('tooltip', { name: "Bob's screen" })).toBeInTheDocument();
  });
});
