jest.mock('@/services/voiceAudioService', () => ({
    transcribeVoiceNote: jest.fn().mockResolvedValue({ transcription: 'Majani yana madoa', detectedLanguage: 'sw' }),
}));

import { readInboundContent } from '@/services/chat/whatsappInboundMedia';
import { mediaKind } from '@/services/chat/inboundMedia';
import { transcribeVoiceNote } from '@/services/voiceAudioService';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]).toString('base64');

describe('files sent on WhatsApp', () => {
    beforeEach(() => jest.clearAllMocks());

    it('keeps a photo and uses its caption as the message', async () => {
        const content = await readInboundContent({ audioBase64: PNG, mimeType: 'image/png' }, 'Leaves on plot 2');
        expect(content.body).toBe('Leaves on plot 2');
        expect(content.media).toHaveLength(1);
        expect(content.media[0].mimeType).toBe('image/png');
        expect(transcribeVoiceNote).not.toHaveBeenCalled();
    });

    it('says a photo was sent when there is no caption', async () => {
        const content = await readInboundContent({ audioBase64: PNG, mimeType: 'image/png' }, '');
        expect(content.body).toBe('Sent a photo.');
    });

    it('transcribes a voice note and keeps the recording', async () => {
        const content = await readInboundContent({ audioBase64: Buffer.from('OggS-voice').toString('base64'), mimeType: 'audio/ogg' }, '');
        expect(content.isVoice).toBe(true);
        expect(content.body).toBe('Majani yana madoa');
        expect(content.media).toHaveLength(1);
    });

    it('ignores file types the platform does not keep', () => {
        expect(mediaKind('image/svg+xml')).toBeNull();
        expect(mediaKind('application/zip')).toBeNull();
        expect(mediaKind('video/mp4')).toBe('video');
        expect(mediaKind('audio/ogg; codecs=opus')).toBe('audio');
    });
});
