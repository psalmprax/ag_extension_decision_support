import { SMS_LANGUAGES, smsCopy, smsLanguage } from '@/services/sms/smsCopy';
import { USSD_LANGUAGE_CODES, numbered } from '@/services/sms/ussdText';
import { isGsm7, toSmsText } from '@/services/sms/smsText';

describe('SMS and USSD in French and Portuguese', () => {
    it('answers in the farmer’s language, English when it has no wording', () => {
        expect(smsCopy('ack_no_ai', 'fr')).toBe('Merci, votre conseiller va répondre.');
        expect(smsCopy('ack_no_ai', 'pt-MZ')).toBe('Obrigado, o seu extensionista vai responder.');
        expect(smsCopy('ack_no_ai', 'ha')).toBe('Thanks, your officer will reply.');
        expect(smsLanguage('fr-SN')).toBe('fr');
    });

    it('offers every SMS language on the USSD language menu, in order', () => {
        expect([...USSD_LANGUAGE_CODES]).toEqual([...SMS_LANGUAGES]);
        expect(numbered('languages', 'pt')).toBe('1. English\n2. Kiswahili\n3. Français\n4. Português');
        expect(numbered('farmer', 'fr').split('\n')[0]).toBe('1. Poser une question');
    });

    it('keeps every message in the cheap GSM-7 alphabet once sent', () => {
        for (const language of SMS_LANGUAGES) {
            expect(isGsm7(toSmsText(smsCopy('login_code', language)))).toBe(true);
            expect(isGsm7(toSmsText(smsCopy('ack_chat', language)))).toBe(true);
        }
    });
});
