/**
 * Server speech providers, in the order they are tried: OpenAI, then AIHubMix
 * (OpenAI-compatible audio endpoints). When every provider fails, the caller
 * reports that speech is unavailable and the browser uses its own voice.
 */
import { AIHubMixProvider } from './aiProvider/providers/aihubmix';

export interface SpeechProvider {
  name: string;
  /** Empty when the provider is not configured. */
  apiKey(): Promise<string>;
  baseURL?: string;
  ttsModel(): string;
  sttModel(): string;
}

let aihubmix: AIHubMixProvider | undefined;

export const SPEECH_PROVIDERS: readonly SpeechProvider[] = [
  {
    name: 'OpenAI',
    apiKey: async () => process.env.OPENAI_API_KEY || '',
    ttsModel: () => process.env.TTS_MODEL || 'tts-1-hd',
    sttModel: () => process.env.WHISPER_MODEL || 'gpt-4o-transcribe',
  },
  {
    name: 'AIHubMix',
    apiKey: () => (aihubmix ??= new AIHubMixProvider()).resolveApiKey(),
    baseURL: 'https://aihubmix.com/v1',
    ttsModel: () => process.env.AIHUBMIX_TTS_MODEL || 'tts-1',
    sttModel: () => process.env.AIHUBMIX_STT_MODEL || 'whisper-1',
  },
];

/** An OpenAI SDK client for one provider, or null when it has no key. */
export async function speechClient(provider: SpeechProvider, timeout: number) {
  const apiKey = await provider.apiKey();
  if (!apiKey) return null;
  const OpenAI = (await import('openai')).default;
  return new OpenAI({ apiKey, baseURL: provider.baseURL, timeout, maxRetries: 0 });
}
