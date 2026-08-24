import { createHash } from 'crypto';
import { query } from './databaseService';
import { logger } from '@/utils/logger';

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
        diagnosis: 'Likely fall armyworm',
        advice: 'Scout early morning. Treat when 2 in 10 plants show fresh leaf damage. Use recommended pesticide or hand-pick larvae. Report to your extension officer.',
    },
    {
        keywords: ['rust', 'red spots', 'brown spots leaves'],
        crop: 'maize/groundnut',
        diagnosis: 'Likely rust disease',
        advice: 'Remove heavily infected leaves. Apply a fungicide at first signs. Rotate crops next season to reduce build-up.',
    },
    {
        keywords: ['blight', 'black spots', 'leaves rotting'],
        crop: 'potato/tomato',
        diagnosis: 'Likely late blight',
        advice: 'Cool humid weather spreads blight fast. Spray a protective fungicide now and remove infected plants. Do not reuse infected plants for compost.',
    },
    {
        keywords: ['aphids', 'small insects', 'sticky leaves'],
        crop: 'vegetables',
        diagnosis: 'Likely aphid infestation',
        advice: 'Spray with soapy water or recommended insecticide. Encourage ladybirds which eat aphids.',
    },
    {
        keywords: ['stalk borer', 'stem borer', 'hollow stem'],
        crop: 'maize',
        diagnosis: 'Likely stalk borer',
        advice: 'Remove and burn infested stalks after harvest. Apply recommended insecticide in the funnel leaves.',
    },
    {
        keywords: ['wilting', 'yellow leaves', 'dying'],
        crop: 'general',
        diagnosis: 'Possible wilt disease or water stress',
        advice: 'Check for waterlogging or drought first. If wilting spreads plant-to-plant, remove infected plants and rotate to a non-host crop next season.',
    },
    {
        keywords: ['weevils', 'insects in storage', 'maize in store'],
        crop: 'stored grain',
        diagnosis: 'Likely storage weevils',
        advice: 'Treat stored grain with approved storage insecticide. Dry grain to 13% moisture before storage. Use sealed bags or bins.',
    },
    {
        keywords: ['striga', 'witchweed', 'purple flowers weeds'],
        crop: 'maize/sorghum',
        diagnosis: 'Likely Striga (witchweed)',
        advice: 'Hand-pull Striga before it flowers. Push-pull intercropping with Desmodium reduces Striga. Rotate with legumes.',
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
                'Thank you. Your message needs an officer\'s review. An extension officer will contact you. For faster help, describe: which crop, what you see on the plant, and for how long.',
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
    async handleDiagnoseMessage(message: string, farmerId: string | null, phone: string): Promise<string> {
        const result = triageSymptoms(message);
        const reply = `${result.diagnosis}\n\n${result.advice}`;

        // Log the triage into diagnosis_events so outbreak intelligence sees feature-phone reports too.
        try {
            await query(
                `INSERT INTO diagnosis_events (farmer_id, district, crop, disease_label, confidence, source)
                 SELECT $1, f.district, $2, $3, 0.5, 'sms_triage'
                 FROM (SELECT $4::uuid AS id) x
                 LEFT JOIN farmers f ON f.id = x.id`,
                [farmerId, result.crop, result.diagnosis, farmerId]
            );
        } catch (error) {
            logger.warn(`SMS triage log failed for ${phone}:`, error);
        }
        return reply;
    },

    fingerprint(message: string): string {
        return createHash('sha256').update(message.toLowerCase().trim()).digest('hex').slice(0, 16);
    },
};
