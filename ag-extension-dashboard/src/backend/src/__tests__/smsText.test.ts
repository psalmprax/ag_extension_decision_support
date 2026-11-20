import { isGsm7, splitForSms, toSmsText } from '@/services/sms/smsText';
import { parseSmsDate } from '@/services/sms/smsDate';
import { parseFarmSize } from '@/services/onboardingAssignment';
import { smsCopy, smsLanguage } from '@/services/sms/smsCopy';

describe('SMS text is plain GSM-7', () => {
    it('drops emoji and markdown stars, and replaces typographic punctuation', () => {
        const out = toSmsText('🌾 *Welcome* to the network! “Maize” – ready… 👉 What is your *Full Name*?');
        expect(out).toBe('Welcome to the network! "Maize" - ready... What is your Full Name?');
        expect(isGsm7(out)).toBe(true);
    });

    it('keeps letters GSM has (é, ñ) and strips accents it lacks', () => {
        expect(toSmsText('café señor naïve ō')).toBe('café señor naive o');
    });

    it('splits after two parts with the MORE prompt, cutting at a word', () => {
        const { send, rest } = splitForSms('maize '.repeat(80), 'Reply MORE for the rest.');
        expect(send.length).toBeLessThanOrEqual(306);
        expect(send.endsWith(' Reply MORE for the rest.')).toBe(true);
        expect(send.replace(' Reply MORE for the rest.', '').endsWith('maize')).toBe(true);
        expect(rest).toMatch(/^maize/);
    });

    it('sends a short reply whole', () => {
        expect(splitForSms('Scout twice a week.', 'Reply MORE.')).toEqual({ send: 'Scout twice a week.', rest: null });
    });
});

describe('fixed texts follow the farmer language', () => {
    it('uses Kiswahili for sw and English otherwise', () => {
        expect(smsLanguage('sw')).toBe('sw');
        expect(smsLanguage('ny')).toBe('en');
        expect(smsCopy('more_prompt', 'sw')).toBe('Tuma MORE kupata zaidi.');
        expect(smsCopy('more_prompt', null)).toBe('Reply MORE for the rest.');
    });
});

describe('dates in officer SMS commands', () => {
    const wednesday = new Date(Date.UTC(2026, 10, 18, 12)); // Wed 18 Nov 2026

    it.each([
        ['today soil check', '2026-11-18', 'soil check'],
        ['kesho', '2026-11-19', ''],
        ['Tue follow up', '2026-11-24', 'follow up'],
        ['wed', '2026-11-25', ''],
        ['25/11 sampling', '2026-11-25', 'sampling'],
        ['2/1', '2027-01-02', ''],
        ['2026-12-01', '2026-12-01', ''],
    ])('reads "%s"', (text, day, rest) => {
        const parsed = parseSmsDate(text, wednesday);
        expect(parsed?.date.toISOString().slice(0, 10)).toBe(day);
        expect(parsed?.rest).toBe(rest);
    });

    it.each(['31/02', 'soon', '13/13/2026', ''])('refuses "%s"', text => {
        expect(parseSmsDate(text, wednesday)).toBeNull();
    });
});

describe('farm size typed during SMS sign-up', () => {
    it.each([
        ['2.5', 2.5], ['2,5 ha', 2.5], ['3 hectares', 3], ['5 acres', 2.02], ['10 ekari', 4.05],
    ])('reads "%s"', (text, hectares) => {
        expect(parseFarmSize(text)).toBe(hectares);
    });

    it('asks again instead of guessing when there is no number', () => {
        expect(parseFarmSize('not sure')).toBeNull();
        expect(parseFarmSize('0')).toBeNull();
    });
});
