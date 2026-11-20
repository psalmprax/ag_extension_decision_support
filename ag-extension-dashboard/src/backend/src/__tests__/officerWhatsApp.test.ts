jest.mock('@/services/whatsappService', () => ({ whatsappService: { sendMessage: jest.fn().mockResolvedValue({ success: true }) } }));
jest.mock('@/services/sms/officerSmsCommands', () => ({ officerCommandReply: jest.fn().mockResolvedValue('Visit to Mary Njeri recorded for today with your notes and 1 file.') }));

import { handleOfficerWhatsApp } from '@/services/chat/officerWhatsApp';
import { officerCommandReply } from '@/services/sms/officerSmsCommands';
import { whatsappService } from '@/services/whatsappService';
import type { SmsStaff } from '@/services/sms/officerSmsAccess';

const staff = { id: 'officer-1', role: 'extension_officer' } as SmsStaff;
const photo = { buffer: Buffer.from('x'), mimeType: 'image/jpeg' };

describe('officer commands on WhatsApp', () => {
    beforeEach(() => jest.clearAllMocks());

    it('files a photo sent with VISIT into the visit report', async () => {
        const content = { body: 'VISIT 12 armyworm on the east plot', isVoice: false, detectedLang: 'en', media: [photo] };
        await handleOfficerWhatsApp(staff, '+265991234567', content);
        expect(officerCommandReply).toHaveBeenCalledWith(staff, 'VISIT 12 armyworm on the east plot', { media: [photo], spokenLanguage: undefined });
        expect(whatsappService.sendMessage).toHaveBeenCalledWith({ to: '+265991234567', message: expect.stringContaining('1 file') });
    });

    it('takes a dictated visit ("Visit 12, ...") from a voice note', async () => {
        const voice = { buffer: Buffer.from('ogg'), mimeType: 'audio/ogg' };
        await handleOfficerWhatsApp(staff, '+265991234567', { body: 'Ziara 12, mahindi yamefika magoti', isVoice: true, detectedLang: 'sw', media: [voice] });
        expect(officerCommandReply).toHaveBeenCalledWith(staff, 'Ziara 12, mahindi yamefika magoti', { media: [voice], spokenLanguage: 'sw' });
    });

    it('asks for VISIT and a farmer number when a photo comes alone', async () => {
        await handleOfficerWhatsApp(staff, '+265991234567', { body: 'Sent a photo.', isVoice: false, detectedLang: 'en', media: [photo] });
        expect(officerCommandReply).not.toHaveBeenCalled();
        expect(whatsappService.sendMessage).toHaveBeenCalledWith({ to: '+265991234567', message: expect.stringMatching(/^To keep photos/) });
    });
});
