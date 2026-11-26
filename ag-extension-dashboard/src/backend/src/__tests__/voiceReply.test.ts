jest.mock('@/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('@/services/voiceAudioService', () => ({
    synthesizeVoiceAdvisory: jest.fn().mockResolvedValue({ audioBase64: 'AAAA', format: 'audio/mp3', durationSeconds: 2 }),
}));

import { synthesizeVoiceAdvisory } from '@/services/voiceAudioService';
import { synthesizeVoiceReply } from '@/services/chat/voiceReply';

describe('spoken replies', () => {
    beforeEach(() => jest.clearAllMocks());

    it('speaks the reply in the farmer\'s own language, not only Swahili or English', async () => {
        await expect(synthesizeVoiceReply('Ka duba shuka ashirin', 'ha')).resolves.toBe('data:audio/mp3;base64,AAAA');
        expect(synthesizeVoiceAdvisory).toHaveBeenCalledWith({ text: 'Ka duba shuka ashirin', language: 'ha' });
    });

    it('sends text only when speech is unavailable', async () => {
        (synthesizeVoiceAdvisory as jest.Mock).mockRejectedValueOnce(new Error('no provider'));
        await expect(synthesizeVoiceReply('Scout twenty plants', null)).resolves.toBeUndefined();
    });
});
