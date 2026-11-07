/**
 * Voice transcription/synthesis — wired via POST /api/pillars/voice/* and /api/chatbot/speech.
 * Uses local whisper.cpp when configured, then OpenAI's transcription API.
 */
import { logger } from '../utils/logger';
import { whisperTranscriptionService } from './whisperTranscriptionService';

export interface VoiceTranscriptionResult {
  transcription: string;
  detectedLanguage: string;
  confidence?: number;
  durationSeconds?: number;
  agronomicKeywords: string[];
}

export interface VoiceSynthesisResult {
  audioBase64?: string;
  audioUrl?: string;
  format: 'audio/ogg' | 'audio/mp3';
  durationSeconds: number;
}

export function isVoiceHintSupported(hint: string): boolean {
  return hint === 'auto' || /^[a-z]{2}$/i.test(hint);
}

const COMMON_SWAHILI_AGRO_TERMS: Record<string, string> = {
  mahindi: 'Maize',
  muhogo: 'Cassava',
  kahawa: 'Coffee',
  nyanya: 'Tomato',
  ndizi: 'Banana',
  mbolea: 'Fertilizer',
  wadudu: 'Pests / Insects',
  mdudu: 'Insect / Pest',
  kiwavi: 'Fall Armyworm / Caterpillar',
  viwavi: 'Fall Armyworm / Caterpillars',
  ukungu: 'Blight / Fungus',
  magonjwa: 'Crop Disease',
  ugonjwa: 'Disease',
  mvua: 'Rain / Precipitation',
  ukame: 'Drought',
  udongo: 'Soil',
  shamba: 'Farm / Field',
  mashamba: 'Farms / Fields',
};

export function detectVernacularKeywords(text: string): { keywords: string[]; detectedLanguage: 'sw' | 'en' } {
  const lower = text.toLowerCase();
  const keywords: string[] = [];
  let swahiliMatches = 0;

  for (const [swahiliTerm, translation] of Object.entries(COMMON_SWAHILI_AGRO_TERMS)) {
    if (lower.includes(swahiliTerm)) {
      keywords.push(`${swahiliTerm} (${translation})`);
      swahiliMatches++;
    }
  }

  // English agro-terms
  const englishTerms = ['maize', 'cassava', 'fertilizer', 'armyworm', 'blight', 'wilt', 'soil', 'irrigation', 'yield', 'pest'];
  for (const term of englishTerms) {
    if (lower.includes(term) && !keywords.some(k => k.toLowerCase().includes(term))) {
      keywords.push(term);
    }
  }

  return {
    keywords,
    detectedLanguage: swahiliMatches > 0 ? 'sw' : 'en',
  };
}

const toWhisperLanguage = (hint: string): string => {
  const language = hint.trim().toLowerCase().split(/[-_]/)[0];
  return isVoiceHintSupported(language) ? language : 'auto';
};

/** Strategy 1: local whisper.cpp model (free, offline-capable). Throws if unavailable so the caller can fall back. */
async function transcribeWithLocalWhisper(audioBuffer: Buffer | undefined, languageHint: string): Promise<VoiceTranscriptionResult> {
  if (!audioBuffer || audioBuffer.length === 0) {
    throw new Error('No audio buffer provided');
  }

  const result = await whisperTranscriptionService.transcribe(audioBuffer, {
    language: toWhisperLanguage(languageHint),
    vadFilter: true,
  });
  if (!result.text?.trim()) throw new Error('Local speech provider returned an empty transcript');

  const { keywords } = detectVernacularKeywords(result.text);
  logger.info(`Local Whisper transcription succeeded (${result.text.length} chars, lang=${result.language})`);

  return {
    transcription: result.text,
    detectedLanguage: result.language || 'unknown',
    durationSeconds: result.duration,
    agronomicKeywords: keywords,
  };
}

function resolveAudioFileExtension(mimeType?: string): string {
  if (!mimeType) return 'ogg';
  const lower = mimeType.toLowerCase();
  if (lower.includes('webm')) return 'webm';
  if (lower.includes('mp4') || lower.includes('m4a')) return 'm4a';
  if (lower.includes('mp3')) return 'mp3';
  if (lower.includes('wav')) return 'wav';
  return 'ogg';
}

export function getAudioMimeType(audioData: string): string | undefined {
  return audioData.match(/^data:([^;,]+(?:;[^,]+)?);base64,/i)?.[1];
}

/** Strategy 2: OpenAI Whisper API. Returns null when unconfigured, unauthenticated audio, or on failure. */
async function transcribeWithOpenAI(audioBuffer: Buffer | undefined, mimeType: string | undefined, languageHint: string): Promise<VoiceTranscriptionResult | null> {
  const whisperApiKey = process.env.OPENAI_API_KEY;
  if (!whisperApiKey || !audioBuffer) return null;

  try {
    const OpenAI = (await import('openai')).default;
    const { toFile } = await import('openai/uploads');
    const client = new OpenAI({ apiKey: whisperApiKey, timeout: 30000, maxRetries: 0 });
    const ext = resolveAudioFileExtension(mimeType);
    const file = await toFile(audioBuffer, `voice-note.${ext}`, { type: mimeType || 'audio/ogg' });
    const tr = await client.audio.transcriptions.create({
      file,
      model: process.env.WHISPER_MODEL || 'gpt-4o-transcribe',
      language: toWhisperLanguage(languageHint) === 'auto' ? undefined : toWhisperLanguage(languageHint),
    });

    const text = (tr as unknown as { text: string }).text?.trim();
    if (!text) throw new Error('Speech provider returned an empty transcript');

    const { keywords } = detectVernacularKeywords(text);
    logger.info(`OpenAI Whisper transcription succeeded (${text.length} chars)`);
    return {
      transcription: text,
      detectedLanguage: toWhisperLanguage(languageHint) === 'auto' ? 'unknown' : toWhisperLanguage(languageHint),
      agronomicKeywords: keywords,
    };
  } catch (err) {
    logger.warn('OpenAI Whisper API call failed:', err);
    return null;
  }
}

/** Test/no-audio fallback: deterministic sample so pillar tests stay green in offline CI. Clearly marked as stub. */
function stubTranscriptionForNoAudio(): VoiceTranscriptionResult {
  const sampleFallbackTranscriptions = [
    'Habari afisa, nina shida na mahindi yangu shambani. Majani yana mashimo na viwavi wa jeshi.',
    'Jambo bwana shamba, nyanya zangu zina madoa meusi kwenye majani na shina linanyauka.',
    'Hello officer, my cassava crop has yellow mosaic leaves and the stems are stunted.',
    'Nahitaji ushauri kuhusu kiasi cha mbolea ya kupandia mahindi ekari mbili.',
  ];
  const transcript = sampleFallbackTranscriptions[0];
  const { keywords, detectedLanguage } = detectVernacularKeywords(transcript);
  return {
    transcription: `[STUB - no audio provided] ${transcript}`,
    detectedLanguage,
    confidence: 0,
    durationSeconds: 12,
    agronomicKeywords: keywords,
  };
}

export async function transcribeVoiceNote(params: {
  audioBuffer?: Buffer;
  audioUrl?: string;
  mimeType?: string;
  languageHint?: string;
}): Promise<VoiceTranscriptionResult> {
  const { audioBuffer, audioUrl, mimeType, languageHint = 'sw' } = params;
  const effectiveHint = toWhisperLanguage(languageHint);
  if (effectiveHint === 'auto' && languageHint.toLowerCase() !== 'auto') {
    logger.warn(`Unsupported voice languageHint '${languageHint}' — using automatic language detection`);
  }

  logger.info(`Processing inbound voice note (${audioBuffer ? `${audioBuffer.length} bytes` : audioUrl}, langHint=${effectiveHint})`);

  // Try local Whisper first (free, offline-capable)
  try {
    return await transcribeWithLocalWhisper(audioBuffer, effectiveHint);
  } catch (err) {
    logger.warn('Local Whisper transcription failed, falling back to OpenAI:', err);
    // Fall through to OpenAI fallback
  }

  const openAiResult = await transcribeWithOpenAI(audioBuffer, mimeType, effectiveHint);
  if (openAiResult) return openAiResult;

  // Test/no-audio fallback: deterministic sample so pillar tests stay green in offline CI.
  // Clearly marked as stub — not a real STT result; never used when a real buffer is provided.
  if ((!audioBuffer || audioBuffer.length === 0) && process.env.NODE_ENV === 'test') {
    return stubTranscriptionForNoAudio();
  }

  // In production with an audio buffer but no STT key configured, fail loudly — returning a fake
  // transcript would silently corrupt agronomic advice and hide an ops misconfiguration.
  throw new Error('Voice transcription unavailable: neither local Whisper nor OpenAI Whisper API configured. Audio length=' + (audioBuffer?.length || 0));
}

export async function synthesizeVoiceAdvisory(params: {
  text: string;
  language?: 'sw' | 'en';
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
}): Promise<VoiceSynthesisResult> {
  const { text, language = 'sw', voice = 'alloy' } = params;
  if (!text.trim() || text.length > 4096) {
    throw new Error('Speech synthesis requires non-empty text of at most 4096 characters');
  }

  logger.info(`Synthesizing voice advisory (${text.length} chars, lang=${language})`);

  // Prefer OpenAI TTS when key is configured; otherwise return dummy header (keeps pillar tests stable)
  const ttsKey = process.env.OPENAI_API_KEY;
  if (ttsKey && text) {
    try {
      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({ apiKey: ttsKey, timeout: 15000, maxRetries: 0 });
      const mp3 = await client.audio.speech.create({
        model: process.env.TTS_MODEL || 'tts-1-hd',
        voice,
        input: text,
      });
      const buffer = Buffer.from(await mp3.arrayBuffer());
      return {
        audioBase64: buffer.toString('base64'),
        format: 'audio/mp3',
        durationSeconds: Math.ceil(text.split(' ').length / 2.5),
      };
    } catch (err) {
      logger.warn('OpenAI TTS failed:', err);
    }
  }

  if (process.env.NODE_ENV === 'test') {
    const dummyAudioHeader = Buffer.from('OggS\x00\x02\x00\x00\x00\x00\x00\x00\x00\x00', 'utf-8');
    return {
      audioBase64: dummyAudioHeader.toString('base64'),
      format: 'audio/ogg',
      durationSeconds: Math.ceil(text.split(' ').length / 2.5),
    };
  }
  throw new Error('Voice synthesis unavailable: OPENAI_API_KEY / TTS_MODEL not configured and no fallback TTS provider is available.');
}
