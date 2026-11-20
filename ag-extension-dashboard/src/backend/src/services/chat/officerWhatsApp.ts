/**
 * Officers and managers can use the same commands on WhatsApp as by SMS (INBOX, R 12,
 * FIND, VISIT, PLAN, REG, ASK AI), with the same daily PIN. On WhatsApp they can also send
 * photos, a video or a dictated voice note with VISIT 12, and those join the visit report.
 */
import { logger } from '@/utils/logger';
import { whatsappService } from '@/services/whatsappService';
import { officerCommandReply } from '@/services/sms/officerSmsCommands';
import type { SmsStaff } from '@/services/sms/officerSmsAccess';
import type { InboundContent } from './whatsappInboundMedia';

const FILES_NEED_VISIT = 'To keep photos, video or a voice note, send them with VISIT and the farmer number, for example: VISIT 12 armyworm on the east plot.';

export async function handleOfficerWhatsApp(staff: SmsStaff, from: string, content: InboundContent): Promise<void> {
    let message: string;
    try {
        const command = content.body.trim().split(/\s+/)[0]?.toUpperCase().replace(/[^\p{L}]/gu, '');
        const isVisit = command === 'VISIT' || command === 'ZIARA';
        message = content.media.length && !isVisit
            ? FILES_NEED_VISIT
            : await officerCommandReply(staff, content.body, {
                media: content.media,
                spokenLanguage: content.isVoice ? content.detectedLang : undefined,
            });
    } catch (error) {
        logger.error('Officer WhatsApp command failed:', error);
        message = 'That did not work. Please try again or use the app.';
    }
    const sent = await whatsappService.sendMessage({ to: from, message });
    if (!sent.success) logger.warn(`Could not send a WhatsApp reply to officer ${staff.id}`);
}
