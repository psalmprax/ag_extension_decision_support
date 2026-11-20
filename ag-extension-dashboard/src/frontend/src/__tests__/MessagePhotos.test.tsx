import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MessagePhotos } from '@/components/chat/MessagePhotos';

const photos = [
  { id: 'a', url: '/api/v1/upload/file/a.png', name: 'leaf.png', mimeType: 'image/png' },
  { id: 'b', url: '/api/v1/upload/file/b.png', name: 'stem.png', mimeType: 'image/png' },
];

describe('photos in a chat message', () => {
  it('opens a photo full size inside the app, not in a new tab', async () => {
    render(<MessagePhotos photos={photos} label="Photo from Farmer" />);
    expect(screen.queryByRole('link', { name: /leaf/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open photo from farmer 1: leaf.png' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('leaf.png');
    expect(dialog).toHaveTextContent('1 of 2');
    // The page behind the open viewer is hidden; the one image left is the full-size photo.
    expect(screen.getByRole('img', { name: 'Photo from Farmer 1: leaf.png' })).toHaveClass('object-contain');
    expect(screen.getByRole('link', { name: 'Download leaf.png' })).toHaveAttribute('href', photos[0].url);
  });

  it('steps between photos and closes', async () => {
    render(<MessagePhotos photos={photos} label="Photo from Farmer" />);
    fireEvent.click(screen.getByRole('button', { name: 'Open photo from farmer 1: leaf.png' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Next photo' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('2 of 2');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByRole('dialog')).toHaveTextContent('1 of 2');
    fireEvent.click(screen.getByRole('button', { name: 'Close photo' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows nothing when a message has no photos', () => {
    const { container } = render(<MessagePhotos photos={[]} label="Photo from Farmer" />);
    expect(container).toBeEmptyDOMElement();
  });
});
