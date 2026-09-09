import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NoServerSelected } from './NoServerSelected';

describe('NoServerSelected', () => {
  it('renders the Concord logo and the select-a-server message', () => {
    render(<NoServerSelected />);

    expect(screen.getByText('Concord')).toBeInTheDocument();
    expect(screen.getByText('Select a server')).toBeInTheDocument();
  });
});
