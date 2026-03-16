import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BillingDashboard } from '../BillingDashboard';
import { LanguageProvider } from '../../lib/LanguageContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockComponent = ({ children, ...props }: any) => <div {...props}>{children}</div>;
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        AnimatePresence: ({ children }: any) => <>{children}</>
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
    it('renders loading state initially', () => {
        renderComponent();
        expect(screen.getByRole('status')).toBeInTheDocument();
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

        // Check for plan headings (Basic and Pro)
        expect(screen.getByRole('heading', { name: /Basic/i, level: 3 })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /Pro/i, level: 3 })).toBeInTheDocument();
    });
});
