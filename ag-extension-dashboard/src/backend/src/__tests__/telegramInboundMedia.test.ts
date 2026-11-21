jest.mock('@/services/telegramService', () => ({ telegramService: { downloadFile: jest.fn() } }));
jest.mock('@/services/voiceAudioService', () => ({
    transcribeVoiceNote: jest.fn().mockResolvedValue({ transcription: 'Ng’ombe hawali', detectedLanguage: 'sw' }),
}));

import { readTelegramContent, hasTelegramFile } from '@/services/chat/telegramInboundMedia';
import { telegramService } from '@/services/telegramService';

const download = telegramService.downloadFile as jest.Mock;

describe('files sent to the Telegram bot', () => {
    beforeEach(() => download.mockReset());

    it('keeps the largest size of a photo with its caption', async () => {
        download.mockResolvedValue(Buffer.from('jpeg'));
        const message = { caption: 'Spots on the cassava', photo: [{ file_id: 'small' }, { file_id: 'large' }] };
        expect(hasTelegramFile(message)).toBe(true);
        const content = await readTelegramContent(message);
        expect(download).toHaveBeenCalledWith('large');
        expect(content.body).toBe('Spots on the cassava');
        expect(content.media).toEqual([{ buffer: Buffer.from('jpeg'), mimeType: 'image/jpeg' }]);
    });

    it('transcribes a voice note and keeps the recording', async () => {
        download.mockResolvedValue(Buffer.from('ogg'));
        const content = await readTelegramContent({ voice: { file_id: 'v1', mime_type: 'audio/ogg' } });
        expect(content).toMatchObject({ body: 'Ng’ombe hawali', isVoice: true, detectedLang: 'sw' });
        expect(content.media).toHaveLength(1);
    });

    it('keeps the caption when the file cannot be fetched', async () => {
        download.mockResolvedValue(null);
        const content = await readTelegramContent({ caption: 'Here', video: { file_id: 'x' } });
        expect(content.body).toBe('Here');
        expect(content.media).toHaveLength(0);
    });
});
