/**
 * Server speech tries OpenAI, then AIHubMix; only when both are unavailable does
 * synthesis fail (the route answers 503 and the browser speaks instead).
 */
const speechCreate = jest.fn();
const transcriptionCreate = jest.fn();
const clientOptions: Array<{ apiKey: string; baseURL?: string }> = [];

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((options: { apiKey: string; baseURL?: string }) => {
    clientOptions.push(options);
    return {
      audio: {
        speech: { create: (body: unknown) => speechCreate(options.apiKey, body) },
        transcriptions: { create: (body: unknown) => transcriptionCreate(options.apiKey, body) },
      },
    };
  }),
}));
jest.mock('openai/uploads', () => ({ toFile: jest.fn().mockResolvedValue('file') }));
jest.mock('@/services/whisperTranscriptionService', () => ({
  whisperTranscriptionService: { transcribe: jest.fn().mockRejectedValue(new Error('no local model')) },
}));

import { synthesizeVoiceAdvisory, transcribeVoiceNote } from '@/services/voiceAudioService';

const mp3 = { arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer };
const KEYS = ['OPENAI_API_KEY', 'AIHUBMIX_API_KEY', 'AIHUBMIX_ACCESS_KEY', 'TTS_MODEL', 'AIHUBMIX_TTS_MODEL', 'AIHUBMIX_STT_MODEL', 'NODE_ENV'] as const;
const saved = Object.fromEntries(KEYS.map(k => [k, process.env[k]]));

describe('server speech provider order', () => {
  beforeEach(() => {
    for (const k of KEYS) delete process.env[k];
    process.env.NODE_ENV = 'production';
    clientOptions.length = 0;
    speechCreate.mockReset();
    transcriptionCreate.mockReset();
  });
  afterAll(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('uses OpenAI first when it works', async () => {
    process.env.OPENAI_API_KEY = 'openai-key';
    process.env.AIHUBMIX_API_KEY = 'hub-key';
    speechCreate.mockResolvedValue(mp3);
    const result = await synthesizeVoiceAdvisory({ text: 'Scout the maize leaves.' });
    expect(result.format).toBe('audio/mp3');
    expect(speechCreate).toHaveBeenCalledTimes(1);
    expect(speechCreate).toHaveBeenCalledWith('openai-key', expect.objectContaining({ model: 'tts-1-hd' }));
  });

  it('falls back to AIHubMix when OpenAI fails', async () => {
    process.env.OPENAI_API_KEY = 'openai-key';
    process.env.AIHUBMIX_API_KEY = 'hub-key';
    speechCreate.mockImplementation(async (key: string) => {
      if (key === 'openai-key') throw new Error('401 invalid key');
      return mp3;
    });
    const result = await synthesizeVoiceAdvisory({ text: 'Scout the maize leaves.' });
    expect(result.audioBase64).toBe(Buffer.from([1, 2, 3]).toString('base64'));
    expect(speechCreate).toHaveBeenLastCalledWith('hub-key', expect.objectContaining({ model: 'tts-1', input: 'Scout the maize leaves.' }));
    expect(clientOptions.at(-1)).toEqual(expect.objectContaining({ apiKey: 'hub-key', baseURL: 'https://aihubmix.com/v1' }));
  });

  it('uses AIHubMix alone when no OpenAI key is set, with its own model override', async () => {
    process.env.AIHUBMIX_API_KEY = 'hub-key';
    process.env.AIHUBMIX_TTS_MODEL = 'gpt-4o-mini-tts';
    speechCreate.mockResolvedValue(mp3);
    await synthesizeVoiceAdvisory({ text: 'Scout the maize leaves.' });
    expect(speechCreate).toHaveBeenCalledTimes(1);
    expect(speechCreate).toHaveBeenCalledWith('hub-key', expect.objectContaining({ model: 'gpt-4o-mini-tts' }));
  });

  it('reports speech unavailable only when both providers fail', async () => {
    process.env.OPENAI_API_KEY = 'openai-key';
    process.env.AIHUBMIX_API_KEY = 'hub-key';
    speechCreate.mockRejectedValue(new Error('503'));
    await expect(synthesizeVoiceAdvisory({ text: 'Scout the maize leaves.' })).rejects.toThrow('unavailable');
    expect(speechCreate).toHaveBeenCalledTimes(2);
  });

  it('transcribes with AIHubMix when OpenAI is not configured', async () => {
    process.env.AIHUBMIX_API_KEY = 'hub-key';
    transcriptionCreate.mockResolvedValue({ text: 'Mahindi yana viwavi.' });
    const result = await transcribeVoiceNote({ audioBuffer: Buffer.from('audio'), mimeType: 'audio/webm', languageHint: 'sw' });
    expect(result.transcription).toBe('Mahindi yana viwavi.');
    expect(transcriptionCreate).toHaveBeenCalledWith('hub-key', expect.objectContaining({ model: 'whisper-1', language: 'sw' }));
  });
});
