import { getAudioMimeType, synthesizeVoiceAdvisory, transcribeVoiceNote } from '@/services/voiceAudioService';
import { whisperTranscriptionService } from '@/services/whisperTranscriptionService';

jest.mock('@/services/whisperTranscriptionService', () => ({
    whisperTranscriptionService: { transcribe: jest.fn() },
}));

describe('Advisory speech integrity', () => {
    const originalEnvironment = process.env.NODE_ENV;
    const originalKey = process.env.OPENAI_API_KEY;

    afterEach(() => {
        process.env.NODE_ENV = originalEnvironment;
        if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
        else process.env.OPENAI_API_KEY = originalKey;
        jest.clearAllMocks();
    });

    it('passes the recording MIME and normalized language without inventing confidence', async () => {
        jest.mocked(whisperTranscriptionService.transcribe).mockResolvedValueOnce({
            text: 'Inspect the maize leaves.', language: 'en', duration: 2, segments: [],
        });
        const buffer = Buffer.from('recording');
        const result = await transcribeVoiceNote({ audioBuffer: buffer, mimeType: 'audio/mp4', languageHint: 'en-US' });
        expect(whisperTranscriptionService.transcribe).toHaveBeenCalledWith(
            buffer, expect.objectContaining({ language: 'en' })
        );
        expect(result.confidence).toBeUndefined();
        expect(result.transcription).toBe('Inspect the maize leaves.');
        expect(getAudioMimeType('data:audio/mp4;base64,YQ==')).toBe('audio/mp4');
    });

    it('never fabricates a production transcript when audio is missing', async () => {
        process.env.NODE_ENV = 'production';
        delete process.env.OPENAI_API_KEY;
        await expect(transcribeVoiceNote({})).rejects.toThrow('Voice transcription unavailable');
    });

    it('rejects empty real transcripts instead of returning a success-shaped response', async () => {
        delete process.env.OPENAI_API_KEY;
        jest.mocked(whisperTranscriptionService.transcribe).mockResolvedValueOnce({
            text: '', language: 'en', duration: 0, segments: [],
        });
        await expect(transcribeVoiceNote({ audioBuffer: Buffer.from('recording') })).rejects.toThrow();
    });

    it('never silently truncates speech or returns fake production audio', async () => {
        await expect(synthesizeVoiceAdvisory({ text: 'x'.repeat(4097) })).rejects.toThrow('4096');
        process.env.NODE_ENV = 'production';
        delete process.env.OPENAI_API_KEY;
        await expect(synthesizeVoiceAdvisory({ text: 'Scout the maize leaves.' })).rejects.toThrow('unavailable');
    });
});
