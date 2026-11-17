import {
    DEFAULT_TURN_TAKING,
    decideAutoReply,
    isUrgentMessage,
    isWithinWorkingHours,
    resolveTurnTakingSettings,
    urgentSafetyText,
    type TurnTakingSettings,
} from '../services/chat/turnTaking';

// 10:00 on Tuesday 17 Nov 2026 in Nairobi (UTC+3) = 07:00 UTC.
const tuesdayMorning = new Date('2026-11-17T07:00:00Z');
const minutesBefore = (at: Date, m: number) => new Date(at.getTime() - m * 60_000);
const settings: TurnTakingSettings = DEFAULT_TURN_TAKING;

describe('working hours', () => {
    it("uses the organisation's own time zone", () => {
        expect(isWithinWorkingHours(tuesdayMorning, settings)).toBe(true);
        // 18:00 Nairobi
        expect(isWithinWorkingHours(new Date('2026-11-17T15:00:00Z'), settings)).toBe(false);
        // Sunday 10:00 Nairobi
        expect(isWithinWorkingHours(new Date('2026-11-15T07:00:00Z'), settings)).toBe(false);
        // Same instant, but an organisation in Accra (UTC+0) is at 07:00: not yet open
        const accra = { ...settings, workingHours: { ...settings.workingHours, timezone: 'Africa/Accra' } };
        expect(isWithinWorkingHours(tuesdayMorning, accra)).toBe(false);
    });

    it('falls back to the defaults for invalid stored settings', () => {
        expect(resolveTurnTakingSettings({ chatTurnTaking: { aiFallbackMinutes: 45 } }).aiFallbackMinutes).toBe(45);
        expect(resolveTurnTakingSettings({ chatTurnTaking: { aiFallbackMinutes: -5 } })).toEqual(DEFAULT_TURN_TAKING);
        expect(resolveTurnTakingSettings({ chatTurnTaking: { workingHours: { timezone: 'Mars/Olympus' } } })).toEqual(DEFAULT_TURN_TAKING);
        expect(resolveTurnTakingSettings(null)).toEqual(DEFAULT_TURN_TAKING);
    });
});

describe('when the AI answers a farmer', () => {
    const state = (farmerMinutesAgo: number | null, officerMinutesAgo: number | null = null, answered = false) => ({
        lastFarmerMessageAt: farmerMinutesAgo === null ? null : minutesBefore(tuesdayMorning, farmerMinutesAgo),
        lastOfficerMessageAt: officerMinutesAgo === null ? null : minutesBefore(tuesdayMorning, officerMinutesAgo),
        answeredSinceFarmer: answered,
    });

    it('waits for the officer during working hours, then answers', () => {
        expect(decideAutoReply(state(10), tuesdayMorning, settings)).toMatchObject({ action: 'wait', reason: 'officer_may_reply' });
        expect(decideAutoReply(state(30), tuesdayMorning, settings)).toEqual({ action: 'answer', reason: 'officer_unavailable' });
    });

    it('answers straight away outside working hours', () => {
        const evening = new Date('2026-11-17T16:00:00Z'); // 19:00 Nairobi
        expect(decideAutoReply({ lastFarmerMessageAt: minutesBefore(evening, 1), lastOfficerMessageAt: null, answeredSinceFarmer: false }, evening, settings))
            .toEqual({ action: 'answer', reason: 'outside_hours' });
    });

    it('holds back while the officer is active, then resumes the normal wait', () => {
        // Officer replied 30 min ago, farmer wrote again 20 min ago: the officer is in the thread.
        expect(decideAutoReply(state(20, 30), tuesdayMorning, settings)).toMatchObject({ action: 'wait', reason: 'officer_active' });
        // Officer last spoke 3 h ago; the farmer has waited 40 min: answer.
        expect(decideAutoReply(state(40, 180), tuesdayMorning, settings)).toEqual({ action: 'answer', reason: 'officer_unavailable' });
    });

    it('never answers twice, nor messages older than a day', () => {
        expect(decideAutoReply(state(60, null, true), tuesdayMorning, settings)).toEqual({ action: 'none', reason: 'already_answered' });
        expect(decideAutoReply(state(25 * 60), tuesdayMorning, settings)).toEqual({ action: 'none', reason: 'too_old' });
        expect(decideAutoReply(state(null), tuesdayMorning, settings)).toEqual({ action: 'none', reason: 'nothing_to_answer' });
    });
});

describe('urgent messages', () => {
    it.each([
        'My child drank pesticide, what do I do',
        'Mtoto amekunywa sumu ya panya',
        'I splashed the chemical spray in my eyes',
        'He collapsed after spraying the field',
        'The worker cannot breathe',
        'Ameumwa na nyoka shambani',
        'I think I was poisoned by the spray',
    ])('treats "%s" as urgent', text => {
        expect(isUrgentMessage(text)).toBe(true);
    });

    it.each([
        'Which pesticide works on fall armyworm?',
        'How much water do I mix with the spray?',
        'My chickens were poisoned by the neighbour',
        'Maize leaves are yellow after the rain',
        'Bei ya mahindi leo ni ngapi?',
    ])('treats "%s" as an ordinary question', text => {
        expect(isUrgentMessage(text)).toBe(false);
    });

    it('gives fixed first-aid steps in the farmer\'s language, with no dose or remedy', () => {
        expect(urgentSafetyText('en')).toMatch(/nearest health facility/);
        expect(urgentSafetyText('sw')).toMatch(/kituo cha afya/);
        expect(urgentSafetyText('fr')).toBe(urgentSafetyText('en'));
        expect(urgentSafetyText('en')).not.toMatch(/\d+\s?(ml|mg|g|litre|liter)/i);
    });
});
