import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SoilNutrientHeatmapCanvas } from '../SoilNutrientHeatmapCanvas';

vi.mock('@/lib/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
vi.mock('@/demo/useDemoMode', () => ({ useDemoMode: () => ({ isDemo: true }) }));

describe('soil heatmap', () => {
  // No drawing in jsdom: the component skips drawing when there is no 2D context.
  beforeAll(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  it('names every layer tab differently', () => {
    render(<SoilNutrientHeatmapCanvas />);
    const names = screen.getAllByRole('button', { pressed: undefined }).map(button => button.textContent?.trim());
    expect(names).toEqual(['pH', 'Nitrogen', 'Phosphorus', 'Potassium', 'Moisture', 'Organic carbon']);
  });

  it('says the demo map is a sample, in separate sentences', () => {
    render(<SoilNutrientHeatmapCanvas />);
    expect(
      screen.getByText(
        'Sample preview, not live SoilGrids data. Add a lab soil test to show your own field. Blended from nearby sample points — not a substitute for a lab soil test.',
      ),
    ).toBeInTheDocument();
  });
});
