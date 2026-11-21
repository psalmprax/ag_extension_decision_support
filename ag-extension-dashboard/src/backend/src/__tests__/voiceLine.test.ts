jest.mock('@/services/databaseService', () => ({ query: jest.fn().mockResolvedValue({ rows: [{ event_id: 'call-1' }] }) }));
jest.mock('@/services/onboardingEngine', () => ({ onboardingEngine: { findFarmerByIdentifier: jest.fn() } }));
jest.mock('@/services/voiceAudioService', () => ({
    transcribeVoiceNote: jest.fn().mockResolvedValue({ transcription: 'Mahindi yangu yana viwavi', detectedLanguage: 'sw' }),
}));
jest.mock('@/services/chat/channelInbound', () => ({ handleRegisteredFarmerChannelMessage: jest.fn().mockResolvedValue(undefined) }));
jest.mock('axios', () => ({ get: jest.fn().mockResolvedValue({ data: Buffer.from('ID3-audio'), headers: { 'content-type': 'audio/mpeg' } }) }));

import express from 'express';
import request from 'supertest';
import router from '@/routes/voiceLine';
import { onboardingEngine } from '@/services/onboardingEngine';
import { handleRegisteredFarmerChannelMessage } from '@/services/chat/channelInbound';
import { isProviderRecordingUrl, takeRecording } from '@/services/voice/voiceLine';

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(router);
const findFarmer = onboardingEngine.findFarmerByIdentifier as jest.Mock;

describe('voice question line', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Another suite in the same worker may have left a gateway key set.
        delete process.env.AFRICASTALKING_API_KEY;
        process.env.AFRICASTALKING_WEBHOOK_SECRET = 'abc123';
        process.env.VOICE_LINE_ENABLED = 'true';
        delete process.env.VOICE_LINE_GREETING_SW;
    });

    it('is off unless switched on, and refuses callers without the shared secret', async () => {
        delete process.env.VOICE_LINE_ENABLED;
        expect((await request(app).post('/callback?key=abc123').type('form').send({ isActive: '1' })).status).toBe(503);
        process.env.VOICE_LINE_ENABLED = 'true';
        expect((await request(app).post('/callback?key=wrong').type('form').send({ isActive: '1' })).status).toBe(403);
    });

    it('asks a registered farmer to record a question, with a recorded greeting in their language when set', async () => {
        findFarmer.mockResolvedValue({ id: 'f1', language_preference: 'sw' });
        process.env.VOICE_LINE_GREETING_SW = 'https://cdn.example.org/greeting-sw.mp3';
        const response = await request(app).post('/callback?key=abc123').type('form')
            .send({ isActive: '1', sessionId: 'call-1', callerNumber: '+254712000111' });
        expect(response.text).toContain('<Record finishOnKey="#" maxLength="120"');
        expect(response.text).toContain('<Play url="https://cdn.example.org/greeting-sw.mp3"/>');
    });

    it('tells an unknown caller how to register', async () => {
        findFarmer.mockResolvedValue(null);
        const response = await request(app).post('/callback?key=abc123').type('form').send({ isActive: '1', callerNumber: '+254700000000' });
        expect(response.text).toContain('not registered');
        expect(response.text).toContain('<Reject/>');
    });

    it('files the recording and its transcript in the farmer’s thread, to be answered by SMS', async () => {
        findFarmer.mockResolvedValue({ id: 'f1', language_preference: 'sw' });
        await expect(takeRecording({
            sessionId: 'call-1', callerNumber: '+254712000111', recordingUrl: 'https://voice.africastalking.com/rec/call-1.mp3',
        })).resolves.toBe('filed');
        expect(handleRegisteredFarmerChannelMessage).toHaveBeenCalledWith(expect.objectContaining({
            farmerId: 'f1', channel: 'sms', text: 'Mahindi yangu yana viwavi', language: 'sw',
            media: [expect.objectContaining({ mimeType: 'audio/mpeg' })],
        }));
    });

    it('fetches recordings only from the provider', () => {
        expect(isProviderRecordingUrl('https://voice.africastalking.com/rec/1.mp3')).toBe(true);
        expect(isProviderRecordingUrl('http://voice.africastalking.com/rec/1.mp3')).toBe(false);
        expect(isProviderRecordingUrl('https://169.254.169.254/latest')).toBe(false);
        expect(isProviderRecordingUrl('https://africastalking.com.evil.example/x')).toBe(false);
    });
});
