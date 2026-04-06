import { logger } from '@/utils/logger';

export interface VoiceSession {
  id: string;
  userId: string;
  status: 'active' | 'completed' | 'error';
  language: string;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  transcription?: string;
  response?: string;
  audioUrl?: string;
}

export interface VoiceConfig {
  provider: 'elevenlabs' | 'openai' | 'deepgram' | 'webspeech';
  apiKey?: string;
  voice?: string;
  language?: string;
  model?: string;
}

class VoiceService {
  private config: VoiceConfig;
  private activeSessions: Map<string, VoiceSession> = new Map();

  constructor() {
    const provider = process.env.VOICE_PROVIDER || 'openai';
    this.config = {
      provider: provider as VoiceConfig['provider'],
      apiKey: process.env.ELEVENLABS_API_KEY || process.env.OPENAI_API_KEY,
      voice: process.env.DEFAULT_VOICE_ID || 'alloy',
      language: process.env.DEFAULT_VOICE_LANGUAGE || 'en',
      model: process.env.VOICE_MODEL || 'tts-1',
    };
    logger.info(`Voice service initialized with provider: ${this.config.provider}`);
  }

  async textToSpeech(text: string, options?: { voice?: string; language?: string; speed?: number }): Promise<{ audio: Buffer; format: string }> {
    try {
      switch (this.config.provider) {
        case 'elevenlabs':
          return this.elevenLabsTTS(text, options);
        case 'openai':
          return this.openAITTS(text, options);
        default:
          throw new Error(`Unsupported TTS provider: ${this.config.provider}`);
      }
    } catch (error) {
      logger.error('TTS failed:', error);
      throw error;
    }
  }

  async speechToText(audioBuffer: Buffer, options?: { language?: string }): Promise<{ text: string; confidence?: number; language?: string }> {
    try {
      switch (this.config.provider) {
        case 'openai':
          return this.openAISTT(audioBuffer, options);
        case 'deepgram':
          return this.deepgramSTT(audioBuffer, options);
        default:
          throw new Error(`Unsupported STT provider: ${this.config.provider}`);
      }
    } catch (error) {
      logger.error('STT failed:', error);
      throw error;
    }
  }

  async createVoiceSession(userId: string, language?: string): Promise<VoiceSession> {
    const session: VoiceSession = {
      id: `voice_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      userId,
      status: 'active',
      language: language || this.config.language || 'en',
      startedAt: new Date().toISOString(),
    };

    this.activeSessions.set(session.id, session);
    logger.info(`Voice session created: ${session.id}`);
    return session;
  }

  async endVoiceSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.status = 'completed';
      session.endedAt = new Date().toISOString();
      session.durationMs = new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime();
      logger.info(`Voice session ended: ${sessionId} (${session.durationMs}ms)`);
    }
  }

  getActiveSessions(): VoiceSession[] {
    return Array.from(this.activeSessions.values()).filter(s => s.status === 'active');
  }

  private async elevenLabsTTS(text: string, options?: { voice?: string }): Promise<{ audio: Buffer; format: string }> {
    if (!this.config.apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    const voiceId = options?.voice || this.config.voice || '21m00Tcm4TlvDq8ikWAM';

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': this.config.apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    return { audio: audioBuffer, format: 'mp3' };
  }

  private async openAITTS(text: string, options?: { voice?: string; speed?: number }): Promise<{ audio: Buffer; format: string }> {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const voice = options?.voice || this.config.voice || 'alloy';
    const speed = options?.speed || 1.0;

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model || 'tts-1',
        input: text,
        voice,
        speed,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI TTS error: ${response.status} - ${error}`);
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    return { audio: audioBuffer, format: 'mp3' };
  }

  private async openAISTT(audioBuffer: Buffer, options?: { language?: string }): Promise<{ text: string; confidence?: number; language?: string }> {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: 'audio/wav' });
    formData.append('file', blob, 'audio.wav');
    formData.append('model', 'whisper-1');
    if (options?.language) {
      formData.append('language', options.language);
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI STT error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
      text: data.text,
      language: options?.language || this.config.language,
    };
  }

  private async deepgramSTT(audioBuffer: Buffer, options?: { language?: string }): Promise<{ text: string; confidence?: number; language?: string }> {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new Error('Deepgram API key not configured');
    }

    const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'audio/wav',
      },
      body: audioBuffer,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Deepgram STT error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
      text: data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '',
      confidence: data.results?.channels?.[0]?.alternatives?.[0]?.confidence,
      language: options?.language || this.config.language,
    };
  }
}

export const voiceService = new VoiceService();
