import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlotTelemetryDrawer, type HazardEvaluation } from '@/components/chat/PlotTelemetryDrawer';

const empty = { ph: null, soc: null, moisture: null, temp: null, loading: false };
const idle: HazardEvaluation = { conversationId: 'c1', status: 'idle', hazards: [] };

describe('PlotTelemetryDrawer', () => {
  it('prefers live readings and labels their source', () => {
    render(
      <PlotTelemetryDrawer
        farmer={{ ndvi: 0.72, ph: 5.1 }}
        telemetry={{ ...empty, ph: 6.2, soc: 14, temp: 24 }}
        hazardEval={idle}
      />,
    );
    expect(screen.getByText('0.72 (Optimal)')).toBeInTheDocument();
    expect(screen.getByText('6.2 pH / 14 g/kg SOC')).toBeInTheDocument();
    expect(screen.getByText('ISRIC SoilGrids 250m • live')).toBeInTheDocument();
    expect(screen.getByText('24°C')).toBeInTheDocument();
    expect(screen.getByText('Add farmer region for live hazard evaluation')).toBeInTheDocument();
  });

  it('falls back to cached farmer values, then to a dash', () => {
    const { rerender } = render(<PlotTelemetryDrawer farmer={{ ph: 5.1, ndvi: 0.2 }} telemetry={empty} hazardEval={idle} />);
    expect(screen.getByText('5.1 pH')).toBeInTheDocument();
    expect(screen.getByText('ISRIC SoilGrids 250m • cached')).toBeInTheDocument();
    expect(screen.getByText('0.20 (Low)')).toBeInTheDocument();

    rerender(<PlotTelemetryDrawer telemetry={empty} hazardEval={idle} />);
    expect(screen.getByText('ISRIC SoilGrids 250m • no farmer geo')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
  });

  it('states forecast hazards as estimates, never as a diagnosis', () => {
    render(
      <PlotTelemetryDrawer
        telemetry={empty}
        hazardEval={{
          conversationId: 'c1', status: 'ready', evaluatedDays: 5, totalDays: 7,
          hazards: [{ hazardType: 'heat', threatLevel: 'high', title: 'Heat stress window Thu–Fri' }, { hazardType: 'rain', threatLevel: 'low', title: 'x' }],
        }}
      />,
    );
    expect(screen.getByText('2 hazard windows')).toBeInTheDocument();
    expect(screen.getByText('Heat stress window Thu–Fri')).toBeInTheDocument();
    expect(screen.getByText(/Estimated thresholds only • 5\/7 days evaluated • not an outbreak diagnosis/)).toBeInTheDocument();
  });
});
