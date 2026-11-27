import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { motionValue } from 'framer-motion';
import { DemoPage } from '../pages/DemoPage';
import { UssdGatewayTester } from '../components/telecom/UssdGatewayTester';
import { Hero } from '../pages/landing/sections/Hero';
import { FarmerServices } from '../pages/landing/sections/FarmerServices';
import { TrustAndSafety } from '../pages/landing/sections/TrustAndSafety';
import { AgentOS } from '../pages/landing/sections/AgentOS';
import { Pipeline } from '../pages/landing/sections/Pipeline';
import { Ecosystem } from '../pages/landing/sections/Ecosystem';
import { SANDBOX_PRESETS } from '../pages/landing/sectionData';
import { englishT } from '../test/englishT';
import { AgroEcosystemCanvasScrubber } from '../components/canvas-ui/AgroEcosystemCanvasScrubber';

vi.mock('@/components/landing/Visuals', () => ({ GlobalConstellationVisualization: () => null }));

describe('public demos', () => {
  beforeEach(() => vi.spyOn(window, 'scrollTo').mockImplementation(() => {}));

  it('marks landing simulations and messages as fictional for every scenario', () => {
    render(<MemoryRouter><AgentOS /></MemoryRouter>);
    expect(screen.getByText(/no messages or visits are sent or queued/i)).toBeInTheDocument();
    for (const preset of SANDBOX_PRESETS) {
      const title = new RegExp(englishT(preset.title));
      fireEvent.click(screen.getByRole('button', { name: title }));
      expect(screen.getByRole('button', { name: title })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText('Preview only — not sent')).toBeInTheDocument();
      expect(screen.getByText('Not verified')).toBeInTheDocument();
      expect(screen.getByText(englishT(preset.channelPreview.sms))).toBeInTheDocument();
      expect(screen.getByText(new RegExp(`Illustrative ${englishT(preset.targetCrop)} scenario in ${preset.targetRegion}; no farmers were identified`))).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole('button', { name: 'WhatsApp' }));
    expect(screen.getByText(englishT(SANDBOX_PRESETS[2].channelPreview.whatsapp))).toBeInTheDocument();
    expect(screen.queryByText(/SOURCE: FIELD_VISIT_CONSENSUS|DISPATCHED \(45\/45\)/)).not.toBeInTheDocument();
  });

  it('tells the pipeline story for each audience, one stage at a time', () => {
    render(<MemoryRouter><Pipeline /></MemoryRouter>);
    expect(screen.getByText('Orbital recon & atmospheric ingestion')).toBeInTheDocument();
    // Stage and audience buttons are named by the text they show.
    fireEvent.click(screen.getByRole('button', { name: /SoilGrids/ }));
    expect(screen.getByText('Topsoil properties from SoilGrids')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /SoilGrids/ })).toHaveAttribute('aria-current', 'step');
    fireEvent.click(screen.getByRole('button', { name: 'Agribusiness & co-ops' }));
    expect(screen.getByText('Input efficiency & fertilizer optimization')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
    expect(screen.getByText(/SAP\/NetSuite connector — not yet integrated/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try demo/ })).toBeInTheDocument();
  });

  it('labels the intelligence trail as example values, not a live feed', () => {
    render(<Ecosystem />);
    expect(screen.getByText('Illustrative sample')).toBeInTheDocument();
    expect(screen.getByText('Example values — not a live feed')).toBeInTheDocument();
  });
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

  it('uses observation and expert-review guidance in the season illustration, never a product rate', () => {
    const { unmount } = render(<AgroEcosystemCanvasScrubber progress={0.9} autoPlay={false} />);
    try {
      expect(screen.getByText('Observation')).toBeInTheDocument();
      expect(screen.getByText('Review field data')).toBeInTheDocument();
      expect(screen.getByText('Seek expert review')).toBeInTheDocument();
      expect(screen.queryByText(/Apply 2\.5t Lime|Before Rain: 48h/)).not.toBeInTheDocument();
    } finally {
      unmount();
    }
  });

  it('keeps telecom examples local and never reports delivery or a booking', () => {
    render(<UssdGatewayTester />);
    fireEvent.click(screen.getByRole('button', { name: /Simulate dialing/ }));
    fireEvent.change(screen.getByPlaceholderText('Reply...'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByText(/No SMS was sent/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'SMS broadcaster' }));
    fireEvent.change(screen.getByLabelText(/Example recipient/), { target: { value: 'example recipient' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add local preview' }));
    const preview = screen.getByText('Local previews (not sent)').parentElement;
    expect(preview).not.toBeNull();
    expect(within(preview!).getByText('Preview only')).toBeInTheDocument();
    expect(screen.queryByText(/Delivered|successfully dispatched/)).not.toBeInTheDocument();
  });

  it('does not present the landing-page examples as verified treatment or live forecasts', () => {
    render(<MemoryRouter><Hero heroY={motionValue(0)} heroOpacity={motionValue(1)} /><FarmerServices /><TrustAndSafety /></MemoryRouter>);
    expect(screen.getByText('Illustrative preview')).toBeInTheDocument();
    expect(screen.getByText(/This illustration is not a forecast/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Consult' }));
    expect(screen.getByText(/locally authorized options before treatment/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Read in your dialect' }));
    fireEvent.click(screen.getByRole('button', { name: 'Switch text to English' }));
    expect(screen.getByText(/Contact your local extension officer/)).toBeInTheDocument();
    expect(screen.queryByText(/Mix two tablespoons|safe spray doses|scientifically proven protocols/i)).not.toBeInTheDocument();
  });
});
