import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SoilNutrientHeatmapCanvas } from '../SoilNutrientHeatmapCanvas';
import { soilAdvisory } from '../soilAdvisory';

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

describe('soil probe advice', () => {
  const ph: [number, number] = [6.0, 7.2];

  it('calls values at either end of the target range optimal', () => {
    expect(soilAdvisory(6.0, ph, 'pH').status).toBe('optimal');
    expect(soilAdvisory(7.2, ph, 'pH').status).toBe('optimal');
  });

  it('calls values outside it a warning, and asks for a lab test rather than prescribing', () => {
    expect(soilAdvisory(5.8, ph, 'pH')).toEqual({
      status: 'warning',
      recommendation: 'Below the 6–7.2 pH target range. Confirm with a lab soil test before acting.',
    });
    expect(soilAdvisory(7.5, ph, 'pH')).toEqual({
      status: 'warning',
      recommendation: 'Above the 6–7.2 pH target range. Confirm with a lab soil test before acting.',
    });
    expect(soilAdvisory(4.2, ph, 'pH').status).not.toBe('critical');
  });
});
