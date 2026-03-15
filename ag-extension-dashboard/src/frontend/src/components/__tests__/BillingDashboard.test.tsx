import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BillingDashboard } from '../BillingDashboard';
import { LanguageProvider } from '../../lib/LanguageContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
        section: ({ children, ...props }: any) => <section {...props}>{children}</section>,
        article: ({ children, ...props }: any) => <article {...props}>{children}</article>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>
}));

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

        // Use region role for section with accessible name
        const statusSection = screen.getByRole('region', { name: /billing_current_plan/i });
        expect(statusSection).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /Pro/i, level: 2 })).toBeInTheDocument();
    });

    it('renders available plans', async () => {
        renderComponent();

        await waitFor(() => {
            expect(screen.queryByRole('status')).not.toBeInTheDocument();
        });

        const planArticles = screen.getAllByRole('article');
        expect(planArticles.length).toBeGreaterThan(0);
    });
});
