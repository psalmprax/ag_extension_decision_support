import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';

let language = 'sw';
const translateContent = vi.fn();
vi.mock('@/api/knowledgeService', () => ({ translateContent: (...args: unknown[]) => translateContent(...args) }));
vi.mock('@/lib/LanguageContext', () => ({
  useLanguage: () => ({
    language,
    t: (key: string, options?: string | ({ defaultValue?: string } & Record<string, unknown>)) => {
      const text = typeof options === 'string' ? options : options?.defaultValue ?? key;
      return typeof options === 'object' ? text.replace(/\{(\w+)\}/g, (_m, name) => String(options[name])) : text;
    },
  }),
}));
vi.mock('@/hooks/useHowSure', () => ({ useHowSure: () => () => 'How sure: fairly sure' }));

import { asNumberedList, fromNumberedList, useTranslatedTexts } from '../useTranslatedTexts';
import { PossibleCause } from '@/components/diagnosis/PossibleCause';

const reply = (translatedText: string) => ({ success: true, data: { translatedText } });

describe('generated text in the app language', () => {
  beforeEach(() => {
    language = 'sw';
    translateContent.mockReset();
  });

  it('sends texts as one numbered list and takes each one back by its number', () => {
    expect(asNumberedList(['Late blight', 'Remove infected leaves.\nBurn them.'])).toBe('1. Late blight\n2. Remove infected leaves. Burn them.');
    expect(fromNumberedList('2) Ondoa majani.\n1. Ukungu', 2)).toEqual(['Ukungu', 'Ondoa majani.']);
    expect(fromNumberedList('1. Ukungu', 2)).toBeNull();
    expect(fromNumberedList('1. Ukungu\n1. Tena', 2)).toBeNull();
  });

  it('sends nothing when the app is in English', () => {
    language = 'en';
    const { result } = renderHook(() => useTranslatedTexts(['Late blight']));
    expect(translateContent).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ texts: ['Late blight'], translated: false, pending: false });
  });

  it('keeps the English when the translation fails or comes back incomplete', async () => {
    translateContent.mockRejectedValueOnce(new Error('offline'));
    const failed = renderHook(() => useTranslatedTexts(['Late blight', 'Spray copper.']));
    await waitFor(() => expect(failed.result.current.failed).toBe(true));
    expect(failed.result.current.texts).toEqual(['Late blight', 'Spray copper.']);

    translateContent.mockResolvedValueOnce(reply('1. Ukungu'));
    const partial = renderHook(() => useTranslatedTexts(['Late blight', 'Spray copper!']));
    await waitFor(() => expect(partial.result.current.failed).toBe(true));
    expect(partial.result.current.texts).toEqual(['Late blight', 'Spray copper!']);
  });

  it('shows a diagnosis in the app language, keeps the English name, and switches back to the original', async () => {
    translateContent.mockResolvedValueOnce(
      reply('1. Ukungu wa marehemu\n2. Ugonjwa hatari wa nyanya.\n3. Thibitisha na afisa wako.'),
    );
    render(
      <PossibleCause
        disease="Late blight"
        confidence={0.82}
        description="A serious disease of tomatoes."
        safetyNotice="Confirm with your officer."
        confirmedBySource={false}
      />,
    );
    expect(translateContent).toHaveBeenCalledWith(
      '1. Late blight\n2. A serious disease of tomatoes.\n3. Confirm with your officer.', 'sw', 'en',
    );
    expect(await screen.findByRole('heading', { name: 'Might be Ukungu wa marehemu (Late blight)' })).toBeInTheDocument();
    expect(screen.getByText('Ugonjwa hatari wa nyanya.')).toBeInTheDocument();
    expect(screen.getByText(/Check product names and doses against the original/)).toBeInTheDocument();

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Show original' })));
    expect(screen.getByRole('heading', { name: 'Might be Late blight' })).toBeInTheDocument();
    expect(screen.getByText('A serious disease of tomatoes.')).toBeInTheDocument();
  });
});
