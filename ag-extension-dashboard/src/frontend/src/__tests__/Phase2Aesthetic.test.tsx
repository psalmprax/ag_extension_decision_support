import React, { ReactNode } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { JourneyBreadcrumbs, JourneyStep } from '../components/JourneyBreadcrumbs';
import { InlineVisitBookingCard } from '../components/InlineVisitBookingCard';
import { ProgressiveProfileChips, ProfileParameter } from '../components/ProgressiveProfileChips';
import { LiveActivityStream, ActivityItem } from '../components/LiveActivityStream';
import { FloatingAIPill } from '../components/FloatingAIPill';
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

// Mock framer-motion
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
    useDragControls: () => ({
      start: vi.fn(),
    }),
  };
});

describe('Phase 2 KnockKnock Aesthetic Component Suite', () => {
  describe('JourneyBreadcrumbs Component', () => {
    const mockSteps: JourneyStep[] = [
      { label: 'USSD Dialed', dwellTime: '2m' },
      { label: 'Crop Menu', dwellTime: '45s' },
      { label: 'Blight Query', dwellTime: 'Now', status: 'active' },
    ];

    it('renders all steps with dwell time and path header', () => {
      render(<JourneyBreadcrumbs steps={mockSteps} />);

      expect(screen.getByText(/Path:/i)).toBeInTheDocument();
      expect(screen.getByText('USSD Dialed')).toBeInTheDocument();
      expect(screen.getByText('(2m)')).toBeInTheDocument();
      expect(screen.getByText('Blight Query')).toBeInTheDocument();
      expect(screen.getByText('(Now)')).toBeInTheDocument();
    });

    it('returns null when steps array is empty', () => {
      const { container } = render(<JourneyBreadcrumbs steps={[]} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('InlineVisitBookingCard Component', () => {
    it('renders slot selection pills and confirms booking', () => {
      const mockBooked = vi.fn();
      render(
        <InlineVisitBookingCard
          farmerName="Ezekiel Kiprono"
          farmerPhone="+254 712 998811"
          issue="Late Blight Outbreak"
          onBooked={mockBooked}
        />
      );

      expect(screen.getByText('Priority Field Visit Recommendation')).toBeInTheDocument();
      expect(screen.getByText(/Tomorrow 09:00 AM/i)).toBeInTheDocument();
      expect(screen.getByText(/Tomorrow 02:30 PM/i)).toBeInTheDocument();

      // Click second slot and book
      fireEvent.click(screen.getByText(/Tomorrow 02:30 PM/i));
      const bookBtn = screen.getByRole('button', { name: /Book & Dispatch Itinerary/i });
      fireEvent.click(bookBtn);

      expect(mockBooked).toHaveBeenCalledWith('Tomorrow 02:30 PM');
      expect(screen.getByText('CONFIRMED')).toBeInTheDocument();
      expect(screen.getByText(/Visit Scheduled for Tomorrow 02:30 PM/i)).toBeInTheDocument();
    });
  });

  describe('ProgressiveProfileChips Component', () => {
    const mockParams: ProfileParameter[] = [
      { key: 'name', label: 'Farmer', value: 'Samuel Kiprop' },
      { key: 'crop', label: 'Crop', value: 'Potatoes' },
      { key: 'soil', label: 'Soil pH', value: null },
    ];

    it('displays completion percentage and individual parameter chips', () => {
      render(<ProgressiveProfileChips parameters={mockParams} />);

      expect(screen.getByText('Conversational Intake Profile')).toBeInTheDocument();
      expect(screen.getByText('2/3 (67%)')).toBeInTheDocument();
      expect(screen.getByText('Farmer:')).toBeInTheDocument();
      expect(screen.getByText('Samuel Kiprop')).toBeInTheDocument();
      expect(screen.getByText('Soil pH:')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });
  });

  describe('LiveActivityStream Phase 2 Enhancements', () => {
    it('opens the real WebRTC Tele-Agronomy call UI when Tele-Call button is clicked', async () => {
      await renderWithLanguage(<LiveActivityStream />);

      // Wait for async data to load
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      const teleCallBtns = screen.getAllByRole('button', { name: /Tele-Call/i });
      fireEvent.click(teleCallBtns[0]);

      expect(screen.getByText('Tele-Agronomy Video Consultation')).toBeInTheDocument();
      // Real WebRTC host start screen, not a simulation placeholder
      expect(screen.getByRole('button', { name: /Start Video Consultation/i })).toBeInTheDocument();
      expect(screen.queryByText(/DEMO.+WebRTC not connected/i)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Close tele-call/i }));

      expect(screen.queryByText('Tele-Agronomy Video Consultation')).not.toBeInTheDocument();
    });

    it('toggles Inline Visit Booking card for critical activities', async () => {
      await renderWithLanguage(<LiveActivityStream />);

      // Wait for async data to load
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      const dispatchBtns = screen.getAllByRole('button', { name: /Dispatch Visit/i });
      fireEvent.click(dispatchBtns[0]);

      expect(screen.getByText('Priority Field Visit Recommendation')).toBeInTheDocument();
    });
  });

  describe('FloatingAIPill Phase 2 Enhancements', () => {
    it('renders progressive profile chips and Tele-Call tab in drawer', async () => {
      await renderWithLanguage(<FloatingAIPill />);

      // Open drawer
      fireEvent.click(screen.getByRole('button', { name: /AI Agronomist/i }));

      // Verify progressive profile header
      expect(screen.getByText('Conversational Intake Profile')).toBeInTheDocument();

      // Switch to tele-call tab
      fireEvent.click(screen.getByRole('button', { name: /Tele-Call/i }));
      expect(screen.getByText('Instant Tele-Agronomy Call')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Start Tele-Agronomy Call/i })).toBeInTheDocument();
    });
  });
});