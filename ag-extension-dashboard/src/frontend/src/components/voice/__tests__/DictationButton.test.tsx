import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { DictationLabel } from '../DictationButton';
import { useDictationAppend } from '@/hooks/useDictationAppend';

const recorder = vi.hoisted(() => ({
  options: null as null | { onTranscriptChunk: (text: string) => void; draftKey?: string; language: string },
  toggleRecording: vi.fn(),
  pendingCount: 0,
}));

vi.mock('@/hooks/useFieldVoiceRecorder', () => ({
  useFieldVoiceRecorder: (options: typeof recorder.options) => {
    recorder.options = options;
    return { isRecording: false, isTranscribing: false, recordingDuration: 0, interimText: '', pendingCount: recorder.pendingCount, toggleRecording: recorder.toggleRecording };
  },
}));

vi.mock('@/lib/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'ha',
    t: (_key: string, options?: string | ({ defaultValue?: string } & Record<string, unknown>)) => {
      const text = typeof options === 'string' ? options : options?.defaultValue ?? _key;
      return typeof options === 'object' ? text.replace(/\{(\w+)\}/g, (_m, name) => String(options[name])) : text;
    },
  }),
}));

function Findings() {
  const [value, setValue] = useState('Maize at knee height.');
  const dictate = useDictationAppend(value, setValue);
  return (
    <>
      <DictationLabel htmlFor="findings" draftKey="visit-findings:v1" onTranscript={dictate}>Findings</DictationLabel>
      <textarea id="findings" value={value} onChange={e => setValue(e.target.value)} />
    </>
  );
}

beforeEach(() => {
  recorder.options = null;
  recorder.pendingCount = 0;
  vi.clearAllMocks();
});

describe('DictationLabel', () => {
  it('describes the mic by its field and records in the app language for that field', () => {
    render(<Findings />);
    const mic = screen.getByRole('button', { name: 'Speak instead of typing' });
    expect(mic.getAttribute('aria-describedby') && document.getElementById(mic.getAttribute('aria-describedby')!)?.textContent).toBe('Findings');
    fireEvent.click(mic);

    expect(recorder.toggleRecording).toHaveBeenCalled();
    expect(recorder.options).toMatchObject({ language: 'ha', draftKey: 'visit-findings:v1' });
    // The label names only its field, never the mic.
    expect(screen.getAllByLabelText('Findings')).toEqual([screen.getByRole('textbox')]);
  });

  it('adds every phrase heard to the field, even several before a render', () => {
    render(<Findings />);
    act(() => {
      recorder.options!.onTranscriptChunk('armyworm in a third of plants');
      recorder.options!.onTranscriptChunk('soil is dry');
    });

    expect((screen.getByLabelText('Findings') as HTMLTextAreaElement).value).toBe(
      'Maize at knee height. Armyworm in a third of plants soil is dry'
    );
  });

  it('shows how many recordings are waiting for signal', () => {
    recorder.pendingCount = 2;
    render(<Findings />);
    expect(screen.getByRole('status').textContent).toContain('2 waiting for signal');
  });
});
