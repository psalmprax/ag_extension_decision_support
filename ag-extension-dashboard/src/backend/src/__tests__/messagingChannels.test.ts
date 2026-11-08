import express from 'express';
import request from 'supertest';
import smsRouter from '../routes/sms';
import whatsappRouter from '../routes/whatsapp';
import channelsRouter from '../routes/channels';
import { smsService } from '../services/smsService';
import { whatsappService } from '../services/whatsappService';
import { telegramService } from '../services/telegramService';
import { onboardingEngine } from '../services/onboardingEngine';
import { messagingKnowledgeReply } from '../services/knowledge/messagingHints';
import { query } from '../services/databaseService';
import { WeatherService } from '../services/weatherService';

jest.mock('../services/databaseService', () => ({ query: jest.fn(), getPool: jest.fn() }));
jest.mock('../services/onboardingEngine', () => ({ onboardingEngine: { processIncomingMessage: jest.fn() } }));
jest.mock('../services/smsService', () => ({ smsService: { sendSMS: jest.fn() } }));
jest.mock('../services/whatsappService', () => ({ whatsappService: { sendMessage: jest.fn() } }));
jest.mock('../services/telegramService', () => ({ telegramService: { sendMessage: jest.fn(), persistMessage: jest.fn() } }));
jest.mock('../services/knowledge/messagingHints', () => ({
    ASK_HELP: 'Send ASK followed by your question.',
    parseAskCommand: (text: string) => /^\/?ask(?:\s|$)/i.test(text) ? text.replace(/^\/?ask\s*/i, '') : null,
    messagingKnowledgeReply: jest.fn(),
}));
jest.mock('../middleware/authorize', () => ({ authorize: () => (_req: unknown, _res: unknown, next: () => void) => next() }));

const app = express();
app.use(express.json());
app.use('/sms', smsRouter);
app.use('/whatsapp', whatsappRouter);
app.use('/channels', channelsRouter);

describe('channel knowledge requests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.ALLOW_UNSIGNED_WEBHOOKS_FOR_LOCAL_DEV = 'true';
        process.env.TELEGRAM_WEBHOOK_SECRET = 'test-secret';
        delete process.env.META_APP_SECRET;
        delete process.env.TWILIO_AUTH_TOKEN;
        (query as jest.Mock).mockResolvedValue({ rows: [] });
        (messagingKnowledgeReply as jest.Mock).mockResolvedValue('Public hint');
        (smsService.sendSMS as jest.Mock).mockResolvedValue(true);
        (whatsappService.sendMessage as jest.Mock).mockResolvedValue({ success: true });
        (telegramService.sendMessage as jest.Mock).mockResolvedValue({ success: true });
        (telegramService.persistMessage as jest.Mock).mockResolvedValue({});
        (onboardingEngine.processIncomingMessage as jest.Mock).mockResolvedValue({ isHandled: false, isRegistered: true });
    });
    afterEach(() => {
        delete process.env.ALLOW_UNSIGNED_WEBHOOKS_FOR_LOCAL_DEV;
        delete process.env.TELEGRAM_WEBHOOK_SECRET;
    });

    it('serves SMS ASK without consuming an onboarding step', async () => {
        const res = await request(app).post('/sms/inbound').send({ from: '+12345678901', text: 'ASK maize leaves' });
        expect(res.status).toBe(200);
        expect(messagingKnowledgeReply).toHaveBeenCalledWith('maize leaves');
        expect(smsService.sendSMS).toHaveBeenCalledWith(expect.objectContaining({ message: 'Public hint' }));
        expect(onboardingEngine.processIncomingMessage).not.toHaveBeenCalled();
    });

    it('serves WhatsApp ASK through Twilio-shaped payloads', async () => {
        const res = await request(app).post('/whatsapp/inbound').send({ From: 'whatsapp:+12345678901', Body: 'ASK maize leaves' });
        expect(res.status).toBe(202);
        expect(whatsappService.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ message: 'Public hint' }));
        expect(onboardingEngine.processIncomingMessage).not.toHaveBeenCalled();
    });

    it('requires the Telegram secret and serves /ask before weather routing', async () => {
        const payload = { message: { chat: { id: 123 }, text: '/ask weather maize' } };
        expect((await request(app).post('/channels/telegram/webhook').send(payload)).status).toBe(403);
        const res = await request(app).post('/channels/telegram/webhook')
            .set('x-telegram-bot-api-secret-token', 'test-secret').send(payload);
        expect(res.status).toBe(200);
        expect(messagingKnowledgeReply).toHaveBeenCalledWith('weather maize');
        expect(telegramService.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ text: 'Public hint' }));
    });

    it('keeps Telegram weather available for registered users', async () => {
        const weather = jest.spyOn(WeatherService, 'getByLocation').mockResolvedValueOnce({
            condition: 'Clear', temperature: 25, temp: 25, humidity: 50, windSpeed: 5, forecast: [],
        });
        const res = await request(app).post('/channels/telegram/webhook')
            .set('x-telegram-bot-api-secret-token', 'test-secret')
            .send({ message: { chat: { id: 123 }, text: '/weather' } });
        expect(res.status).toBe(200);
        expect(weather).toHaveBeenCalled();
        expect(messagingKnowledgeReply).not.toHaveBeenCalled();
        weather.mockRestore();
    });

    it('preserves onboarding for ordinary messages', async () => {
        (onboardingEngine.processIncomingMessage as jest.Mock).mockResolvedValue({ isHandled: true, responseMessage: 'Welcome' });
        await request(app).post('/sms/inbound').send({ from: '+12345678901', text: 'START', messageId: 'sms-event-1' });
        expect(smsService.sendSMS).toHaveBeenCalledWith(expect.objectContaining({ message: 'Welcome' }));
        expect(onboardingEngine.processIncomingMessage).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'sms-event-1' }));
        expect(messagingKnowledgeReply).not.toHaveBeenCalled();
    });

    it('passes provider event IDs to onboarding across messaging channels', async () => {
        (onboardingEngine.processIncomingMessage as jest.Mock).mockResolvedValue({ isHandled: true, responseMessage: 'Welcome' });

        await request(app).post('/whatsapp/inbound').send({
            from: '+12345678901', body: 'START', messageId: 'whatsapp-event-1',
        });
        expect(onboardingEngine.processIncomingMessage).toHaveBeenLastCalledWith(expect.objectContaining({
            channel: 'whatsapp', eventId: 'whatsapp-event-1',
        }));

        await request(app).post('/channels/telegram/webhook')
            .set('x-telegram-bot-api-secret-token', 'test-secret')
            .send({ update_id: 42, message: { chat: { id: 123 }, text: 'START' } });
        expect(onboardingEngine.processIncomingMessage).toHaveBeenLastCalledWith(expect.objectContaining({
            channel: 'telegram', eventId: '42',
        }));
    });

    it('reports outbound delivery failures rather than success', async () => {
        (smsService.sendSMS as jest.Mock).mockResolvedValue(false);
        (whatsappService.sendMessage as jest.Mock).mockResolvedValue({ success: false });
        (telegramService.sendMessage as jest.Mock).mockResolvedValue({ success: false });
        expect((await request(app).post('/sms/inbound').send({ from: '+12345678901', text: 'ASK maize' })).status).toBe(503);
        expect((await request(app).post('/whatsapp/inbound').send({ from: '+12345678901', body: 'ASK maize' })).status).toBe(503);
        expect((await request(app).post('/channels/telegram/webhook').set('x-telegram-bot-api-secret-token', 'test-secret')
            .send({ message: { chat: { id: 123 }, text: 'ASK maize' } })).status).toBe(503);
    });
});
