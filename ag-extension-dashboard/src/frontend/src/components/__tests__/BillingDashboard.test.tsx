import React, { type ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BillingDashboard } from '../BillingDashboard';
import { LanguageProvider } from '../../lib/LanguageContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { fetchSubscription, redeemVoucher } from '@/api/billingService';

// Mock billing service to prevent real API calls
// Most tests cover billing switched on; one checks the page while it is off.
let billingOn = true;
vi.mock('@ag-extension/shared/api', async importOriginal => ({
  ...(await importOriginal<object>()),
  get BILLING_ENABLED() {
    return billingOn;
  },
}));

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

// The language provider renders its children once the (mocked) locale file has loaded.
const renderComponent = async () => {
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LanguageProvider>
          <BillingDashboard />
        </LanguageProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
  await waitFor(() => expect(view.container.firstChild).not.toBeNull());
  return view;
};

describe('BillingDashboard', () => {
  it('renders loading state initially', async () => {
    // Hold the subscription request so the loading state is still up when checked.
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    const respond = vi.mocked(fetchSubscription).getMockImplementation()!;
    vi.mocked(fetchSubscription).mockImplementationOnce(async () => { await held; return respond(); });

    await renderComponent();
    expect(screen.getByRole('status')).toBeInTheDocument();
    release();

    // Wait for the loading state to disappear to satisfy React state updates
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  it('renders subscription details after loading', async () => {
    await renderComponent();

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    // Check for the subscription status heading
    expect(screen.getByText('Current plan')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Pro/i, level: 2 })).toBeInTheDocument();
  });

  it('keeps the unselected billing period readable in light mode', async () => {
    await renderComponent();
    const annual = await screen.findByRole('button', { name: 'Annual (-20%)' });
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    // White text is only for the selected (solid green) option; on the light
    // header an unselected option needs a dark text colour.
    expect(annual.className).toMatch(/(^|\s)text-slate-600(\s|$)/);
    expect(annual.className).not.toMatch(/(^|\s)text-white(\/\d+)?(\s|$)/);
  });

  it('renders available plans', async () => {
    await renderComponent();

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    // Plans are now in a section with aria-label="Available subscription plans"
    const plansSection = screen.getByRole('region', { name: /Available subscription plans/i });
    expect(plansSection).toBeInTheDocument();

    // Check for plan headings (Free and Pro)
    expect(screen.getByRole('heading', { name: /Free/i, level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Pro/i, level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select plan' }).className).toContain(
      'text-slate-900 dark:text-white'
    );
  });

  it('while billing is off, offers nothing to buy but keeps usage, invoices, vouchers and the customer portal', async () => {
    billingOn = false;
    try {
      await renderComponent();
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });
      expect(screen.getByText(/Payments are switched off while pricing is decided/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Plans & pricing' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Payment methods' })).not.toBeInTheDocument();
      expect(screen.queryByRole('region', { name: /Available subscription plans/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Usage' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Invoices & receipts' })).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /portal/i }).length).toBeGreaterThan(0);

      // A voucher is a prepaid grant code, not a payment: it can still be redeemed.
      vi.mocked(redeemVoucher).mockResolvedValueOnce({ success: true, message: 'Voucher redeemed' } as never);
      fireEvent.click(screen.getByRole('button', { name: 'Voucher code' }));
      expect(screen.queryByText('Payment intelligence')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Redeem' }));
      fireEvent.change(screen.getByPlaceholderText(/Enter voucher code/), { target: { value: 'agv-a1b2c3d4' } });
      fireEvent.click(screen.getByRole('button', { name: 'Activate token' }));
      await waitFor(() => expect(redeemVoucher).toHaveBeenCalledWith('AGV-A1B2C3D4'));
    } finally {
      billingOn = true;
    }
  });
});
