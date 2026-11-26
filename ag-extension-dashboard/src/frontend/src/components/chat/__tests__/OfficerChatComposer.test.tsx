import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { OfficerChatComposer } from '../OfficerChatComposer';

vi.mock('../ChatPhotoButton', () => ({ ChatPhotoButton: () => null }));
vi.mock('@/hooks/useThemeClasses', () => ({ useThemeClasses: () => ({ btnClass: '' }) }));
vi.mock('@/lib/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string, options?: string | ({ defaultValue?: string } & Record<string, unknown>)) => {
      const text = typeof options === 'string' ? options : options?.defaultValue ?? key;
      return typeof options === 'object' ? text.replace(/\{(\w+)\}/g, (_m, name) => String(options[name])) : text;
    },
  }),
}));

/** The message box with "Scout twenty plants" typed; `submitted` receives how it was asked to be sent. */
function renderComposer(submitted = vi.fn()) {
  render(
    <OfficerChatComposer
      value="Scout twenty plants"
      onType={vi.fn()}
      clear={vi.fn()}
      onSubmit={(e, options) => {
        e.preventDefault();
        submitted(options);
      }}
      voiceOpen={false}
      toggleVoice={vi.fn()}
      photoTarget={null}
      onPhotoSent={vi.fn()}
    />
  );
  return submitted;
}

describe('the officer message box', () => {
  it('sends a plain text reply unless the officer asks for a voice message', () => {
    const submitted = renderComposer();

    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(submitted).toHaveBeenLastCalledWith({ speak: false });

    fireEvent.click(screen.getByRole('button', { name: 'Also send as a voice message (WhatsApp)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(submitted).toHaveBeenLastCalledWith({ speak: true });
    expect(screen.getByRole('button', { name: 'Your reply is also sent as a voice message on WhatsApp' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps the message box as the only thing named after it', () => {
    renderComposer();
    expect(screen.getByRole('button', { name: 'Speak instead of typing' }).getAttribute('title')).toBe('Speak instead of typing: Message to the farmer');
    expect(screen.getAllByLabelText('Message to the farmer')).toEqual([screen.getByRole('textbox')]);
  });
});
