import Linkify from 'linkify-react';
import type { Opts } from 'linkifyjs';

interface MessageContentProps {
  content: string;
}

const linkifyOptions: Opts = {
  defaultProtocol: 'https',
  target: '_blank',
  rel: 'noopener noreferrer',
  className: 'text-brand hover:underline',
  validate: {
    // Only linkify URLs the author typed with an explicit http(s) protocol -
    // linkify's default bare-domain matching produces too many false positives
    // (version numbers, abbreviations, etc.) in chat text.
    url: (value) => /^https?:\/\//i.test(value),
    email: () => false,
  },
};

export function MessageContent({ content }: MessageContentProps) {
  return (
    <Linkify
      as="p"
      options={linkifyOptions}
      data-testid="message-content"
      className="whitespace-pre-wrap text-body text-ink"
    >
      {content}
    </Linkify>
  );
}
