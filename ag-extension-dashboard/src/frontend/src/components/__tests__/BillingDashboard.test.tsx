import React, { type ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BillingDashboard } from '../BillingDashboard';
import { LanguageProvider } from '../../lib/LanguageContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

// Mock billing service to prevent real API calls
vi.mock('@/api/billingService', () => ({
  fetchPlans: vi.fn().mockResolvedValue({
    success: true,
    data: [
      {
        id: 'price_free',
        name: 'Free',
        price: 0,
        interval: 'month',
        features: ['plan_feature_basic_analytics'],
      },
      {
        id: 'price_pro_monthly',
        name: 'Pro',
        price: 29,
        interval: 'month',
        features: ['plan_feature_advanced_analytics'],
      },
    ],
  }),
  fetchSubscription: vi.fn().mockResolvedValue({
    success: true,
    data: {
      id: 'sub_1',
      status: 'active',
      currentPeriodEnd: '2026-06-30',
      cancelAtPeriodEnd: false,
      plan: { id: 'price_pro_monthly', name: 'Pro', price: 29, interval: 'month', features: [] },
    },
  }),
  fetchInvoices: vi.fn().mockResolvedValue({ success: true, data: [] }),
  fetchPaymentMethods: vi.fn().mockResolvedValue({ success: true, data: [] }),
  createCheckoutSession: vi.fn(),
  createPortalSession: vi.fn(),
  switchSubscription: vi.fn(),
  getMyTransactions: vi.fn().mockResolvedValue({ success: true, data: [] }),
  listAllTransactions: vi.fn().mockResolvedValue({ success: true, data: [] }),
  verifyTransaction: vi.fn(),
  rejectTransaction: vi.fn(),
  generateVouchers: vi.fn(),
  listVouchers: vi.fn().mockResolvedValue({ success: true, data: [] }),
  redeemVoucher: vi.fn(),
  submitTransaction: vi.fn(),
  updateAdminConfig: vi.fn(),
  createPayPalSubscription: vi.fn(),
  addPaymentMethod: vi.fn(),
  deletePaymentMethod: vi.fn(),
  fetchUsage: vi.fn().mockResolvedValue({ success: true, data: [] }),
  fetchPlanQuotas: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));

// Mock framer-motion to avoid animation issues in tests
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const renderComponent = () => {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LanguageProvider>
          <BillingDashboard />
        </LanguageProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('BillingDashboard', () => {
  it('renders loading state initially', async () => {
    renderComponent();
    expect(screen.getByRole('status')).toBeInTheDocument();

    // Wait for the loading state to disappear to satisfy React state updates
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  it('renders subscription details after loading', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    // Check for the subscription status heading
    expect(screen.getByText('Current Plan')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Pro/i, level: 2 })).toBeInTheDocument();
  });

  it('renders available plans', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    // Plans are now in a section with aria-label="Available subscription plans"
    const plansSection = screen.getByRole('region', { name: /Available subscription plans/i });
    expect(plansSection).toBeInTheDocument();

    // Check for plan headings (Free and Pro)
    expect(screen.getByRole('heading', { name: /Free/i, level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Pro/i, level: 3 })).toBeInTheDocument();
  });
});
