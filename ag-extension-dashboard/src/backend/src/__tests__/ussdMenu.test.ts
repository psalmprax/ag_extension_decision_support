jest.mock('@/services/databaseService', () => ({ query: jest.fn().mockResolvedValue({ rows: [] }) }));
jest.mock('@/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('@/services/onboardingEngine', () => ({
    onboardingEngine: { findFarmerByIdentifier: jest.fn(), processIncomingMessage: jest.fn().mockResolvedValue({}) },
}));
jest.mock('@/services/chat/channelInbound', () => ({ handleRegisteredFarmerChannelMessage: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/services/knowledge/messagingHints', () => ({ messagingKnowledgeReply: jest.fn().mockResolvedValue('hint') }));
jest.mock('@/services/smsService', () => ({ smsService: { sendSMS: jest.fn().mockResolvedValue(true), formatPhoneNumber: (p: string) => p } }));
jest.mock('@/services/sms/officerSmsAccess', () => ({ ...jest.requireActual('@/services/sms/officerSmsAccess'), findStaffByPhone: jest.fn() }));
jest.mock('@/services/sms/ussdInfo', () => ({ weatherLine: jest.fn().mockResolvedValue('Nakuru: Sunny'), marketLines: jest.fn().mockResolvedValue('Maize: KES 4,200') }));
jest.mock('@/services/sms/officerSmsCommands', () => ({ staffAiAnswer: jest.fn().mockResolvedValue('answer') }));

import { ussdScreen } from '@/services/sms/ussdMenu';
import { onboardingEngine } from '@/services/onboardingEngine';
import { handleRegisteredFarmerChannelMessage } from '@/services/chat/channelInbound';
import { findStaffByPhone } from '@/services/sms/officerSmsAccess';

const flush = () => new Promise(resolve => setImmediate(resolve));
const farmer = (language: string) => ({ id: 'farmer-1', first_name: 'Mary', language_preference: language, region: 'Rift Valley', district: 'Nakuru', country: 'Kenya' });

beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(findStaffByPhone).mockResolvedValue(null);
});

describe('USSD for a registered farmer', () => {
    beforeEach(() => jest.mocked(onboardingEngine.findFarmerByIdentifier).mockResolvedValue(farmer('en')));

    it('opens with the farmer menu', async () => {
        const screen = await ussdScreen('+254711000301', '');
        expect(screen).toMatch(/^CON Mary\n1\. Ask a question/);
    });

    it('takes a question and answers it later by SMS through Ask AI', async () => {
        expect(await ussdScreen('+254711000301', '1')).toBe('CON Type your question:');
        expect(await ussdScreen('+254711000301', '1*How do I store maize')).toMatch(/^END .*by SMS/);
        await flush();
        expect(handleRegisteredFarmerChannelMessage).toHaveBeenCalledWith(expect.objectContaining({ channel: 'sms', text: 'ASK AI How do I store maize' }));
    });

    it('walks the crop problem in three steps and says the officer will confirm', async () => {
        expect(await ussdScreen('+254711000301', '2')).toMatch(/^CON Which crop\?\n1\. Maize/);
        expect(await ussdScreen('+254711000301', '2*1')).toMatch(/^CON Which part/);
        expect(await ussdScreen('+254711000301', '2*1*1')).toMatch(/^CON What do you see\?/);
        expect(await ussdScreen('+254711000301', '2*1*1*2')).toMatch(/^END .*officer will confirm/);
        await flush();
        expect(handleRegisteredFarmerChannelMessage).toHaveBeenCalledWith(expect.objectContaining({ text: 'ASK AI Maize, leaves: spots or patches' }));
    });

    it('ends on an option that is not on the list', async () => {
        expect(await ussdScreen('+254711000301', '2*9')).toBe('END That option is not on the menu.');
    });

    it('sends a message to the officer without the AI', async () => {
        expect(await ussdScreen('+254711000301', '5*Please visit')).toMatch(/^END Sent to your officer/);
        await flush();
        expect(handleRegisteredFarmerChannelMessage).toHaveBeenCalledWith(expect.objectContaining({ text: 'Please visit' }));
    });

    it('shows weather and prices', async () => {
        expect(await ussdScreen('+254711000301', '3')).toBe('END Nakuru: Sunny');
        expect(await ussdScreen('+254711000301', '4')).toBe('END Maize: KES 4,200');
    });
});

describe('USSD in Kiswahili and for others', () => {
    it('uses Kiswahili for a farmer who chose it', async () => {
        jest.mocked(onboardingEngine.findFarmerByIdentifier).mockResolvedValue(farmer('sw'));
        expect(await ussdScreen('+254711000301', '')).toContain('1. Uliza swali');
    });

    it('offers registration by SMS to an unknown number', async () => {
        jest.mocked(onboardingEngine.findFarmerByIdentifier).mockResolvedValue(null);
        expect(await ussdScreen('+254700000000', '')).toContain('1. Register by SMS');
        expect(await ussdScreen('+254700000000', '1')).toMatch(/^END We will text you/);
    });

    it('gives staff the PIN menu, never the farmer menu', async () => {
        jest.mocked(findStaffByPhone).mockResolvedValue({
            id: 'o1', role: 'extension_officer', first_name: 'Daniel', region: null, tenant_id: null, language: null,
            sms_pin_hash: null, sms_pin_failed_attempts: 0, sms_pin_locked: false, sms_unlocked_until: null,
        });
        expect(await ussdScreen('+254711000201', '')).toContain('1. Set or change SMS PIN');
        expect(await ussdScreen('+254711000201', '1*1111')).toMatch(/^END Use 4 digits/);
        expect(await ussdScreen('+254711000201', '1*4821*4812')).toMatch(/did not match/);
    });
});
