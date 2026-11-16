import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FarmerChatMessage } from '@/components/chat/FarmerChatMessage';

vi.mock('@/components/audio/AudioReaderButton', () => ({ AudioReaderButton: () => null }));

describe('FarmerChatMessage — farmer, AI and officer messages are distinguishable', () => {
  it.each([
    ['user', 'Farmer', 'farmer', 'flex justify-start'],
    ['assistant', 'AI advisory', 'assistant', 'flex justify-start'],
    ['officer', 'Officer', 'officer', 'flex justify-end'],
  ] as const)('%s → labelled "%s"', (role, label, sender, alignClass) => {
    const { container } = render(<FarmerChatMessage message={{ role, content: 'Maize leaves are yellowing.' }} />);
    expect(screen.getByRole('group', { name: `${label} message` })).toBeTruthy();
    expect(screen.getByText(label)).toBeTruthy();
    const row = container.querySelector(`[data-sender="${sender}"]`) as HTMLElement;
    expect(row.className).toBe(alignClass);
  });

  it('gives AI replies a different surface from farmer messages', () => {
    const farmer = render(<FarmerChatMessage message={{ role: 'user', content: 'a' }} />);
    const farmerBubble = farmer.getByRole('group').className;
    farmer.unmount();
    const ai = render(<FarmerChatMessage message={{ role: 'assistant', content: 'b' }} />);
    expect(ai.getByRole('group').className).not.toBe(farmerBubble);
  });

  it('no longer uses all-caps tracked labels', () => {
    render(<FarmerChatMessage message={{ role: 'assistant', content: 'b' }} />);
    expect(screen.queryByText(/AI ADVISORY|FARMER INCOMING|OFFICER DISPATCH/)).toBeNull();
  });
});
