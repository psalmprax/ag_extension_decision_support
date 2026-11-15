import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AgronomicIntakeCard, isAgronomicQueryAmbiguous } from '../components/AgronomicIntakeCard';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

describe('AgronomicIntakeCard', () => {
  it.each([
    'What season is West Africa in for crops to be planted?',
    'What should I plant in the Sahel?',
    'Which crops suit the Gulf of Guinea rainy season?',
    'What is the planting season in Nigeria?',
  ])('does not add an unrelated profile to a geographically scoped question: %s', query => {
    expect(isAgronomicQueryAmbiguous(query)).toBe(false);
  });

  it('does not preselect a Midwest zone or append unchosen farm details', () => {
    const onApplyIntake = vi.fn();
    render(
      <AgronomicIntakeCard
        initialQuery="What crops should I plant?"
        onApplyIntake={onApplyIntake}
      />
    );

    expect(screen.getByRole('button', { name: 'Zone 5–6' }).className).not.toContain('bg-slate-900');
    fireEvent.click(screen.getByRole('button', { name: 'Generate Precision Advice' }));

    expect(onApplyIntake).toHaveBeenCalledWith(
      'What crops should I plant?',
      { zone: undefined, soil: undefined, irrigation: undefined, goal: undefined, customLocation: undefined }
    );
  });

  it('only appends the farm details the user explicitly selects', () => {
    const onApplyIntake = vi.fn();
    render(
      <AgronomicIntakeCard
        initialQuery="What crops should I plant?"
        onApplyIntake={onApplyIntake}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Rainfed / Dryland' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generate Precision Advice' }));

    expect(onApplyIntake).toHaveBeenCalledWith(
      'What crops should I plant? [Agronomic Context: Water=Rainfed / Dryland]',
      { zone: undefined, soil: undefined, irrigation: 'Rainfed / Dryland', goal: undefined, customLocation: undefined }
    );
  });
});
