/* eslint-disable @typescript-eslint/no-explicit-any */
import { AIRouter, ReasoningResult } from '@/services/aiProvider/aiProvider';
import { AssetValidationService } from '@/services/assetValidationService';
import { logger } from '@/utils/logger';
import { normalizeAllCapsText } from '@/services/knowledge/textNormalize';

/**
 * Visual assets + TTS post-processing for knowledge answers.
 */

export async function enhanceImages(enhancedVisuals: Record<string, any>, searchQuery: string): Promise<void> {
    if (!enhancedVisuals.images || enhancedVisuals.images.length === 0) return;

    const validImageUrls = await AssetValidationService.validateAssetUrls(
        enhancedVisuals.images.map((img: Record<string, any>) => img.url)
    );

    enhancedVisuals.images = enhancedVisuals.images.filter((img: Record<string, any>) =>
        validImageUrls.includes(img.url)
    );

    if (enhancedVisuals.images.length < 2) {
        try {
            const additionalImages = await AssetValidationService.getRelevantImages(searchQuery, 3);
            const existingUrls = new Set(enhancedVisuals.images.map((img: Record<string, any>) => img.url));

            for (const additional of additionalImages) {
                if (!existingUrls.has(additional.url)) {
                    enhancedVisuals.images.push({
                        url: additional.url,
                        caption: `Verified agricultural image (${additional.category})`
                    });
                    if (enhancedVisuals.images.length >= 3) break;
                }
            }
        } catch (error) {
            logger.warn('Failed to get additional relevant images:', error);
        }
    }
}

export async function enhanceVideos(enhancedVisuals: Record<string, any>): Promise<void> {
    if (!enhancedVisuals.videos || enhancedVisuals.videos.length === 0) return;

    const validVideoUrls = await AssetValidationService.validateAssetUrls(
        enhancedVisuals.videos.map((vid: Record<string, any>) => vid.url)
    );

    enhancedVisuals.videos = enhancedVisuals.videos.filter((vid: Record<string, any>) =>
        validVideoUrls.includes(vid.url)
    );
}

export async function addFallbackVisuals(enhancedVisuals: Record<string, any>, searchQuery: string): Promise<void> {
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
export async function validateAndEnhanceVisuals(visuals: Record<string, any>, searchQuery: string): Promise<Record<string, any>> {
    const enhancedVisuals = { ...visuals };

    await enhanceImages(enhancedVisuals, searchQuery);
    await enhanceVideos(enhancedVisuals);
    await addFallbackVisuals(enhancedVisuals, searchQuery);

    return enhancedVisuals;
}

export async function postProcessResponse(
    reasoningResult: ReasoningResult,
    queryText: string
): Promise<{ visuals: any; audio?: string }> {
    if (reasoningResult.answer && typeof reasoningResult.answer === 'string') {
        reasoningResult.answer = normalizeAllCapsText(reasoningResult.answer);
    }

    let audioBase64: string | undefined = undefined;
    let enhancedVisuals = reasoningResult.visuals;

    await Promise.all([
        (async () => {
            if (reasoningResult.visuals) {
                enhancedVisuals = await validateAndEnhanceVisuals(reasoningResult.visuals, queryText);
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
