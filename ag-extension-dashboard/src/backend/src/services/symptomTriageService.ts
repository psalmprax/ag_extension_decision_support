import { createHash } from 'crypto';
import { messagingKnowledgeReply } from './knowledge/messagingHints';

/**
 * Symptom triage over SMS/USSD — pure keyword matching against regional
 * playbooks. Works on feature phones with no app and no AI round-trip.
 * The LLM chatbot remains the escalation path for unmatched symptoms.
 */

export interface TriagePlaybook {
    keywords: string[]; // lowercase; matched against the message
    crop: string;
    diagnosis: string;
    advice: string;
    escalate?: boolean;
}

export const PLAYBOOKS: TriagePlaybook[] = [
    {
        keywords: ['armyworm', 'fall armyworm', 'worms eating', 'caterpillar'],
        crop: 'maize',
        diagnosis: 'Possible armyworm symptoms',
        advice: 'Scout the affected plants and contact a local extension officer for confirmation.',
    },
    {
        keywords: ['rust', 'red spots', 'brown spots leaves'],
        crop: 'maize/groundnut',
        diagnosis: 'Possible rust symptoms',
        advice: 'Record where the spots appear and contact a local extension officer for confirmation.',
    },
    {
        keywords: ['blight', 'black spots', 'leaves rotting'],
        crop: 'potato/tomato',
        diagnosis: 'Possible blight symptoms',
        advice: 'Record when the spots appeared and contact a local extension officer for confirmation.',
    },
    {
        keywords: ['aphids', 'small insects', 'sticky leaves'],
        crop: 'vegetables',
        diagnosis: 'Possible aphid symptoms',
        advice: 'Inspect the affected plants and contact a local extension officer for confirmation.',
    },
    {
        keywords: ['stalk borer', 'stem borer', 'hollow stem'],
        crop: 'maize',
        diagnosis: 'Possible stalk borer symptoms',
        advice: 'Inspect the affected stalks and contact a local extension officer for confirmation.',
    },
    {
        keywords: ['wilting', 'yellow leaves', 'dying'],
        crop: 'general',
        diagnosis: 'Possible wilt disease or water stress',
        advice: 'Check whether the soil is waterlogged or dry and contact a local extension officer for confirmation.',
    },
    {
        keywords: ['weevils', 'insects in storage', 'maize in store'],
        crop: 'stored grain',
        diagnosis: 'Possible storage weevils',
        advice: 'Inspect the stored grain and contact a local extension officer for confirmation.',
    },
    {
        keywords: ['striga', 'witchweed', 'purple flowers weeds'],
        crop: 'maize/sorghum',
        diagnosis: 'Possible Striga (witchweed)',
        advice: 'Note where the weeds occur and contact a local extension officer for confirmation.',
    },
];

export interface TriageResult {
    matched: boolean;
    crop: string;
    diagnosis: string;
    advice: string;
    escalate: boolean;
}

/** Pure matcher — message text is lowercased and matched against playbooks. */
export function triageSymptoms(message: string): TriageResult {
    const text = message.toLowerCase();
    let best: { playbook: TriagePlaybook; score: number } | null = null;

    for (const playbook of PLAYBOOKS) {
        const score = playbook.keywords.reduce((s, k) => (text.includes(k) ? s + k.length : s), 0);
        if (score > 0 && (!best || score > best.score)) {
            best = { playbook, score };
        }
    }

    if (!best) {
        return {
            matched: false,
            crop: 'unknown',
            diagnosis: 'Symptom not recognized',
            advice:
                'Contact a local extension officer. Describe the crop, what you see and for how long. No request has been sent to an officer.',
            escalate: true,
        };
    }

    return {
        matched: true,
        crop: best.playbook.crop,
        diagnosis: best.playbook.diagnosis,
        advice: best.playbook.advice,
        escalate: best.playbook.escalate === true,
    };
}

export const symptomTriageService = {
    triageSymptoms,

    /**
     * Handle a 'diagnose' flow message from the onboarding engine.
     * Returns the reply text to send back over the same channel.
     */
    async handleDiagnoseMessage(message: string, _farmerId: string | null, _phone: string): Promise<string> {
        return messagingKnowledgeReply(message);
    },

    fingerprint(message: string): string {
        return createHash('sha256').update(message.toLowerCase().trim()).digest('hex').slice(0, 16);
    },
};
