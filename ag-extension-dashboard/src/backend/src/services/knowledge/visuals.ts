import { AIRouter, ReasoningResult } from '@/services/aiProvider/aiProvider';
import { AssetValidationService } from '@/services/assetValidationService';
import { logger } from '@/utils/logger';
import { normalizeAllCapsText } from '@/services/knowledge/textNormalize';
import type { AnswerVisuals } from '@/services/knowledge/types';

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

export async function enhanceImages(enhancedVisuals: AnswerVisuals, searchQuery: string): Promise<void> {
    const images = imageList(enhancedVisuals);
    if (images.length === 0) return;

    const validImageUrls = await AssetValidationService.validateAssetUrls(
        images.map((img) => img.url)
    );

    enhancedVisuals.images = images.filter((img) =>
        validImageUrls.includes(img.url)
    );

    if ((enhancedVisuals.images?.length ?? 0) < 2) {
        try {
            const additionalImages = await AssetValidationService.getRelevantImages(searchQuery, 3);
            const existingUrls = new Set((enhancedVisuals.images ?? []).map((img) => img.url));

            for (const additional of additionalImages) {
                if (!existingUrls.has(additional.url)) {
                    (enhancedVisuals.images ?? []).push({
                        url: additional.url,
                        caption: `Verified agricultural image (${additional.category})`
                    });
                    if ((enhancedVisuals.images?.length ?? 0) >= 3) break;
                }
            }
        } catch (error) {
            logger.warn('Failed to get additional relevant images:', error);
        }
    }
}

export async function enhanceVideos(enhancedVisuals: AnswerVisuals): Promise<void> {
    const videos = videoList(enhancedVisuals);
    if (videos.length === 0) return;

    const validVideoUrls = await AssetValidationService.validateAssetUrls(
        videos.map((vid) => vid.url)
    );

    enhancedVisuals.videos = videos.filter((vid) =>
        validVideoUrls.includes(vid.url)
    );
}

export async function addFallbackVisuals(enhancedVisuals: AnswerVisuals, searchQuery: string): Promise<void> {
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
export async function validateAndEnhanceVisuals(visuals: AnswerVisuals, searchQuery: string): Promise<AnswerVisuals> {
    const enhancedVisuals = { ...visuals };

    await enhanceImages(enhancedVisuals, searchQuery);
    await enhanceVideos(enhancedVisuals);
    await addFallbackVisuals(enhancedVisuals, searchQuery);

    return enhancedVisuals;
}

export async function postProcessResponse(
    reasoningResult: ReasoningResult,
    queryText: string
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
                enhancedVisuals = await validateAndEnhanceVisuals(sourceVisuals, queryText);
            }
        })(),
        (async () => {
            if (process.env.KNOWLEDGE_TTS_ENABLED !== 'true') return;
            try {
                const ttsResult = await AIRouter.routeRequest('generate', {
                    prompt: `Summarize this answer in 2 short, enticing sentences for audio playback: ${reasoningResult.answer}`,
                    options: { maxTokens: 100 }
                });
                if (ttsResult.text) {
                    const audioResult = await AIRouter.routeRequest('speech', {
                        text: ttsResult.text,
                        options: { voice: 'en-US-AriaNeural' }
                    });
                    if (audioResult && audioResult.audio) {
                        audioBase64 = audioResult.audio.toString('base64');
                    }
                }
            } catch (ttsError) {
                logger.warn('Failed to generate audio abstraction in parallel:', ttsError);
            }
        })()
    ]);

    return { visuals: enhancedVisuals, audio: audioBase64 };
}
