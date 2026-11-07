import type { ReasoningResult } from '@/services/aiProvider/aiProvider';
import { synthesizeVoiceAdvisory } from '@/services/voiceAudioService';
import { AssetValidationService } from '@/services/assetValidationService';
import { logger } from '@/utils/logger';
import { normalizeAllCapsText } from '@/services/knowledge/textNormalize';
import type { AnswerVisuals } from '@/services/knowledge/types';
import { withAdvisoryTimeout } from './advisoryRuntime';

/**
 * Visual assets + TTS post-processing for knowledge answers.
 */

type VisualImage = { url: string; caption?: string };
type VisualVideo = { url: string; caption?: string };

function imageList(visuals: AnswerVisuals): VisualImage[] {
    return visuals.images ?? [];
}

function videoList(visuals: AnswerVisuals): VisualVideo[] {
    return visuals.videos ?? [];
}

async function enhanceImages(enhancedVisuals: AnswerVisuals, searchQuery: string): Promise<void> {
    const images = imageList(enhancedVisuals);
    if (images.length === 0) return;

    const validImageUrls = await AssetValidationService.validateAssetUrls(
        images.map((img) => img.url)
    );

    enhancedVisuals.images = images.filter((img) =>
        validImageUrls.includes(img.url)
    );

    if ((enhancedVisuals.images?.length ?? 0) >= 2) return;

    try {
        const additionalImages = await AssetValidationService.getRelevantImages(searchQuery, 3);
        const existingUrls = new Set((enhancedVisuals.images ?? []).map((img) => img.url));

        for (const additional of additionalImages) {
            if (!existingUrls.has(additional.url)) {
                (enhancedVisuals.images ?? []).push({
                    url: additional.url,
                    caption: `Agricultural reference image (${additional.category})`
                });
                if ((enhancedVisuals.images?.length ?? 0) >= 3) break;
            }
        }
    } catch (error) {
        logger.warn('Failed to get additional relevant images:', error);
    }
}

async function enhanceVideos(enhancedVisuals: AnswerVisuals): Promise<void> {
    const videos = videoList(enhancedVisuals);
    if (videos.length === 0) return;

    const validVideoUrls = await AssetValidationService.validateAssetUrls(
        videos.map((vid) => vid.url)
    );

    enhancedVisuals.videos = videos.filter((vid) =>
        validVideoUrls.includes(vid.url)
    );
}

async function addFallbackVisuals(enhancedVisuals: AnswerVisuals, searchQuery: string): Promise<void> {
    if ((!enhancedVisuals.images || enhancedVisuals.images.length === 0) &&
        (!enhancedVisuals.charts || enhancedVisuals.charts.length === 0)) {
        try {
            logger.info(`No visuals found for query "${searchQuery}", attempting to get relevant images`);
            const relevantImages = await AssetValidationService.getRelevantImages(searchQuery, 2);

            if (relevantImages.length > 0) {
                enhancedVisuals.images = relevantImages.map(img => ({
                    url: img.url,
                    caption: `Agricultural reference image (${img.category})`
                }));
            }
        } catch (error) {
            logger.warn('Failed to get fallback images:', error);
        }
    }
}

/** Validates and enhances visual assets with runtime checks. */
async function validateAndEnhanceVisuals(visuals: AnswerVisuals, searchQuery: string): Promise<AnswerVisuals> {
    const enhancedVisuals = { ...visuals };

    await enhanceImages(enhancedVisuals, searchQuery);
    await enhanceVideos(enhancedVisuals);
    await addFallbackVisuals(enhancedVisuals, searchQuery);

    return enhancedVisuals;
}

export async function postProcessResponse(
    reasoningResult: ReasoningResult,
    queryText: string,
    language?: string
): Promise<{ visuals: AnswerVisuals | undefined; audio?: string }> {
    if (reasoningResult.answer && typeof reasoningResult.answer === 'string') {
        reasoningResult.answer = normalizeAllCapsText(reasoningResult.answer);
    }

    let audioBase64: string | undefined = undefined;
    let enhancedVisuals = reasoningResult.visuals;
    const sourceVisuals = reasoningResult.visuals;

    await Promise.all([
        (async () => {
            if (sourceVisuals) {
                try {
                    enhancedVisuals = await withAdvisoryTimeout(
                        () => validateAndEnhanceVisuals(sourceVisuals, queryText), 8000, 'Knowledge visual assets'
                    );
                } catch (error) {
                    enhancedVisuals = undefined;
                    logger.warn('Knowledge visual assets unavailable:', error);
                }
            }
        })(),
        (async () => {
            if (process.env.KNOWLEDGE_TTS_ENABLED !== 'true') return;
            if (language !== 'en' && language !== 'sw') {
                logger.info('Knowledge server speech skipped: an explicitly supported language is required');
                return;
            }
            try {
                const audioResult = await withAdvisoryTimeout(() => synthesizeVoiceAdvisory({
                    text: reasoningResult.answer,
                    language,
                }), 15000, 'Knowledge speech');
                audioBase64 = audioResult.audioBase64;
            } catch (ttsError) {
                logger.warn('Failed to generate audio abstraction in parallel:', ttsError);
            }
        })()
    ]);

    return { visuals: enhancedVisuals, audio: audioBase64 };
}
