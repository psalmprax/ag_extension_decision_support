import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { VisitReportModal } from '../VisitReportModal';
import { draftVisitReport } from '@/api/aiService';
import { calendarDateFromToday } from '@/lib/calendarDate';

const DAY = 24 * 60 * 60 * 1000;

/** The recorder each field asked for, by its draft key. */
type Chunk = (text: string, meta: { recordedAt: number }) => void;
const recorders = vi.hoisted(() => new Map<string, { onTranscriptChunk: Chunk }>());

vi.mock('@/hooks/useFieldVoiceRecorder', () => ({
  useFieldVoiceRecorder: (options: { draftKey: string; onTranscriptChunk: Chunk }) => {
    recorders.set(options.draftKey, options);
    return { isRecording: false, isTranscribing: false, recordingDuration: 0, interimText: '', pendingCount: 0, toggleRecording: vi.fn() };
  },
}));
vi.mock('@/api/aiService', () => ({ draftVisitReport: vi.fn() }));
vi.mock('@/api/visitService', () => ({ createVisit: vi.fn(), updateVisit: vi.fn() }));
vi.mock('@/api/uploadService', () => ({ uploadFile: vi.fn() }));
vi.mock('@/lib/devicePosition', () => ({ currentPosition: vi.fn() }));
vi.mock('@/lib/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string, options?: string | ({ defaultValue?: string } & Record<string, unknown>)) =>
      typeof options === 'string' ? options : options?.defaultValue ?? key,
  }),
}));

const target = { visitId: 'v1', farmerId: 'f1', farmerName: 'Amina' };
const field = (id: string) => document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement;

function speakTheVisit(text: string, recordedAt = Date.now()) {
  act(() => recorders.get('visit-talk:v1')!.onTranscriptChunk(text, { recordedAt }));
}

beforeEach(() => {
  recorders.clear();
  vi.clearAllMocks();
});

describe('talk the visit', () => {
  it('fills findings, actions, time and follow-up from one recording, for the officer to check', async () => {
    vi.mocked(draftVisitReport).mockResolvedValue({
      findings: 'Maize at knee height. Armyworm in a third of plants.',
      actions: 'I showed the farmer how to scout twenty plants.',
      minutesOnFarm: 40,
      followUpRequired: true,
      followUpInDays: 7,
      organised: true,
    });
    render(<VisitReportModal target={target} onClose={vi.fn()} onSaved={vi.fn()} />);

    speakTheVisit('Maize at knee height. Armyworm in a third of plants. I showed the farmer how to scout twenty plants.');

    await waitFor(() => expect(field('visit-findings').value).toBe('Maize at knee height. Armyworm in a third of plants.'));
    expect(draftVisitReport).toHaveBeenCalledWith('Maize at knee height. Armyworm in a third of plants. I showed the farmer how to scout twenty plants.');
    expect(field('visit-actions').value).toBe('I showed the farmer how to scout twenty plants.');
    expect(field('visit-minutes').value).toBe('40');
    expect(field('visit-follow-up-date').value).toBe(calendarDateFromToday(7));
    expect(screen.getByRole('status').textContent).toContain('Check each field before you complete the visit');
  });

  it('keeps what was already typed and adds the recording after it', async () => {
    vi.mocked(draftVisitReport).mockResolvedValue({
      findings: 'Soil is dry.', actions: '', minutesOnFarm: null, followUpRequired: null, followUpInDays: null, organised: true,
    });
    render(<VisitReportModal target={target} onClose={vi.fn()} onSaved={vi.fn()} />);
    act(() => recorders.get('visit-findings:v1')!.onTranscriptChunk('leaves are yellow.', { recordedAt: Date.now() }));

    speakTheVisit('Soil is dry.');

    await waitFor(() => expect(field('visit-findings').value).toBe('Leaves are yellow. Soil is dry.'));
    expect(field('visit-minutes').value).toBe('30');
  });

  it('counts the follow-up from the day of a recording kept offline, not from the day it was sent', async () => {
    vi.mocked(draftVisitReport).mockResolvedValue({
      findings: 'Maize is wilting.', actions: '', minutesOnFarm: 5, followUpRequired: true, followUpInDays: 7, organised: true,
    });
    render(<VisitReportModal target={target} onClose={vi.fn()} onSaved={vi.fn()} />);

    speakTheVisit('Maize is wilting. I stayed five minutes. Come back in a week.', Date.now() - 3 * DAY);

    await waitFor(() => expect(field('visit-follow-up-date').value).toBe(calendarDateFromToday(4)));
    // Five minutes is kept as said; the field's own limits explain why the visit cannot be completed yet.
    expect(field('visit-minutes').value).toBe('5');
  });

  it('holds "Complete visit" until the recording is in the report', async () => {
    let finishDraft: (draft: Awaited<ReturnType<typeof draftVisitReport>>) => void = () => undefined;
    vi.mocked(draftVisitReport).mockImplementation(() => new Promise(resolve => (finishDraft = resolve)));
    render(<VisitReportModal target={target} onClose={vi.fn()} onSaved={vi.fn()} />);
    act(() => recorders.get('visit-findings:v1')!.onTranscriptChunk('Typed first.', { recordedAt: Date.now() }));

    speakTheVisit('Soil is dry.');

    const complete = screen.getByRole('button', { name: 'Complete visit' }) as HTMLButtonElement;
    await waitFor(() => expect(complete.disabled).toBe(true));
    await act(async () => finishDraft({ findings: 'Soil is dry.', actions: '', minutesOnFarm: null, followUpRequired: null, followUpInDays: null, organised: true }));
    await waitFor(() => expect(complete.disabled).toBe(false));
  });

  it('never loses the words: if the report cannot be sorted they all go under findings', async () => {
    vi.mocked(draftVisitReport).mockRejectedValue(new Error('Network Error'));
    render(<VisitReportModal target={target} onClose={vi.fn()} onSaved={vi.fn()} />);

    speakTheVisit('Maize is wilting. I advised mulching.');

    await waitFor(() => expect(field('visit-findings').value).toBe('Maize is wilting. I advised mulching.'));
    expect(field('visit-actions').value).toBe('');
    expect(screen.getByRole('status').textContent).toContain('Your recording is under findings');
  });
});
