import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { motionValue } from 'framer-motion';
import { DemoPage } from '../pages/DemoPage';
import { UssdGatewayTester } from '../components/telecom/UssdGatewayTester';
import { AgentOS } from '../pages/landing/sections/AgentOS';
import { SANDBOX_PRESETS } from '../pages/landing/data';
import { Hero } from '../pages/landing/sections/Hero';
import { FarmerServices } from '../pages/landing/sections/FarmerServices';
import { TrustAndSafety } from '../pages/landing/sections/TrustAndSafety';
import { AgroEcosystemCanvasScrubber } from '../components/canvas-ui/AgroEcosystemCanvasScrubber';

vi.mock('@/components/canvas-ui/CanvasUiLab', () => ({ CanvasUiLab: () => null }));
vi.mock('@/components/landing/Visuals', () => ({ GlobalConstellationVisualization: () => null }));

describe('public demos', () => {
  beforeEach(() => vi.spyOn(window, 'scrollTo').mockImplementation(() => {}));
  it('presents scripted responses without claiming retrieval, verified sources or treatment rates', () => {
    render(<MemoryRouter><DemoPage initialTab="rag" /></MemoryRouter>);
    expect(screen.getByText(/No AI or knowledge search is run/)).toBeInTheDocument();
    for (const query of [
      'How do I diagnose and treat Maize Rust?',
      'Recommend soil recovery plan for high acidity (pH 4.8).',
      'What is the rainfall forecast impact on Cassava planting in Eastern region?',
    ]) {
      fireEvent.click(screen.getByRole('button', { name: query }));
      expect(screen.getByText(/Example only; not a diagnosis or verified advice/)).toBeInTheDocument();
      expect(screen.queryByText(/Source Verified|tonnes\/ha|Apply triazole/i)).not.toBeInTheDocument();
    }
  });

  it('does not claim that the example summary was saved or sent', () => {
    render(<MemoryRouter><DemoPage initialTab="synthesis" /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /Preview example summary/ }));
    expect(screen.getByText(/Example summary \(not saved or dispatched\)/)).toBeInTheDocument();
    expect(screen.getByText(/No record or message was sent/)).toBeInTheDocument();
  });

  it('labels sample telemetry as illustrative rather than live', () => {
    render(<MemoryRouter><DemoPage initialTab="telemetry" /></MemoryRouter>);
    expect(screen.getByText(/Illustrative telemetry \(not live\)/)).toBeInTheDocument();
    expect(screen.getByText(/not field measurements/)).toBeInTheDocument();
  });

  it('uses observation and expert-review guidance in the scrubber canvas', () => {
    const fillText = vi.fn();
    const gradient = { addColorStop: vi.fn() };
    const context = new Proxy(
      {
        fillText,
        createRadialGradient: vi.fn(() => gradient),
        createLinearGradient: vi.fn(() => gradient),
      },
      {
        get: (target, property) =>
          property in target ? target[property as keyof typeof target] : vi.fn(),
      }
    );
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(context as unknown as CanvasRenderingContext2D);
    const { container, unmount } = render(
      <AgroEcosystemCanvasScrubber progress={0.9} autoPlay={false} />
    );
    const scrubber = container.firstElementChild as HTMLDivElement;
    Object.defineProperties(scrubber, {
      clientWidth: { configurable: true, value: 600 },
      clientHeight: { configurable: true, value: 400 },
    });
    const getBoundingClientRect = vi.spyOn(scrubber, 'getBoundingClientRect').mockReturnValue({
      width: 600,
      height: 400,
    } as DOMRect);
    try {
      fireEvent(window, new Event('resize'));

      expect(fillText).toHaveBeenCalledWith('OBSERVATION', expect.any(Number), expect.any(Number));
      expect(fillText).toHaveBeenCalledWith('Review field data', expect.any(Number), expect.any(Number));
      expect(fillText).toHaveBeenCalledWith('Seek expert review', expect.any(Number), expect.any(Number));
      expect(fillText).not.toHaveBeenCalledWith('Apply 2.5t Lime', expect.any(Number), expect.any(Number));
      expect(fillText).not.toHaveBeenCalledWith('Before Rain: 48h', expect.any(Number), expect.any(Number));
    } finally {
      unmount();
      getBoundingClientRect.mockRestore();
      getContext.mockRestore();
    }
  });

  it('keeps telecom examples local and never reports delivery or a booking', () => {
    render(<UssdGatewayTester />);
    fireEvent.click(screen.getByRole('button', { name: /Simulate dialing/ }));
    fireEvent.change(screen.getByPlaceholderText('Reply...'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByText(/No SMS was sent/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'SMS Broadcaster' }));
    fireEvent.change(screen.getByLabelText(/Example recipient/), { target: { value: 'example recipient' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add local preview' }));
    const preview = screen.getByText('Local previews (not sent)').parentElement;
    expect(preview).not.toBeNull();
    expect(within(preview!).getByText('Preview only')).toBeInTheDocument();
    expect(screen.queryByText(/Delivered|successfully dispatched/)).not.toBeInTheDocument();
  });

  it('marks landing simulations and messages as fictional for every preset', () => {
    for (const preset of SANDBOX_PRESETS) {
      const { unmount } = render(<AgentOS activePreset={preset} setActivePreset={vi.fn()}
        handleRunSimulation={vi.fn()} isSimulating={false} simProgress={4}
        activeChannelTab="sms" setActiveChannelTab={vi.fn()} />);
      expect(screen.getByText(/no messages or visits are sent or queued/i)).toBeInTheDocument();
      expect(screen.getByText(/PREVIEW ONLY — NOT SENT/)).toBeInTheDocument();
      expect(screen.getByText('Not verified')).toBeInTheDocument();
      expect(screen.getByText(preset.channelPreview.sms)).toBeInTheDocument();
      expect(screen.queryByText(/SOURCE: FIELD_VISIT_CONSENSUS|DISPATCHED \(45\/45\)/)).not.toBeInTheDocument();
      unmount();
    }
  });

  it('does not present the landing-page examples as verified treatment or live forecasts', () => {
    render(<MemoryRouter><Hero heroY={motionValue(0)} heroOpacity={motionValue(1)} /><FarmerServices /><TrustAndSafety /></MemoryRouter>);
    expect(screen.getByText('Illustration, not a diagnosis')).toBeInTheDocument();
    expect(screen.getByText(/This illustration is not a forecast/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Consult' }));
    expect(screen.getByText(/locally authorized options before treatment/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Read in Your Dialect' }));
    fireEvent.click(screen.getByRole('button', { name: 'Switch text to English' }));
    expect(screen.getByText(/Contact your local extension officer/)).toBeInTheDocument();
    expect(screen.queryByText(/Mix two tablespoons|safe spray doses|scientifically proven protocols/i)).not.toBeInTheDocument();
  });
});
