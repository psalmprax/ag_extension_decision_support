/**
 * Visit notes dictated in a language other than English get an English summary, so a
 * manager or another officer can read them. The original words are always kept; the
 * summary is marked as AI output to be checked against the recording.
 */
import { logger } from '@/utils/logger';
import { AIProviderFactory } from '@/services/aiProvider/aiProvider';
import { usageService } from '@/services/usageService';

const MARK = 'English summary (AI, check against the recording):';

/** The notes with an English summary added, or the notes unchanged when none is needed or possible. */
export async function withEnglishSummary(notes: string, spokenLanguage: string | undefined, staffId: string): Promise<string> {
    const language = spokenLanguage?.toLowerCase().slice(0, 2);
    if (!notes.trim() || !language || language === 'en') return notes;
    try {
        const limit = await usageService.checkLimit(staffId, 'ai_chat');
        if (!limit.allowed) return notes;
        const result = await AIProviderFactory.getWithFallback(provider => provider.generateText([
            {
                role: 'system',
                content: 'You translate an extension officer\'s spoken field-visit notes into plain English and summarise them in at most three sentences. ' +
                    'Use only what the notes say. Keep crop names, numbers and place names exactly. Do not add advice.',
            },
            { role: 'user', content: notes },
        ], { temperature: 0, maxTokens: 300 }));
        const summary = result.text?.trim();
        if (!summary) return notes;
        await usageService.incrementUsage(staffId, 'ai_chat').catch(error => logger.warn('Failed to meter a visit-note summary:', error));
        return `${notes}\n\n${MARK} ${summary}`;
    } catch (error) {
        logger.warn('Could not summarise dictated visit notes; keeping the original only:', error);
        return notes;
    }
}
