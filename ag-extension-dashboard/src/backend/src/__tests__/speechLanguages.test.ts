import { speechLanguageFor } from '@/services/speechLanguages';
import { isVoiceHintSupported } from '@/services/voiceAudioService';

describe('speech languages', () => {
  it('passes languages the transcriber knows, in any region form', () => {
    expect(speechLanguageFor('ha')).toEqual({ code: 'ha', supported: true });
    expect(speechLanguageFor('sw-KE')).toEqual({ code: 'sw', supported: true });
    expect(speechLanguageFor('YO_NG')).toEqual({ code: 'yo', supported: true });
  });

  it('lets the transcriber detect languages it was not trained on, and says so', () => {
    for (const code of ['ig', 'rw', 'zu', 'lg', 'ny', 'om']) {
      expect(speechLanguageFor(code)).toEqual({ code: 'auto', supported: false });
    }
  });

  it('treats an explicit auto as supported', () => {
    expect(speechLanguageFor('auto')).toEqual({ code: 'auto', supported: true });
  });

  it('keeps isVoiceHintSupported in step with the list', () => {
    expect(isVoiceHintSupported('sw')).toBe(true);
    expect(isVoiceHintSupported('ig')).toBe(false);
    expect(isVoiceHintSupported('xx')).toBe(false);
  });
});
