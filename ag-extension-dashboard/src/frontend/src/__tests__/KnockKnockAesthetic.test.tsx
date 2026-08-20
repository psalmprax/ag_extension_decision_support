import React, { ReactNode } from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FloatingAIPill } from '../components/FloatingAIPill';
import { LiveActivityStream } from '../components/LiveActivityStream';
import { USSDSimulatorDrawer } from '../components/USSDSimulatorDrawer';
import { renderWithLanguage } from '../test/languageTestUtils';

// Mock framer-motion to avoid animation timing issues in test environment
vi.mock('framer-motion', () => {
  type MotionMockProps = { children?: ReactNode; [key: string]: unknown };
  const motionOnlyProps = new Set([
    'animate',
    'exit',
    'initial',
    'layout',
    'layoutId',
    'onAnimationComplete',
    'onAnimationStart',
    'transition',
    'variants',
    'viewport',
    'whileHover',
    'whileInView',
    'whileTap',
  ]);

  const mockComponent = ({ children, ...props }: MotionMockProps) => {
    const domProps = Object.fromEntries(
      Object.entries(props).filter(([key]) => !motionOnlyProps.has(key))
    );
    return <div {...domProps}>{children}</div>;
  };

  return {
    motion: {
      div: mockComponent,
      section: mockComponent,
      article: mockComponent,
      button: mockComponent,
      h1: mockComponent,
      h2: mockComponent,
      p: mockComponent,
      span: mockComponent,
    },
    AnimatePresence: ({ children }: MotionMockProps) => <>{children}</>,
  };
});

describe('KnockKnock Aesthetic Component Suite', () => {
  describe('FloatingAIPill Component', () => {
    it('renders the docked floating pill in initial state', async () => {
      await renderWithLanguage(<FloatingAIPill />);

      expect(screen.getByText('AI Agronomist')).toBeInTheDocument();
      expect(screen.getByText('ONLINE')).toBeInTheDocument();
    });

    it('expands into the multimodal drawer upon click', async () => {
      await renderWithLanguage(<FloatingAIPill />);

      const pillButton = screen.getByRole('button', { name: /AI Agronomist/i });
      fireEvent.click(pillButton);

      expect(screen.getByText('Multimodal Decision Support')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Chat/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Leaf Scan/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Voice/i })).toBeInTheDocument();
    });

    it('switches to Leaf Scan tab and simulates analysis', async () => {
      await renderWithLanguage(<FloatingAIPill />);

      // Open drawer
      fireEvent.click(screen.getByRole('button', { name: /AI Agronomist/i }));

      // Switch to leaf scan
      fireEvent.click(screen.getByRole('button', { name: /Leaf Scan/i }));
      expect(screen.getByText('Upload or Capture Leaf Photo')).toBeInTheDocument();

      // Trigger scan
      const scanBtn = screen.getByRole('button', { name: /Select Leaf Sample/i });
      fireEvent.click(scanBtn);

      await waitFor(() => {
        expect(screen.getByText(/Late Blight/i)).toBeInTheDocument();
        expect(screen.getByText(/94% Match/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('switches to Voice tab and provides transcription', async () => {
      await renderWithLanguage(<FloatingAIPill />);

      fireEvent.click(screen.getByRole('button', { name: /AI Agronomist/i }));
      fireEvent.click(screen.getByRole('button', { name: /Voice/i }));

      expect(screen.getByText(/Tap to Record Agronomic Note/i)).toBeInTheDocument();
      const recordPrompt = screen.getByText(/Tap to Record Agronomic Note/i);
      const recordBtn = recordPrompt.parentElement?.querySelector('button');
      if (recordBtn) fireEvent.click(recordBtn);

      await waitFor(() => {
        expect(screen.getByText(/AI Voice Transcription/i)).toBeInTheDocument();
      }, { timeout: 4000 });
    });
  });

  describe('LiveActivityStream Component', () => {
    it('renders activity cards with severity scores and channel badges', async () => {
      await renderWithLanguage(<LiveActivityStream />);

      expect(screen.getByText('Live Intelligence Stream')).toBeInTheDocument();
      expect(screen.getByText('Ezekiel Kiprono')).toBeInTheDocument();
      expect(screen.getByText('88/100')).toBeInTheDocument();
      expect(screen.getByText('Grace Wambui')).toBeInTheDocument();
      expect(screen.getByText('74/100')).toBeInTheDocument();
    });

    it('allows extension officer to claim and intervene on an activity', async () => {
      await renderWithLanguage(<LiveActivityStream />);

      const claimBtns = screen.getAllByRole('button', { name: /Claim & Intervene/i });
      fireEvent.click(claimBtns[0]);

      expect(screen.getByText('You (Live Takeover)')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Direct SMS Reply/i })).toBeInTheDocument();
      expect(screen.getAllByText('Release to AI Autopilot')[0]).toBeInTheDocument();
    });

    it('filters cards by critical severity', async () => {
      await renderWithLanguage(<LiveActivityStream />);

      const criticalFilterBtn = screen.getByRole('button', { name: /critical/i });
      fireEvent.click(criticalFilterBtn);

      expect(screen.getByText('Ezekiel Kiprono')).toBeInTheDocument();
      expect(screen.queryByText('Amina Mohamed')).not.toBeInTheDocument();
    });
  });

  describe('USSDSimulatorDrawer Component', () => {
    it('renders device frame with dial code when opened', async () => {
      await renderWithLanguage(
        <USSDSimulatorDrawer isOpen={true} onClose={vi.fn()} />
      );

      expect(screen.getByText('USSD & SMS Sandbox')).toBeInTheDocument();
      expect(screen.getAllByText('*384*274#')[0]).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Send USSD Request/i })).toBeInTheDocument();
    });

    it('initiates USSD session and displays main menu options', async () => {
      await renderWithLanguage(
        <USSDSimulatorDrawer isOpen={true} onClose={vi.fn()} />
      );

      const dialBtn = screen.getByRole('button', { name: /Send USSD Request/i });
      fireEvent.click(dialBtn);

      expect(screen.getByText(/1. Diagnose Crop Disease/i)).toBeInTheDocument();
      expect(screen.getByText(/2. Weather & Pest Alerts/i)).toBeInTheDocument();
      expect(screen.getByText(/3. Request Field Officer Call/i)).toBeInTheDocument();
    });

    it('navigates through diagnosis branch upon user response', async () => {
      await renderWithLanguage(
        <USSDSimulatorDrawer isOpen={true} onClose={vi.fn()} />
      );

      fireEvent.click(screen.getByRole('button', { name: /Send USSD Request/i }));

      const input = screen.getByPlaceholderText('Reply...');
      fireEvent.change(input, { target: { value: '1' } });
      fireEvent.click(screen.getByRole('button', { name: /Send/i }));

      expect(screen.getByText(/Describe your crop symptoms/i)).toBeInTheDocument();
    });

    it('triggers escalation callback when officer request option is chosen', async () => {
      const mockEscalate = vi.fn();
      await renderWithLanguage(
        <USSDSimulatorDrawer isOpen={true} onClose={vi.fn()} onEscalate={mockEscalate} />
      );

      fireEvent.click(screen.getByRole('button', { name: /Send USSD Request/i }));

      const input = screen.getByPlaceholderText('Reply...');
      fireEvent.change(input, { target: { value: '3' } });
      fireEvent.click(screen.getByRole('button', { name: /Send/i }));

      expect(mockEscalate).toHaveBeenCalledWith(
        expect.stringContaining('Simulated Farmer'),
        expect.stringContaining('USSD')
      );
    });
  });
});
