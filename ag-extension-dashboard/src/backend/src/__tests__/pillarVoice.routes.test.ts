import express from 'express';
import request from 'supertest';
import voiceRouter from '@/routes/pillars/voice';
import { whisperTranscriptionService } from '@/services/whisperTranscriptionService';
import { transcribeVoiceNote } from '@/services/voiceAudioService';

jest.mock('@/middleware/usageMiddleware', () => ({
    checkUsageLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('@/services/whisperTranscriptionService', () => ({
    whisperTranscriptionService: { transcribe: jest.fn() },
}));
jest.mock('@/services/voiceAudioService', () => ({
    transcribeVoiceNote: jest.fn(),
    synthesizeVoiceAdvisory: jest.fn(),
    detectVernacularKeywords: jest.fn(() => ({ keywords: [] })),
}));
jest.mock('@/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const app = express();
app.use(express.json());
app.use(voiceRouter);

describe('Pillar voice transcription', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns the local transcript in the shape used by the frontend', async () => {
        jest.mocked(whisperTranscriptionService.transcribe).mockResolvedValueOnce({
            text: 'Inspect the leaves.', language: 'en', duration: 1, segments: [],
        });
        const result = await request(app).post('/voice/transcribe-local')
            .send({ audio: Buffer.from('audio').toString('base64'), languageHint: 'en' }).expect(200);
        expect(result.body.data).toMatchObject({ transcription: 'Inspect the leaves.', detectedLanguage: 'en', provider: 'local-whisper' });
        expect(transcribeVoiceNote).not.toHaveBeenCalled();
    });

    it('passes decoded audio and MIME to the cloud fallback after local failure', async () => {
        jest.mocked(whisperTranscriptionService.transcribe).mockRejectedValueOnce(new Error('local unavailable'));
        jest.mocked(transcribeVoiceNote).mockResolvedValueOnce({
            transcription: 'Cloud transcript', detectedLanguage: 'en', agronomicKeywords: [],
        });
        const result = await request(app).post('/voice/transcribe-local')
            .send({ audio: Buffer.from('audio').toString('base64'), mimeType: 'audio/webm', languageHint: 'en' }).expect(200);
        expect(result.body.data).toMatchObject({ transcription: 'Cloud transcript', provider: 'openai-fallback' });
        expect(transcribeVoiceNote).toHaveBeenCalledWith({
            audioBuffer: Buffer.from('audio'), mimeType: 'audio/webm', languageHint: 'en', skipLocal: true,
        });
    });

    it('does not report an empty local transcript as success', async () => {
        jest.mocked(whisperTranscriptionService.transcribe).mockResolvedValueOnce({
            text: '   ', language: 'en', duration: 1, segments: [],
        });
        jest.mocked(transcribeVoiceNote).mockRejectedValueOnce(new Error('cloud unavailable'));
        await request(app).post('/voice/transcribe-local')
            .send({ audio: Buffer.from('audio').toString('base64') }).expect(503);
        expect(transcribeVoiceNote).toHaveBeenCalledWith(expect.objectContaining({ skipLocal: true }));
    });

    it('reports failure when both providers fail and rejects unsupported URL-only input', async () => {
        jest.mocked(whisperTranscriptionService.transcribe).mockRejectedValueOnce(new Error('local unavailable'));
        jest.mocked(transcribeVoiceNote).mockRejectedValueOnce(new Error('cloud unavailable'));
        await request(app).post('/voice/transcribe-local')
            .send({ audio: Buffer.from('audio').toString('base64') }).expect(503);
        await request(app).post('/voice/transcribe-local').send({ audioUrl: 'https://example.com/note.ogg' }).expect(400);
        await request(app).post('/voice/transcribe').send({ audioUrl: 'https://example.com/note.ogg' }).expect(400);
    });
});
