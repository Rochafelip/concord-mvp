import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MessageContent } from './MessageContent';

describe('MessageContent', () => {
  it('renders plain text with no URL unchanged', () => {
    render(<MessageContent content="hello world" />);

    expect(screen.getByTestId('message-content')).toHaveTextContent('hello world');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders an https:// URL as a clickable link', () => {
    render(<MessageContent content="https://example.com/page" />);

    const link = screen.getByRole('link', { name: 'https://example.com/page' });
    expect(link).toHaveAttribute('href', 'https://example.com/page');
  });

  it('renders an http:// URL as a clickable link', () => {
    render(<MessageContent content="http://example.com" />);

    const link = screen.getByRole('link', { name: 'http://example.com' });
    expect(link).toHaveAttribute('href', 'http://example.com');
  });

  it('opens links in a new tab safely', () => {
    render(<MessageContent content="https://example.com" />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('keeps surrounding text intact around a linkified URL', () => {
    render(<MessageContent content="check this out: https://example.com/page thanks!" />);

    expect(screen.getByTestId('message-content')).toHaveTextContent(
      'check this out: https://example.com/page thanks!',
    );
    expect(screen.getByRole('link', { name: 'https://example.com/page' })).toBeInTheDocument();
  });

  it('linkifies multiple URLs in the same message independently', () => {
    render(<MessageContent content="https://one.example.com and https://two.example.com" />);

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', 'https://one.example.com');
    expect(links[1]).toHaveAttribute('href', 'https://two.example.com');
  });

  it('does not linkify a bare domain without a protocol', () => {
    render(<MessageContent content="visit example.com for more" />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByTestId('message-content')).toHaveTextContent('visit example.com for more');
  });

  it('does not treat an incomplete protocol-only string as a link', () => {
    render(<MessageContent content="oops just typed http:// by mistake" />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByTestId('message-content')).toHaveTextContent(
      'oops just typed http:// by mistake',
    );
  });

  it('excludes trailing sentence punctuation from the link', () => {
    render(<MessageContent content="Check https://example.com/page." />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://example.com/page');
  });
});
