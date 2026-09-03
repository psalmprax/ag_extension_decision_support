import { promises as fsp } from 'fs';
import { logger } from '../utils/logger';

type WhisperModule = typeof import('@napi-rs/whisper');

interface WhisperSegment {
  start: number;
  end: number;
  text: string;
}

/** Shape returned by both transcribe() and transcribeFile(). */
interface WhisperTranscriptionResult {
  text: string;
  language: string;
  /** Rough transcription confidence proxy: 0.95 with real segments, 0.5 from the text-only fallback. */
  languageProbability: number;
  /** Wall-clock processing time in seconds (this binding exposes no audio-duration readout). */
  duration: number;
  segments: WhisperSegment[];
}

interface WhisperTranscribeOptions {
  language?: 'sw' | 'en' | 'auto';
  /** Closest equivalent to VAD in this binding: suppress non-speech tokens. */
  vadFilter?: boolean;
}

/**
 * Whisper Transcription Service using @napi-rs/whisper (whisper.cpp bindings)
 * Provides local, free, offline-capable speech-to-text with support for 99+ languages
 * including Swahili (sw) and English (en).
 */
class WhisperTranscriptionService {
  private static instance: WhisperTranscriptionService | null = null;
  private lib: WhisperModule | null = null;
  private model: InstanceType<WhisperModule['Whisper']> | null = null;
  private modelName: string = 'small';
  private initialized = false;

  private constructor() {}

  static getInstance(): WhisperTranscriptionService {
    if (!WhisperTranscriptionService.instance) {
      WhisperTranscriptionService.instance = new WhisperTranscriptionService();
    }
    return WhisperTranscriptionService.instance;
  }

  /**
   * Initialize the Whisper model with specified configuration
   */
  async initialize(options: {
    model?: 'tiny' | 'base' | 'small' | 'medium' | 'large-v3';
    device?: 'cpu' | 'cuda' | 'auto';
  } = {}): Promise<void> {
    if (this.initialized && this.model) {
      logger.info('Whisper model already initialized');
      return;
    }

    try {
      // Dynamic import to avoid loading heavy native dependencies at startup
      const lib = await import('@napi-rs/whisper');

      const modelName = options.model || 'small';
      const device = options.device || 'auto';

      logger.info(`Initializing Whisper model: ${modelName} on ${device}`);

      // @napi-rs/whisper uses whisper.cpp - requires model file
      const modelPath = process.env.WHISPER_MODEL_DIR
        ? `${process.env.WHISPER_MODEL_DIR}/ggml-${modelName}.bin`
        : undefined;

      if (!modelPath) {
        throw new Error('WHISPER_MODEL_DIR environment variable must be set to the directory containing Whisper model files (ggml-*.bin)');
      }

      this.lib = lib;
      this.model = new lib.Whisper(modelPath);
      this.modelName = modelName;
      this.initialized = true;

      logger.info(`Whisper model ${this.modelName} initialized successfully`);
    } catch (error) {
      logger.error('Failed to initialize Whisper model:', error);
      throw new Error(`Failed to initialize Whisper model: ${(error as Error).message}`);
    }
  }

  /**
   * Transcribe audio buffer to text
   */
  async transcribe(audioBuffer: Buffer, options: WhisperTranscribeOptions = {}): Promise<WhisperTranscriptionResult> {
    const { lib, model } = await this.requireModel();

    const startTime = Date.now();

    try {
      // decodeAudioAsync handles any container/codec (ogg, wav, mp3, ...) and
      // resamples to the 16 kHz mono Float32 samples whisper.cpp expects.
      const samples = await lib.decodeAudioAsync(new Uint8Array(audioBuffer));
      const segments: WhisperSegment[] = [];
      const params = this.buildParams(lib, options, segments);
      const text = model.full(params, samples);
      return this.buildResult(lib, model, text, segments, startTime, options.language);
    } catch (error) {
      logger.error('Whisper transcription failed:', error);
      throw new Error(`Transcription failed: ${(error as Error).message}`);
    }
  }

  /**
   * Transcribe from file path (useful for large files)
   */
  async transcribeFile(filePath: string, options: { language?: 'sw' | 'en' | 'auto' } = {}): Promise<WhisperTranscriptionResult> {
    const { lib, model } = await this.requireModel();

    const startTime = Date.now();

    try {
      const fileBuffer = await fsp.readFile(filePath);
      const samples = await lib.decodeAudioAsync(new Uint8Array(fileBuffer), filePath);
      const segments: WhisperSegment[] = [];
      const params = this.buildParams(lib, options, segments);
      const text = model.full(params, samples);
      return this.buildResult(lib, model, text, segments, startTime, options.language);
    } catch (error) {
      logger.error('Whisper file transcription failed:', error);
      throw new Error(`File transcription failed: ${(error as Error).message}`);
    }
  }

  /** Load the native module + model on demand; both are required for any transcription call. */
  private async requireModel(): Promise<{ lib: WhisperModule; model: InstanceType<WhisperModule['Whisper']> }> {
    if (!this.model) {
      await this.initialize();
    }
    if (!this.lib || !this.model) {
      throw new Error('Whisper model failed to initialize');
    }
    return { lib: this.lib, model: this.model };
  }

  private buildParams(lib: WhisperModule, options: WhisperTranscribeOptions, segments: WhisperSegment[]): InstanceType<WhisperModule['WhisperFullParams']> {
    const params = new lib.WhisperFullParams(lib.WhisperSamplingStrategy.Greedy);
    if (options.language === 'auto') {
      params.detectLanguage = true;
    } else {
      params.language = options.language || 'en';
    }
    params.temperature = 0;
    if (options.vadFilter) {
      params.suppressNonSpeechTokens = true;
    }
    params.onNewSegment = (segment) => {
      segments.push({ start: segment.start, end: segment.end, text: segment.text.trim() });
    };
    return params;
  }

  private buildResult(
    lib: WhisperModule,
    model: InstanceType<WhisperModule['Whisper']>,
    text: string,
    segments: WhisperSegment[],
    startTime: number,
    requestedLanguage: 'sw' | 'en' | 'auto' | undefined
  ): WhisperTranscriptionResult {
    let language: string;
    if (requestedLanguage === 'auto') {
      // whisper.cpp exposes the language detected during the last full() run via the state's lang id
      const langId = model.state?.fullLangId ?? -1;
      language = lib.Whisper.lang(langId) || 'en';
    } else {
      language = requestedLanguage || 'en';
    }

    return {
      text: text.trim() || segments.map((s) => s.text).join(' ').trim(),
      language,
      languageProbability: segments.length > 0 ? 0.95 : 0.5,
      duration: (Date.now() - startTime) / 1000,
      segments,
    };
  }

  /**
   * Get model info
   */
  getModelInfo() {
    return {
      modelName: this.modelName,
      initialized: this.initialized,
    };
  }

  /**
   * Check if model is ready
   */
  isReady(): boolean {
    return this.initialized && this.model !== null;
  }

  /**
   * Cleanup resources
   */
  async shutdown(): Promise<void> {
    if (this.model) {
      this.model = null;
      this.lib = null;
      this.initialized = false;
      logger.info('Whisper transcription service shut down');
    }
  }
}

export const whisperTranscriptionService = WhisperTranscriptionService.getInstance();
