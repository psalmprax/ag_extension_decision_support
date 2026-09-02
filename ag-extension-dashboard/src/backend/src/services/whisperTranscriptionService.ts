import { logger } from '../utils/logger';

interface WhisperTranscriptionResult {
  transcription: string;
  detectedLanguage: string;
  confidence: number;
  durationSeconds?: number;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
    probability: number;
  }>;
}

interface WhisperTranscriptionOptions {
  language?: 'sw' | 'en' | 'auto';
  model?: 'tiny' | 'base' | 'small' | 'medium' | 'large-v3';
  computeType?: 'int8' | 'int8_float16' | 'float16' | 'float32';
  device?: 'cpu' | 'cuda' | 'auto';
  beamSize?: number;
  vadFilter?: boolean;
  vadParameters?: {
    threshold?: number;
    minSpeechDurationMs?: number;
    maxSpeechDurationMs?: number;
  };
}

/**
 * Whisper Transcription Service using @napi-rs/whisper (whisper.cpp bindings)
 * Provides local, free, offline-capable speech-to-text with support for 99+ languages
 * including Swahili (sw) and English (en).
 */
class WhisperTranscriptionService {
  private static instance: WhisperTranscriptionService | null = null;
  private model: any = null;
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
      // Dynamic import to avoid loading heavy dependencies at startup
      const { Whisper } = await import('@napi-rs/whisper');

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

      this.model = new Whisper(modelPath);
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
  async transcribe(
    audioBuffer: Buffer,
    options: {
      language?: 'sw' | 'en' | 'auto';
      beamSize?: number;
      vadFilter?: boolean;
      vadParameters?: {
        threshold?: number;
        minSpeechDurationMs?: number;
        maxSpeechDurationMs?: number;
      };
      wordTimestamps?: boolean;
    } = {}
  ): Promise<{
    text: string;
    language: string;
    languageProbability: number;
    duration: number;
    segments: Array<{
      start: number;
      end: number;
      text: string;
      probability: number;
    }>;
  }> {
    if (!this.model) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      // @napi-rs/whisper accepts Float32Array or Int16Array
      // Convert buffer to Float32Array (assuming 16kHz mono PCM)
      const audioData = new Float32Array(audioBuffer.buffer);
      
      const language = options.language === 'auto' ? undefined : options.language;
      
      const result = await this.model.transcribe(audioData, {
        language,
        beamSize: options.beamSize || 5,
        bestOf: 5,
        temperature: 0,
      });

      const segments: Array<{ start: number; end: number; text: string; probability: number }> = [];
      let fullText = '';
      let detectedLanguage = 'en';
      let languageProbability = 0;

      // @napi-rs/whisper returns segments with start, end, text, avgLogProb
      if (result.segments) {
        for (const segment of result.segments) {
          const prob = segment.avgLogProb ? Math.exp(segment.avgLogProb) : 1.0;
          segments.push({
            start: segment.start,
            end: segment.end,
            text: segment.text,
            probability: prob,
          });
          fullText += segment.text + ' ';
          if (prob > languageProbability) {
            languageProbability = prob;
          }
        }
      } else if (result.text) {
        // Fallback if no segments
        fullText = result.text;
        segments.push({
          start: 0,
          end: result.duration || 0,
          text: result.text,
          probability: 0.95,
        });
      }

      // Detect language from result
      detectedLanguage = result.language || (options.language === 'auto' ? 'en' : (options.language || 'en'));

      const duration = (Date.now() - startTime) / 1000;

      return {
        text: fullText.trim(),
        language: detectedLanguage,
        languageProbability: languageProbability || 0.95,
        duration,
        segments,
      };
    } catch (error) {
      logger.error('Whisper transcription failed:', error);
      throw new Error(`Transcription failed: ${(error as Error).message}`);
    }
  }

  /**
   * Transcribe from file path (useful for large files)
   */
  async transcribeFile(filePath: string, options: {
    language?: 'sw' | 'en' | 'auto';
  } = {}): Promise<{
    text: string;
    language: string;
    duration: number;
    segments: Array<{ start: number; end: number; text: string; probability: number }>;
  }> {
    if (!this.model) {
      await this.initialize();
    }

    try {
      const language = options.language === 'auto' ? undefined : options.language;
      
      const result = await this.model.transcribe(filePath, {
        language,
        beamSize: 5,
        bestOf: 5,
        temperature: 0,
      });

      const segments: Array<{ start: number; end: number; text: string; probability: number }> = [];
      let fullText = '';
      
      if (result.segments) {
        for (const segment of result.segments) {
          const prob = segment.avgLogProb ? Math.exp(segment.avgLogProb) : 1.0;
          segments.push({
            start: segment.start,
            end: segment.end,
            text: segment.text,
            probability: prob,
          });
          fullText += segment.text + ' ';
        }
      } else if (result.text) {
        fullText = result.text;
        segments.push({
          start: 0,
          end: result.duration || 0,
          text: result.text,
          probability: 0.95,
        });
      }

      return {
        text: fullText.trim(),
        language: result.language || options.language || 'en',
        duration: result.duration || (segments[segments.length - 1]?.end || 0),
        segments,
      };
    } catch (error) {
      logger.error('Whisper file transcription failed:', error);
      throw new Error(`File transcription failed: ${(error as Error).message}`);
    }
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
      this.initialized = false;
      logger.info('Whisper transcription service shut down');
    }
  }
}

export const whisperTranscriptionService = WhisperTranscriptionService.getInstance();