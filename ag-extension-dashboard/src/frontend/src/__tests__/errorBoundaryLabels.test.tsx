import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '@ag-extension/shared';

function Broken(): JSX.Element {
  throw new Error('boom');
}

describe('error screen text', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows the labels it is given and English for any it is not', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ErrorBoundary componentName="MainContent" labels={{ title: 'Hitilafu imetokea', tryAgain: 'Jaribu tena' }}>
        <Broken />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('heading', { name: 'Hitilafu imetokea' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jaribu tena' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
  });
});
