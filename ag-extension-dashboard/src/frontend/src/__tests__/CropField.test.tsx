import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@/services/edgeModelManifest', () => ({
  releasedEdgeModels: vi.fn().mockResolvedValue([{ labels: ['corn___rust', 'rice___blast', 'date_palm___healthy'] }]),
}));

import { CropField } from '@/components/edgeVision/CropField';

describe('CropField', () => {
  it("suggests the crops the phone's model knows", async () => {
    const { container } = render(<CropField value="" onChange={() => undefined} />);
    await waitFor(() => expect(container.querySelectorAll('datalist option')).toHaveLength(3));
    expect([...container.querySelectorAll('datalist option')].map(o => o.getAttribute('value'))).toEqual(['Date palm', 'Maize', 'Rice']);
    expect(screen.getByLabelText(/crop/i)).toHaveAttribute('list', 'diagnosis-photo-crop-options');
  });
});
