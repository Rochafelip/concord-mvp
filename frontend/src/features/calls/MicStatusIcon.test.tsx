import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MicStatusIcon } from './MicStatusIcon';

describe('MicStatusIcon', () => {
  it('shows a mic-on icon when micEnabled and not deafened', () => {
    render(<MicStatusIcon micEnabled deafened={false} />);
    expect(screen.getByTestId('mic-status-on')).toBeInTheDocument();
  });

  it('shows a mic-off icon when not micEnabled and not deafened', () => {
    render(<MicStatusIcon micEnabled={false} deafened={false} />);
    expect(screen.getByTestId('mic-status-off')).toBeInTheDocument();
  });

  it('shows the deafened icon instead of either mic icon when deafened, regardless of micEnabled', () => {
    render(<MicStatusIcon micEnabled deafened />);
    expect(screen.getByTestId('deaf-status-on')).toBeInTheDocument();
    expect(screen.queryByTestId('mic-status-on')).not.toBeInTheDocument();
  });

  it('defaults deafened to false when omitted', () => {
    render(<MicStatusIcon micEnabled={false} />);
    expect(screen.getByTestId('mic-status-off')).toBeInTheDocument();
  });
});
