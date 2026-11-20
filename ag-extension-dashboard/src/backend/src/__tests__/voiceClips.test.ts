jest.mock('@/services/databaseService', () => ({ query: jest.fn() }));
jest.mock('@/services/onboardingEngine', () => ({ onboardingEngine: { findFarmerByIdentifier: jest.fn() } }));
jest.mock('axios', () => ({ post: jest.fn(), get: jest.fn() }));

import axios from 'axios';
import { query } from '@/services/databaseService';
import { onboardingEngine } from '@/services/onboardingEngine';
import { clipUrl, isValidClipSignature, saveClip, VoiceClipError } from '@/services/voice/voiceClips';
import { callFarmers } from '@/services/voice/advisoryCalls';
import { answerCall, promptXml } from '@/services/voice/voiceLine';

const mockQuery = query as jest.Mock;
const savedEnv = { ...process.env };
afterAll(() => { process.env = savedEnv; });
beforeEach(() => {
    mockQuery.mockReset();
    jest.clearAllMocks();
    process.env.FRONTEND_URL = 'https://www.example.org';
    process.env.VOICE_LINE_ENABLED = 'true';
    process.env.VOICE_LINE_NUMBER = '+254711000000';
    process.env.AFRICASTALKING_API_KEY = 'key';
    delete process.env.VOICE_LINE_GREETING_SW;
});

describe('recordings', () => {
    it('are served to the provider only through a signed link', () => {
        const url = new URL(clipUrl('c1'));
        expect(url.pathname).toBe('/api/v1/voice-clips/c1/audio');
        expect(isValidClipSignature('c1', url.searchParams.get('sig'))).toBe(true);
        expect(isValidClipSignature('c2', url.searchParams.get('sig'))).toBe(false);
        expect(isValidClipSignature('c1', 'x'.repeat(32))).toBe(false);
    });

    it('must be mp3 or wav, which phones play', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ mime_type: 'audio/ogg', owner_user_id: 'm1' }] });
        await expect(saveClip('m1', { key: 'line_greeting', language: 'sw', title: 'Greeting', uploadId: 'u1' }))
            .rejects.toThrow(new VoiceClipError('Phones play mp3 or wav recordings. Export the recording in one of those formats.'));
    });

    it('replace the English voice for a caller in their language', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'clip-sw' }] });
        const xml = await promptXml('line_greeting', 'sw');
        expect(xml).toMatch(/^<Play url="https:\/\/www\.example\.org\/api\/v1\/voice-clips\/clip-sw\/audio\?sig=[0-9a-f]{32}"\/>$/);
        mockQuery.mockResolvedValueOnce({ rows: [] });
        expect(await promptXml('line_greeting', 'ha')).toMatch(/^<Say>Welcome to your extension service/);
    });
});

describe('voice advisories', () => {
    it('play the queued recording when the farmer answers', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'call-1', clip_id: 'clip-sw' }] }).mockResolvedValueOnce({ rows: [] });
        const xml = await answerCall({ direction: 'Outbound', destinationNumber: '+254712000111', isActive: '1' });
        expect(xml).toContain('/voice-clips/clip-sw/audio');
        expect(mockQuery.mock.calls[1][0]).toContain("status = 'played'");
        expect(onboardingEngine.findFarmerByIdentifier).not.toHaveBeenCalled();
    });

    it('call only the pilot’s service group in the recording’s language, within the daily limit', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [{ language: 'sw' }] })
            .mockResolvedValueOnce({ rows: [{ count: '0' }] })
            .mockResolvedValueOnce({ rows: [{ id: 'f1', phone: '+254712000111' }, { id: 'f2', phone: '+254712000222' }] })
            .mockResolvedValue({ rows: [] });
        (axios.post as jest.Mock).mockResolvedValue({ data: { entries: [{ status: 'Queued' }] } });
        await expect(callFarmers('m1', 'clip-sw', { pilotId: 'p1' })).resolves.toEqual({ queued: 2, skipped: 0 });
        const select = mockQuery.mock.calls[2];
        expect(select[0]).toContain("arm = 'service'");
        expect(select[0]).toContain('sms_opt_out = false');
        expect(select[1]).toEqual(['sw', 'p1', []]);
    });

    it('are refused when calling is not set up on the server', async () => {
        delete process.env.VOICE_LINE_NUMBER;
        await expect(callFarmers('m1', 'clip-sw', { pilotId: 'p1' })).rejects.toThrow(/not set up/);
        expect(mockQuery).not.toHaveBeenCalled();
    });
});
