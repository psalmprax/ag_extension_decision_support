import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { PhonePreviewPanel, PREVIEW_OPEN_KEY } from '../pages/advisoryStudio/PhonePreviewPanel';
import { DEFAULT_TEMPLATES } from '../pages/advisoryStudio/studioModel';

const steps = DEFAULT_TEMPLATES.maize_armyworm!.steps;
const toggle = () => screen.getByRole('button', { name: 'Mobile PWA preview' });
const phone = () => screen.queryByText('Preview of what an officer sees');

describe('PhonePreviewPanel', () => {
  beforeEach(() => window.localStorage.clear());

  it('starts open, with the phone and its note', () => {
    render(<PhonePreviewPanel steps={steps} />);
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(phone()).toBeInTheDocument();
    expect(screen.getByText('Offline ready')).toBeInTheDocument();
  });

  it('folds away to its heading, and opens again', () => {
    render(<PhonePreviewPanel steps={steps} />);
    fireEvent.click(toggle());

    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(phone()).not.toBeInTheDocument();
    expect(document.getElementById(toggle().getAttribute('aria-controls')!)).toHaveAttribute('hidden');
    // Folded on a wide screen, it is a narrow strip, not a full-width panel over the canvas.
    expect(screen.getByRole('complementary', { name: 'Mobile PWA preview' })).toHaveClass('lg:w-12');

    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(phone()).toBeInTheDocument();
  });

  it('remembers that it was closed', () => {
    const { unmount } = render(<PhonePreviewPanel steps={steps} />);
    fireEvent.click(toggle());
    expect(window.localStorage.getItem(PREVIEW_OPEN_KEY)).toBe('false');
    unmount();

    render(<PhonePreviewPanel steps={steps} />);
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(phone()).not.toBeInTheDocument();
  });

  it('has a set width beside the canvas on a wide screen', () => {
    // The panel used lg:w-84, which is not on Tailwind's scale: the class did nothing, so the
    // panel stayed full width and covered the canvas. w-80 (320px) is on the scale.
    render(<PhonePreviewPanel steps={steps} />);
    expect(screen.getByRole('complementary', { name: 'Mobile PWA preview' })).toHaveClass('lg:w-80');
  });
});
