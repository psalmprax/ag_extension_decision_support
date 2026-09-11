import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { InfoPrompt, InfoPromptIcon, InlinePrompt } from '../InfoPrompt';
import { resolveSubscriptionState } from '../subscriptionPromptState';
import { useAppStore } from '@/store/useAppStore';

// Mock framer-motion for smooth test execution
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, id, role, onClick }: React.HTMLAttributes<HTMLDivElement>) => (
      <div className={className} id={id} role={role} onClick={onClick}>
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

describe('InfoPrompt Components', () => {
  beforeEach(() => {
    useAppStore.setState({
      user: {
        id: 'user-1',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        role: 'extension_officer',
        planName: 'Free Starter',
        isFree: true,
      },
      isDemo: false,
      subscription: null,
    });
  });

  it('renders trigger element and reveals prompt content on click', () => {
    render(
      <InfoPrompt title="Voice Calling" content="Available for extension officers only." trigger="click">
        <button>Call Farmer</button>
      </InfoPrompt>
    );

    const button = screen.getByText('Call Farmer');
    expect(button).toBeInTheDocument();
    expect(screen.queryByText('Available for extension officers only.')).not.toBeInTheDocument();

    // Click to open
    fireEvent.click(button);
    expect(screen.getByText('Voice Calling')).toBeInTheDocument();
    expect(screen.getByText('Available for extension officers only.')).toBeInTheDocument();

    // Click trigger again to close
    fireEvent.click(button);
    expect(screen.queryByText('Available for extension officers only.')).not.toBeInTheDocument();
  });

  it('renders dismiss button when showDismiss is true and calls onDismiss', () => {
    const onDismiss = vi.fn();
    render(
      <InfoPrompt
        title="Territory Note"
        content="Farmers are auto-assigned in your ward."
        trigger="click"
        showDismiss
        onDismiss={onDismiss}
      >
        <span>Hover Info</span>
      </InfoPrompt>
    );

    fireEvent.click(screen.getByText('Hover Info'));
    const gotItBtn = screen.getByText('Got it');
    expect(gotItBtn).toBeInTheDocument();

    fireEvent.click(gotItBtn);
    expect(onDismiss).toHaveBeenCalled();
    expect(screen.queryByText('Farmers are auto-assigned in your ward.')).not.toBeInTheDocument();
  });

  it('renders InfoPromptIcon as accessible button', () => {
    render(
      <div className="flex items-center">
        <span>Vital Score</span>
        <InfoPromptIcon
          title="About Vital Score"
          content="Calculated composite index based on soil and NDVI."
          ariaLabel="Vital score explanation"
        />
      </div>
    );

    const iconBtn = screen.getByLabelText('Vital score explanation');
    expect(iconBtn).toBeInTheDocument();

    fireEvent.click(iconBtn);
    expect(screen.getByText('About Vital Score')).toBeInTheDocument();
    expect(screen.getByText('Calculated composite index based on soil and NDVI.')).toBeInTheDocument();
  });

  it('renders InlinePrompt and allows dismissal', () => {
    const onDismiss = vi.fn();
    render(
      <InlinePrompt title="Agronomic Tip" variant="tip" dismissible onDismiss={onDismiss}>
        Optimal maize sowing starts 3 days post first heavy rains.
      </InlinePrompt>
    );

    expect(screen.getByText('Agronomic Tip')).toBeInTheDocument();
    expect(screen.getByText('Optimal maize sowing starts 3 days post first heavy rains.')).toBeInTheDocument();

    const dismissBtn = screen.getByLabelText('Dismiss prompt');
    fireEvent.click(dismissBtn);

    expect(onDismiss).toHaveBeenCalled();
    expect(screen.queryByText('Optimal maize sowing starts 3 days post first heavy rains.')).not.toBeInTheDocument();
  });

  describe('Subscription Awareness', () => {
    it('correctly resolves subscription state for free, pro, enterprise, and admin', () => {
      // Free user
      const freeState = resolveSubscriptionState(
        { role: 'farmer', isFree: true, planName: 'Free' },
        null,
        false
      );
      expect(freeState.tier).toBe('free');
      expect(freeState.isProOrHigher).toBe(false);

      // Pro user
      const proState = resolveSubscriptionState(
        { role: 'extension_officer', isFree: false, planName: 'Pro Extension' },
        { plan: { name: 'Pro Extension', status: 'active' } },
        false
      );
      expect(proState.tier).toBe('pro');
      expect(proState.isProOrHigher).toBe(true);

      // Admin user
      const adminState = resolveSubscriptionState({ role: 'admin' }, null, false);
      expect(adminState.tier).toBe('enterprise');
      expect(adminState.isProOrHigher).toBe(true);

      // Demo mode
      const demoState = resolveSubscriptionState(null, null, true);
      expect(demoState.tier).toBe('enterprise');
      expect(demoState.isProOrHigher).toBe(true);
    });

    it('renders upgrade button and tier badge when user does not meet requiredPlan', () => {
      const onUpgrade = vi.fn();
      render(
        <InfoPrompt
          title="Satellite Vegetation Radar"
          content="Sentinel-2 multispectral NDVI scans require high-capacity telemetry."
          requiredPlan="pro"
          trigger="click"
          onUpgrade={onUpgrade}
        >
          <button>NDVI Radar</button>
        </InfoPrompt>
      );

      fireEvent.click(screen.getByText('NDVI Radar'));
      expect(screen.getByText('PRO Tier')).toBeInTheDocument();
      expect(screen.getByText('Current:')).toBeInTheDocument();

      const upgradeBtn = screen.getByText(/Upgrade to PRO/i);
      expect(upgradeBtn).toBeInTheDocument();

      fireEvent.click(upgradeBtn);
      expect(onUpgrade).toHaveBeenCalled();
    });

    it('renders positive plan confirmation when user meets requiredPlan', () => {
      useAppStore.setState({
        user: {
          id: 'user-pro',
          firstName: 'Pro',
          lastName: 'Officer',
          email: 'pro@example.com',
          role: 'extension_officer',
          planName: 'Pro Tier',
          isFree: false,
        },
        subscription: {
          plan: { name: 'Pro Tier', status: 'active' },
          periodEnd: '2026-12-31',
          usage: [],
        },
      });

      render(
        <InfoPrompt
          title="Satellite Vegetation Radar"
          content="Sentinel-2 multispectral NDVI scans active."
          requiredPlan="pro"
          trigger="click"
        >
          <button>NDVI Radar Active</button>
        </InfoPrompt>
      );

      fireEvent.click(screen.getByText('NDVI Radar Active'));
      expect(screen.getByText('Pro Tier')).toBeInTheDocument();
      expect(screen.queryByText(/Upgrade to PRO/i)).not.toBeInTheDocument();
    });

    it('renders upgrade button on InlinePrompt when requiredPlan is not met', () => {
      const onUpgrade = vi.fn();
      render(
        <InlinePrompt
          title="Advanced Outbreak Heatmap"
          requiredPlan="pro"
          onUpgrade={onUpgrade}
        >
          Predictive disease diffusion models are unlocked on Pro plans.
        </InlinePrompt>
      );

      expect(screen.getByText('PRO Tier')).toBeInTheDocument();
      const upgradeBtn = screen.getByText(/Upgrade to PRO to unlock/i);
      expect(upgradeBtn).toBeInTheDocument();

      fireEvent.click(upgradeBtn);
      expect(onUpgrade).toHaveBeenCalled();
    });

    it('renders AudioReaderButton when enableAudio is true', () => {
      render(
        <InlinePrompt title="Agronomic Alert" enableAudio>
          Nyunyizia dawa asubuhi mapema kuzuia viwavi.
        </InlinePrompt>
      );

      const listenBtn = screen.getByRole('button', { name: /Listen to this information/i });
      expect(listenBtn).toBeInTheDocument();
    });
  });
});
