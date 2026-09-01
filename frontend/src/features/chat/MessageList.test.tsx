import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Message } from '../../types/message';
import * as hooksModule from './hooks';
import { MessageList } from './MessageList';

vi.mock('./hooks', () => ({
  useMessageHistory: vi.fn(),
}));

function makeMessage(id: string, content: string, createdAt: string): Message {
  return {
    id,
    channelId: 'c1',
    author: { id: 'u1', username: 'alice', displayName: 'Alice', avatarUrl: null },
    content,
    createdAt,
  };
}

type UseMessageHistoryReturn = ReturnType<typeof hooksModule.useMessageHistory>;

function mockHistory(overrides: Partial<UseMessageHistoryReturn>) {
  vi.mocked(hooksModule.useMessageHistory).mockReturnValue({
    data: undefined,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isPending: false,
    ...overrides,
  } as unknown as UseMessageHistoryReturn);
}

describe('MessageList', () => {
  it('renders messages in true chronological order when combining multiple pages', () => {
    // data.pages is ordered [newest-fetched, oldest-fetched] (getNextPageParam = "next OLDER
    // page"); each page is oldest-first internally. Rendering must reverse the PAGES array,
    // not the messages within a page, to end up oldest-to-newest overall.
    const newestFetchedPage = [
      makeMessage('m3', 'Msg3', '2026-01-01T00:00:02Z'),
      makeMessage('m4', 'Msg4', '2026-01-01T00:00:03Z'),
    ];
    const olderFetchedPage = [
      makeMessage('m1', 'Msg1', '2026-01-01T00:00:00Z'),
      makeMessage('m2', 'Msg2', '2026-01-01T00:00:01Z'),
    ];

    mockHistory({
      data: {
        pages: [newestFetchedPage, olderFetchedPage],
        pageParams: [undefined, { before: '2026-01-01T00:00:02Z', beforeId: 'm3' }],
      },
    });

    render(<MessageList channelId="c1" />);

    const contents = screen.getAllByTestId('message-content').map((el) => el.textContent);
    expect(contents).toEqual(['Msg1', 'Msg2', 'Msg3', 'Msg4']);
  });

  it('shows a loading state while the initial page is pending', () => {
    mockHistory({ isPending: true, data: undefined });

    render(<MessageList channelId="c1" />);

    expect(screen.getByText(/loading messages/i)).toBeInTheDocument();
    expect(screen.queryByTestId('message')).not.toBeInTheDocument();
  });

  it('shows a "Load older messages" button when more history is available, and hides it otherwise', () => {
    mockHistory({
      data: { pages: [[makeMessage('m1', 'Msg1', '2026-01-01T00:00:00Z')]], pageParams: [undefined] },
      hasNextPage: true,
    });
    const { rerender } = render(<MessageList channelId="c1" />);

    expect(screen.getByRole('button', { name: /load older messages/i })).toBeInTheDocument();

    mockHistory({
      data: { pages: [[makeMessage('m1', 'Msg1', '2026-01-01T00:00:00Z')]], pageParams: [undefined] },
      hasNextPage: false,
    });
    rerender(<MessageList channelId="c1" />);

    expect(screen.queryByRole('button', { name: /load older messages/i })).not.toBeInTheDocument();
  });

  it('calls fetchNextPage when "Load older messages" is clicked', async () => {
    const fetchNextPage = vi.fn();
    mockHistory({
      data: { pages: [[makeMessage('m1', 'Msg1', '2026-01-01T00:00:00Z')]], pageParams: [undefined] },
      hasNextPage: true,
      fetchNextPage,
    });

    render(<MessageList channelId="c1" />);
    screen.getByRole('button', { name: /load older messages/i }).click();

    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });
});
