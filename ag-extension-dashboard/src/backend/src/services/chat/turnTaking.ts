/**
 * Turn-taking between a farmer's officer and the AI in a farmer thread.
 *
 * The farmer is never left waiting: they can ask the AI at any time, and if
 * their officer has not replied within the organisation's wait time (or it is
 * outside working hours) the AI answers, saying the officer has been
 * notified. Once the officer is active in the thread the AI holds back for a
 * while so the farmer does not get two voices at once. Urgent messages get a
 * fixed safety message straight away and the officer is alerted.
 */
import { z } from 'zod';

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24-hour)');

function isTimeZone(value: string): boolean {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: value });
        return true;
    } catch {
        return false;
    }
}

export const turnTakingSettingsSchema = z.object({
    /** Minutes the farmer waits for their officer before the AI answers (working hours). */
    aiFallbackMinutes: z.number().int().min(1).max(24 * 60),
    workingHours: z.object({
        start: clock,
        end: clock,
        /** 0 = Sunday … 6 = Saturday. */
        days: z.array(z.number().int().min(0).max(6)).max(7),
        timezone: z.string().refine(isTimeZone, 'Unknown time zone'),
    }),
    /** After an officer reply, the AI does not answer automatically for this long. */
    aiPauseAfterOfficerMinutes: z.number().int().min(0).max(24 * 60),
    /** AI answers per farmer per day by SMS (each answer costs SMS parts). */
    smsAiDailyLimit: z.number().int().min(0).max(100),
});

export type TurnTakingSettings = z.infer<typeof turnTakingSettingsSchema>;

export const DEFAULT_TURN_TAKING: TurnTakingSettings = {
    aiFallbackMinutes: 30,
    workingHours: { start: '08:00', end: '17:00', days: [1, 2, 3, 4, 5, 6], timezone: 'Africa/Nairobi' },
    aiPauseAfterOfficerMinutes: 120,
    smsAiDailyLimit: 10,
};

/** Effective settings from a tenant's capabilities JSON; anything invalid falls back to the default. */
export function resolveTurnTakingSettings(capabilities: unknown): TurnTakingSettings {
    const stored = (capabilities as { chatTurnTaking?: unknown } | null)?.chatTurnTaking;
    const merged = {
        ...DEFAULT_TURN_TAKING,
        ...(typeof stored === 'object' && stored ? stored : {}),
        workingHours: {
            ...DEFAULT_TURN_TAKING.workingHours,
            ...((stored as { workingHours?: object } | undefined)?.workingHours ?? {}),
        },
    };
    const parsed = turnTakingSettingsSchema.safeParse(merged);
    return parsed.success ? parsed.data : DEFAULT_TURN_TAKING;
}

const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Whether `at` falls inside the organisation's working hours, in its own time zone. */
export function isWithinWorkingHours(at: Date, settings: TurnTakingSettings): boolean {
    const { start, end, days, timezone } = settings.workingHours;
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(at);
    const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
    if (!days.includes(WEEKDAY[get('weekday')])) return false;
    const now = `${get('hour')}:${get('minute')}`;
    return now >= start && now < end;
}

export interface ThreadTurnState {
    /** The farmer's latest message, if any. */
    lastFarmerMessageAt: Date | null;
    /** An officer or the AI has replied since that message. */
    answeredSinceFarmer: boolean;
    /** The officer's latest message in the thread. */
    lastOfficerMessageAt: Date | null;
}

export type AutoReplyDecision =
    | { action: 'none'; reason: 'nothing_to_answer' | 'already_answered' | 'too_old' }
    | { action: 'wait'; until: Date; reason: 'officer_active' | 'officer_may_reply' }
    | { action: 'answer'; reason: 'officer_unavailable' | 'outside_hours' };

/** Messages older than this are never answered automatically (no bursts of stale answers). */
export const MAX_AUTO_ANSWER_AGE_MS = 24 * 60 * 60 * 1000;

const minutes = (n: number) => n * 60 * 1000;

/** Whether the AI should answer the farmer's latest message now. */
export function decideAutoReply(state: ThreadTurnState, now: Date, settings: TurnTakingSettings): AutoReplyDecision {
    const { lastFarmerMessageAt, lastOfficerMessageAt } = state;
    if (!lastFarmerMessageAt) return { action: 'none', reason: 'nothing_to_answer' };
    if (state.answeredSinceFarmer) return { action: 'none', reason: 'already_answered' };
    if (now.getTime() - lastFarmerMessageAt.getTime() > MAX_AUTO_ANSWER_AGE_MS) return { action: 'none', reason: 'too_old' };

    const pauseEnds = lastOfficerMessageAt
        ? new Date(lastOfficerMessageAt.getTime() + minutes(settings.aiPauseAfterOfficerMinutes))
        : null;
    if (pauseEnds && pauseEnds > now) return { action: 'wait', until: pauseEnds, reason: 'officer_active' };

    if (!isWithinWorkingHours(now, settings)) return { action: 'answer', reason: 'outside_hours' };

    const deadline = new Date(lastFarmerMessageAt.getTime() + minutes(settings.aiFallbackMinutes));
    return deadline <= now
        ? { action: 'answer', reason: 'officer_unavailable' }
        : { action: 'wait', until: deadline, reason: 'officer_may_reply' };
}

// ── Urgent messages ───────────────────────────────────────────────────────────

const CHEMICAL = String.raw`(pesticide|chemical|insecticide|herbicide|fungicide|spray|poison|sumu|dawa ya (kuua|wadudu|kunyunyiza))`;
const URGENT_PATTERNS: RegExp[] = [
    // Swallowed or drank a chemical (English / Swahili).
    new RegExp(String.raw`\b(swallow(ed)?|drank|drunk|ate|amekunywa|amemeza|alikunywa|alimeza)\b.{0,40}${CHEMICAL}`),
    new RegExp(String.raw`${CHEMICAL}.{0,40}\b(swallow(ed)?|drank|drunk|amekunywa|amemeza|alikunywa|alimeza)\b`),
    // A person (not livestock or pests) poisoned.
    /\b(i|we|he|she|they|my (child|son|daughter|wife|husband|worker)|a worker|someone|mtoto)\b.{0,30}\b(was |were |got |has been |have been |is )?poisoned\b/,
    // Chemical in the eyes or on the skin.
    new RegExp(String.raw`${CHEMICAL}.{0,40}\b(in|into) (my|his|her|their|the) eyes?\b`),
    new RegExp(String.raw`\b(splashed|spilled)\b.{0,40}${CHEMICAL}`),
    // Life-threatening signs.
    /\b(can'?t|cannot|can not|not) breath(e|ing)\b/,
    /\b(unconscious|collapsed|fainted|seizure|convulsions?|fitting)\b/,
    /\bhawezi kupumua\b|\bamezimia\b|\bamepoteza fahamu\b/,
    /\bsnake ?bite\b|\bbitten by a snake\b|\bkuumwa na nyoka\b|\bameumwa na nyoka\b/,
    /\bbleeding (heavily|badly|a lot)\b/,
];

/** A message that needs safety steps now rather than an agronomic answer. */
export function isUrgentMessage(text: string): boolean {
    const normalized = text.toLowerCase().replace(/\s+/g, ' ');
    return URGENT_PATTERNS.some(pattern => pattern.test(normalized));
}

/**
 * Fixed safety message for urgent messages: standard first aid for pesticide
 * exposure and a referral to medical care. It is written by people, never
 * generated, so it cannot contain an invented dose or remedy.
 */
const URGENT_SAFETY_TEXT: Record<'en' | 'sw', string> = {
    en: 'This sounds like an emergency. Get medical help now: go to the nearest health facility or call your local emergency number. ' +
        'If a chemical is involved: move away from it, remove contaminated clothing, rinse skin or eyes with clean running water for at least 15 minutes, ' +
        'do not make the person vomit, and take the product label or container with you. Your extension officer has been alerted.',
    sw: 'Hii inaonekana kuwa dharura. Pata msaada wa matibabu sasa: nenda kituo cha afya kilicho karibu au piga nambari ya dharura. ' +
        'Ikiwa kemikali inahusika: ondoka mbali nayo, vua nguo zilizochafuliwa, osha ngozi au macho kwa maji safi yanayotiririka kwa angalau dakika 15, ' +
        'usimfanye mtu atapike, na beba lebo au chombo cha bidhaa. Afisa wako wa ugani amejulishwa.',
};

export function urgentSafetyText(language?: string | null): string {
    return language?.toLowerCase().startsWith('sw') ? URGENT_SAFETY_TEXT.sw : URGENT_SAFETY_TEXT.en;
}

/** Footer on an automatic AI answer, so the farmer knows who answered and that a person will follow up. */
export function autoAnswerFooter(
    reason: 'officer_unavailable' | 'outside_hours' | 'farmer_request',
    language?: string | null,
    channel?: 'sms' | 'whatsapp' | 'telegram' | null,
): string {
    const sw = language?.toLowerCase().startsWith('sw');
    if (channel === 'sms') return sw ? '(Jibu la AI; afisa wako ataliona.)' : '(AI answer; your officer will see it.)';
    if (reason === 'farmer_request') {
        return sw ? 'Jibu hili limetolewa na AI. Afisa wako wa ugani anaweza kuliona.' : 'This answer is from the AI. Your extension officer can see it.';
    }
    return sw
        ? 'Jibu hili limetolewa na AI kwa sababu afisa wako hajajibu bado. Afisa wako amejulishwa na atalikagua.'
        : 'This answer is from the AI because your officer has not replied yet. Your officer has been notified and will review it.';
}
