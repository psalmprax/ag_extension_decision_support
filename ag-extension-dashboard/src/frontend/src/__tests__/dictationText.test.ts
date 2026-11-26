import { describe, expect, it } from 'vitest';
import { appendDictation } from '@/lib/dictationText';
import { browserDictationLocale } from '@/lib/voiceLanguages';

describe('appendDictation', () => {
  it('starts an empty field with a capital letter', () => {
    expect(appendDictation('', 'leaves are yellow')).toBe('Leaves are yellow');
  });

  it('continues a sentence after a space, and starts a new one after a full stop', () => {
    expect(appendDictation('Leaves are yellow', 'on the lower canopy')).toBe('Leaves are yellow on the lower canopy');
    expect(appendDictation('Leaves are yellow.  ', 'soil is dry')).toBe('Leaves are yellow. Soil is dry');
    expect(appendDictation('Ujuzi umekamilika።', 'ndio')).toBe('Ujuzi umekamilika። ndio');
  });

  it('leaves the field alone when nothing was heard', () => {
    expect(appendDictation('Leaves are yellow', '   ')).toBe('Leaves are yellow');
  });
});

describe('browserDictationLocale', () => {
  it('gives the browser locale for languages it can dictate', () => {
    expect(browserDictationLocale('sw')).toBe('sw-KE');
    expect(browserDictationLocale('zu')).toBe('zu-ZA');
    expect(browserDictationLocale('pt-BR')).toBe('pt-PT');
  });

  it('sends Hausa, Yoruba, Igbo, Kinyarwanda and Amharic to the server instead', () => {
    for (const code of ['ha', 'yo', 'ig', 'rw', 'am', 'so', 'lg', 'ny', 'om']) {
      expect(browserDictationLocale(code)).toBeNull();
    }
  });
});
