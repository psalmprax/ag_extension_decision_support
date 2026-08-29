import React, { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FloatingAIPill } from '../components/FloatingAIPill';
import { LiveActivityStream, ActivityItem } from '../components/LiveActivityStream';
import { USSDSimulatorDrawer } from '../components/USSDSimulatorDrawer';
import { LanguageProvider } from '@/lib/LanguageContext';

const { MOCK_ACTIVITIES } = vi.hoisted(() => ({
  MOCK_ACTIVITIES: [
    {
      id: 'act-1',
      farmerName: 'Ezekiel Kiprono',
      phone: '+254 712 998811',
      channel: 'USSD' as const,
      language: 'SW' as const,
      severityScore: 88,
      crop: 'Potatoes / Tomatoes',
      region: 'Nakuru, Kenya',
      issue: 'Late Blight (Phytophthora infestans)',
      aiSummary: 'Water-soaked leaf lesions spreading rapidly after heavy rain. High spore germination risk.',
      timestamp: '2m ago',
      isClaimed: false,
      journeySteps: [
        { label: 'USSD Dialed', dwellTime: '2m ago' },
        { label: 'Diagnosis Menu', dwellTime: '1m ago' },
        { label: 'Leaf Blight Query', dwellTime: 'Now', status: 'active' as const },
      ],
    },
    {
      id: 'act-2',
      farmerName: 'Grace Wambui',
      phone: '+254 722 334455',
      channel: 'SMS' as const,
      language: 'EN' as const,
      severityScore: 74,
      crop: 'Maize',
      region: 'Eldoret, Kenya',
      issue: 'Fall Armyworm Infestation',
      aiSummary: 'Windowpaning on whorl leaves. Larvae detected in upper canopy. Recommends Emamectin benzoate.',
      timestamp: '7m ago',
      isClaimed: false,
      journeySteps: [
        { label: 'SMS Received', dwellTime: '7m ago' },
        { label: 'Pest AI Parser', dwellTime: '6m ago' },
        { label: 'Triage Queue', dwellTime: 'Now', status: 'active' as const },
      ],
    },
    {
      id: 'act-3',
      farmerName: 'Jean-Luc Habimana',
      phone: '+250 788 123456',
      channel: 'App' as const,
      language: 'FR' as const,
      severityScore: 42,
      crop: 'Coffee / Bananas',
      region: 'Musanze, Rwanda',
      issue: 'Coffee Leaf Rust (Early Stage)',
      aiSummary: 'Isolated orange pustules under lower leaves. Recommended cultural pruning and copper fungicide.',
      timestamp: '15m ago',
      isClaimed: false,
      journeySteps: [
        { label: 'Mobile App Opened', dwellTime: '15m ago' },
        { label: 'Leaf Photo Upload', dwellTime: '12m ago' },
        { label: 'Advice Viewed', dwellTime: 'Now', status: 'active' as const },
      ],
    },
    {
      id: 'act-4',
      farmerName: 'Amina Mohamed',
      phone: '+254 733 778899',
      channel: 'USSD' as const,
      language: 'SW' as const,
      severityScore: 18,
      crop: 'Beans',
      region: 'Kisumu, Kenya',
      issue: 'Soil Fertilizer Routine Query',
      aiSummary: 'Inquired about top-dressing timing with CAN fertilizer 4 weeks post-germination.',
      timestamp: '28m ago',
      isClaimed: true,
      claimedBy: 'Officer Mwangi',
      journeySteps: [
        { label: 'USSD Dialed', dwellTime: '28m ago' },
        { label: 'Fertilizer Menu', dwellTime: '25m ago' },
        { label: 'Officer Intervened', dwellTime: 'Now', status: 'active' as const },
      ],
    },
  ] as ActivityItem[],
}));

// Mock apiClient so LiveActivityStream fetches sample data
vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: { success: true, data: MOCK_ACTIVITIES },
    }),
    post: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
}));

const renderWithLanguage = async (ui: React.ReactElement) => {
  const result = render(<LanguageProvider>{ui}</LanguageProvider>);
  // LanguageProvider loads translations asynchronously in useEffect; flush the
  // pending microtasks inside act so the state updates don't leak outside it.
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  return result;
};

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

  const mockComponent = React.forwardRef<HTMLDivElement, MotionMockProps>(
    ({ children, ...props }, ref) => {
      const domProps = Object.fromEntries(
        Object.entries(props).filter(([key]) => !motionOnlyProps.has(key))
      );
      return (
        <div ref={ref} {...domProps}>
          {children as ReactNode}
        </div>
      );
    }
  );

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

    it('opens the file picker from the Leaf Scan tab without fabricating a result', async () => {
      await renderWithLanguage(<FloatingAIPill />);

      // Open drawer
      fireEvent.click(screen.getByRole('button', { name: /AI Agronomist/i }));

      // Switch to leaf scan
      fireEvent.click(screen.getByRole('button', { name: /Leaf Scan/i }));
      expect(screen.getByText('Upload or Capture Leaf Photo')).toBeInTheDocument();

      // Trigger scan — no diagnosis may appear without a real analysis response
      const scanBtn = screen.getByRole('button', { name: /Select Leaf Sample/i });
      fireEvent.click(scanBtn);

      await waitFor(() => {
        expect(screen.queryByText(/Late Blight/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/% Match/i)).not.toBeInTheDocument();
      });
      expect(screen.getByText('Upload or Capture Leaf Photo')).toBeInTheDocument();
    });

    it('switches to Voice tab and never fabricates a transcription', async () => {
      await renderWithLanguage(<FloatingAIPill />);

      fireEvent.click(screen.getByRole('button', { name: /AI Agronomist/i }));
      fireEvent.click(screen.getByRole('button', { name: /Voice/i }));

      expect(screen.getByText(/Tap to Record Agronomic Note/i)).toBeInTheDocument();
      const recordPrompt = screen.getByText(/Tap to Record Agronomic Note/i);
      const recordBtn = recordPrompt.parentElement?.querySelector('button');
      if (recordBtn) fireEvent.click(recordBtn);

      // jsdom has no SpeechRecognition/getUserMedia, so no transcript may be invented
      await waitFor(() => {
        expect(screen.queryByText(/AI Voice Transcription/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Farmer Otieno reports/i)).not.toBeInTheDocument();
      });
      expect(screen.getByText(/Tap to Record Agronomic Note/i)).toBeInTheDocument();
    });
  });

  describe('LiveActivityStream Component', () => {
    it('renders activity cards with severity scores and channel badges', async () => {
      await renderWithLanguage(<LiveActivityStream />);

      // Wait for the async fetch to resolve
      await waitFor(() => {
        expect(screen.getByText('Ezekiel Kiprono')).toBeInTheDocument();
      });

      expect(screen.getByText('Live Intelligence Stream')).toBeInTheDocument();
      expect(screen.getByText('88/100')).toBeInTheDocument();
      expect(screen.getByText('Grace Wambui')).toBeInTheDocument();
      expect(screen.getByText('74/100')).toBeInTheDocument();
    });

    it('allows extension officer to claim and intervene on an activity', async () => {
      await renderWithLanguage(<LiveActivityStream />);

      await waitFor(() => {
        expect(screen.getByText('Ezekiel Kiprono')).toBeInTheDocument();
      });

      const claimBtns = screen.getAllByRole('button', { name: /Claim & Intervene/i });
      fireEvent.click(claimBtns[0]);

      expect(screen.getAllByText('You').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByRole('button', { name: /Direct SMS Reply/i }).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Release to AI Autopilot').length).toBeGreaterThanOrEqual(1);
    });

    it('filters cards by critical severity', async () => {
      await renderWithLanguage(<LiveActivityStream />);

      await waitFor(() => {
        expect(screen.getByText('Ezekiel Kiprono')).toBeInTheDocument();
      });

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