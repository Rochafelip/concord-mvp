import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Attachment, Message } from '../../types/message';
import * as hooksModule from './hooks';
import { MessageList } from './MessageList';

vi.mock('./hooks', () => ({
  useMessageHistory: vi.fn(),
}));

// MessageList imports useMarkChannelAsRead from the channels feature, not from ./hooks — mocking
// it on ./hooks left the real one in place, which needs a QueryClientProvider these tests don't
// set up.
vi.mock('../channels/hooks', () => ({
  useMarkChannelAsRead: vi.fn(() => ({ mutate: vi.fn() })),
}));

function attachment(
  url: string,
  fileName: string | null = null,
  fileSize: number | null = null,
): Attachment {
  return { url, fileName, fileSize };
}

function makeMessage(
  id: string,
  content: string,
  createdAt: string,
  attachments: Attachment[] = [],
): Message {
  return {
    id,
    channelId: 'c1',
    author: { id: 'u1', username: 'alice', displayName: 'Alice', avatarUrl: null },
    content,
    attachments,
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

  it('shows a date divider between messages sent on different calendar days', () => {
    mockHistory({
      data: {
        pages: [
          [
            makeMessage('m1', 'Msg1', '2026-01-01T12:00:00Z'),
            makeMessage('m2', 'Msg2', '2026-01-05T12:00:00Z'),
          ],
        ],
        pageParams: [undefined],
      },
    });

    render(<MessageList channelId="c1" />);

    expect(screen.getAllByTestId('date-divider')).toHaveLength(2);
  });

  it('does not show a date divider between messages sent on the same calendar day', () => {
    mockHistory({
      data: {
        pages: [
          [
            makeMessage('m1', 'Msg1', '2026-01-01T12:00:00Z'),
            makeMessage('m2', 'Msg2', '2026-01-01T13:00:00Z'),
          ],
        ],
        pageParams: [undefined],
      },
    });

    render(<MessageList channelId="c1" />);

    expect(screen.getAllByTestId('date-divider')).toHaveLength(1);
  });

  it('renders an image inline when an attachment URL has a known image extension', () => {
    mockHistory({
      data: {
        pages: [[makeMessage('m1', '', '2026-01-01T00:00:00Z', [attachment('/api/v1/uploads/abc.png')])]],
        pageParams: [undefined],
      },
    });

    render(<MessageList channelId="c1" />);

    expect(screen.getByRole('img')).toHaveAttribute('src', '/api/v1/uploads/abc.png');
  });

  it('opens a full-size lightbox when the image is clicked, and closes it on Escape', async () => {
    mockHistory({
      data: {
        pages: [[makeMessage('m1', '', '2026-01-01T00:00:00Z', [attachment('/api/v1/uploads/abc.png')])]],
        pageParams: [undefined],
      },
    });
    const user = userEvent.setup();

    render(<MessageList channelId="c1" />);
    await user.click(screen.getByRole('img'));

    // Not asserted by counting every img role: the modal now marks the rest of the page
    // aria-hidden while open (Radix Dialog's a11y behavior), which drops the thumbnail out of
    // the accessibility tree — the lightbox image is the one that must appear.
    expect(screen.getByRole('img', { name: 'Full-size attachment' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('img', { name: 'Full-size attachment' })).not.toBeInTheDocument();
  });

  it('renders a PDF preview and download link (not an <img>)', () => {
    mockHistory({
      data: {
        pages: [[makeMessage('m1', '', '2026-01-01T00:00:00Z', [attachment('/api/v1/uploads/abc.pdf', 'report.pdf', 20480)])]],
        pageParams: [undefined],
      },
    });

    render(<MessageList channelId="c1" />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    const iframe = screen.getByTitle('report.pdf');
    expect(iframe).toHaveAttribute('src', '/api/v1/uploads/abc.pdf');
    // Defense in depth (security audit A10): no allow-scripts, so a payload disguised as
    // `.pdf` can't execute even if the backend's magic-byte check were ever bypassed.
    expect(iframe).toHaveAttribute('sandbox', 'allow-same-origin');
    const link = screen.getByRole('link', { name: /report\.pdf/i });
    expect(link).toHaveAttribute('href', '/api/v1/uploads/abc.pdf');
    expect(link).toHaveAttribute('download', 'report.pdf');
    expect(screen.getByText(/20\.0 KB/i)).toBeInTheDocument();
  });

  it('does not render an image or a chip for a text-only message', () => {
    mockHistory({
      data: {
        pages: [[makeMessage('m1', 'just text', '2026-01-01T00:00:00Z')]],
        pageParams: [undefined],
      },
    });

    render(<MessageList channelId="c1" />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByTestId('message-attachments')).not.toBeInTheDocument();
  });

  it('renders every attachment of a multi-attachment message, in order', () => {
    mockHistory({
      data: {
        pages: [[makeMessage('m1', 'three shots', '2026-01-01T00:00:00Z', [
          attachment('/api/v1/uploads/a.png', 'a.png'),
          attachment('/api/v1/uploads/b.png', 'b.png'),
          attachment('/api/v1/uploads/c.webp', 'c.webp'),
        ])]],
        pageParams: [undefined],
      },
    });

    render(<MessageList channelId="c1" />);

    expect(screen.getAllByRole('img').map((img) => img.getAttribute('src'))).toEqual([
      '/api/v1/uploads/a.png',
      '/api/v1/uploads/b.png',
      '/api/v1/uploads/c.webp',
    ]);
    expect(screen.getByText('three shots')).toBeInTheDocument();
  });

  it('renders a mix of image and non-image attachments on the same message', () => {
    mockHistory({
      data: {
        pages: [[makeMessage('m1', '', '2026-01-01T00:00:00Z', [
          attachment('/api/v1/uploads/shot.png', 'shot.png'),
          attachment('/api/v1/uploads/notes.zip', 'notes.zip', 2048),
        ])]],
        pageParams: [undefined],
      },
    });

    render(<MessageList channelId="c1" />);

    expect(screen.getByRole('img')).toHaveAttribute('src', '/api/v1/uploads/shot.png');
    const link = screen.getByRole('link', { name: /notes\.zip/i });
    expect(link).toHaveAttribute('href', '/api/v1/uploads/notes.zip');
    expect(link).toHaveAttribute('download', 'notes.zip');
  });

  it('opens the clicked image in the lightbox, not the first one of the message', async () => {
    mockHistory({
      data: {
        pages: [[makeMessage('m1', '', '2026-01-01T00:00:00Z', [
          attachment('/api/v1/uploads/first.png'),
          attachment('/api/v1/uploads/second.png'),
        ])]],
        pageParams: [undefined],
      },
    });
    const user = userEvent.setup();

    render(<MessageList channelId="c1" />);
    await user.click(screen.getAllByRole('img')[1]);

    expect(screen.getByAltText('Full-size attachment')).toHaveAttribute(
      'src',
      '/api/v1/uploads/second.png',
    );
  });
});
