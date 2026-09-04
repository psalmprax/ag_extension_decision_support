import { logger } from '@/utils/logger';
import { cacheGet, cacheSet } from '@/services/cacheService';
import { ASSET_LIBRARY } from '@/services/aiProvider/assetLibrary';

/**
 * Block list of hostnames, IPs, and patterns that must never be contacted
 * from server-side fetches — cloud metadata endpoints, internal services,
 * and loopback addresses.
 */
const SSRF_BLOCKED_HOSTS = [
    '169.254.169.254',       // AWS / GCP / Azure cloud metadata
    'metadata.google.internal',
    'metadata',               // link-local
    'localhost',
    '127.0.0.1',
    '::1',
    '0.0.0.0',
    '[::]',
];

const SSRF_BLOCKED_PREFIXES = ['10.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.',
    '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.',
    '172.28.', '172.29.', '172.30.', '172.31.', '192.168.'];

function isSsrfTarget(hostname: string): boolean {
    const lower = hostname.toLowerCase();
    if (SSRF_BLOCKED_HOSTS.includes(lower)) return true;
    for (const prefix of SSRF_BLOCKED_PREFIXES) {
        if (lower.startsWith(prefix)) return true;
    }
    return false;
}

function ssrfSafeUrl(rawUrl: string): URL | null {
    let parsed: URL;
    try {
        parsed = new URL(rawUrl);
    } catch {
        return null;
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    if (isSsrfTarget(parsed.hostname)) return null;
    return parsed;
}

export interface ValidationResult {
  isValid: boolean;
  statusCode?: number;
  error?: string;
  lastChecked?: string;
  contentType?: string;
}

export interface ImageRelevanceResult {
  isRelevant: boolean;
  confidence: number;
  detectedObjects?: string[];
  relevanceScore: number;
}

interface CandidateImageResult {
  url: string;
  relevance: ImageRelevanceResult;
  category: string;
}

export class AssetValidationService {
  private static readonly CACHE_TTL = 3600; // 1 hour
  private static readonly MAX_RETRIES = 2;

  /** Validates if a URL is accessible and returns proper HTTP status. */
  static async validateUrl(url: string): Promise<ValidationResult> {
    // Fast path: library assets in ASSET_LIBRARY are verified static assets
    if (
      Object.values(ASSET_LIBRARY.images).includes(url) ||
      Object.values(ASSET_LIBRARY.videos).includes(url)
    ) {
      return { isValid: true, statusCode: 200, lastChecked: new Date().toISOString() };
    }

    const safeUrl = ssrfSafeUrl(url);
    if (!safeUrl) {
      return { isValid: false, lastChecked: new Date().toISOString(), error: 'URL rejected by SSRF guard' };
    }

    const cached = await this.getCachedResult(url);
    if (cached) return cached;

    return this.fetchWithRetries(url, safeUrl);
  }

  private static async getCachedResult(url: string): Promise<ValidationResult | null> {
    const cacheKey = `url_validation:${url}`;
    const cached = await cacheGet(cacheKey);
    if (!cached) return null;
    const result = JSON.parse(cached);
    if (result.lastChecked && Date.now() - new Date(result.lastChecked).getTime() < 30 * 60 * 1000) {
      return result;
    }
    return null;
  }

  private static async fetchWithRetries(url: string, safeUrl: URL): Promise<ValidationResult> {
    const cacheKey = `url_validation:${url}`;
    const result: ValidationResult = { isValid: false, lastChecked: new Date().toISOString() };

    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(safeUrl, {
          method: 'HEAD', signal: controller.signal,
          headers: { 'User-Agent': 'ALFA-Agricultural-Assistant/1.0' },
        });

        clearTimeout(timeoutId);
        result.isValid = response.ok;
        result.statusCode = response.status;
        result.contentType = response.headers.get('content-type') || undefined;
        if (response.ok) await cacheSet(cacheKey, JSON.stringify(result), this.CACHE_TTL);
        break;
      } catch (error) {
        result.error = `Attempt ${attempt + 1}: ${(error as Error).message}`;
        if (attempt === this.MAX_RETRIES) {
          await cacheSet(cacheKey, JSON.stringify(result), 300);
        }
      }
    }

    logger.info(`URL validation for ${url}: ${result.isValid ? 'VALID' : 'INVALID'} (${result.statusCode || result.error})`);
    return result;
  }

  /**
   * Validates image content relevance using AI vision analysis
   */
  static async validateImageRelevance(imageUrl: string, searchQuery: string, expectedKeywords: string[]): Promise<ImageRelevanceResult> {
    const cacheKey = `image_relevance:${imageUrl}:${searchQuery}`;

    // Check cache first
    const cached = await cacheGet(cacheKey);
    if (cached) {
      const result = JSON.parse(cached);
      if (Date.now() - new Date(result.lastChecked).getTime() < 24 * 60 * 60 * 1000) { // 24 hours
        return result;
      }
    }

    // Fast path: library assets already correspond to verified agricultural concepts
    if (Object.values(ASSET_LIBRARY.images).includes(imageUrl)) {
      return {
        isRelevant: true,
        confidence: 0.95,
        detectedObjects: expectedKeywords,
        relevanceScore: 0.95,
      };
    }

    try {
      // Use AI vision to analyze image content
      const visionResult = await this.analyzeImageContent(imageUrl);

      // Calculate relevance score based on detected objects and keywords
      const relevanceScore = this.calculateRelevanceScore(
        visionResult.detectedObjects || [],
        expectedKeywords,
        searchQuery
      );

      const result: ImageRelevanceResult = {
        isRelevant: relevanceScore >= 0.6, // 60% threshold
        confidence: visionResult.confidence || 0.5,
        detectedObjects: visionResult.detectedObjects,
        relevanceScore
      };

      // Cache the result
      await cacheSet(cacheKey, JSON.stringify({ ...result, lastChecked: new Date().toISOString() }), this.CACHE_TTL * 24);

      return result;

    } catch (error) {
      logger.error(`Image relevance validation failed for ${imageUrl}:`, error);

      // Return low-confidence result on failure
      return {
        isRelevant: false,
        confidence: 0.1,
        relevanceScore: 0.1
      };
    }
  }

  /**
   * Analyzes image content using AI vision capabilities
   */
  private static async analyzeImageContent(imageUrl: string): Promise<{ detectedObjects: string[], confidence: number }> {
    try {
      // Import dynamically to avoid circular dependencies
      const { AIRouter } = await import('@/services/aiProvider/aiProvider');

      const prompt = `Analyze this agricultural image and identify the main objects, crops, farming equipment, or agricultural activities visible. Return a JSON object with "detected_objects" array and "confidence" score (0-1). Focus on agricultural relevance.`;

      const response = await AIRouter.routeRequest('vision', {
        imageData: imageUrl,
        prompt,
        options: { maxTokens: 200 }
      });

      // Parse the AI response
      const text = response?.text || response?.description || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return {
          detectedObjects: parsed.detected_objects || [],
          confidence: parsed.confidence || 0.5
        };
      }

      // Fallback: extract keywords from text response
      const objects = text.toLowerCase().split(/[,.\n]/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 2 && !s.includes('confidence'))
        .slice(0, 10);

      return {
        detectedObjects: objects,
        confidence: 0.3 // Lower confidence for fallback
      };

    } catch (error) {
      logger.error('Vision analysis failed:', error);
      return { detectedObjects: [], confidence: 0 };
    }
  }

  /**
   * Calculates relevance score based on detected objects and expected keywords
   */
  private static calculateRelevanceScore(detectedObjects: string[], expectedKeywords: string[], searchQuery: string): number {
    if (!detectedObjects.length) return 0;

    const queryWords = searchQuery.toLowerCase().split(/\s+/);
    const allKeywords = [...expectedKeywords, ...queryWords].map(k => k.toLowerCase());

    let totalScore = 0;
    let matches = 0;

    for (const keyword of allKeywords) {
      const keywordScore = detectedObjects
        .map(obj => obj.toLowerCase())
        .reduce((score, obj) => {
          if (obj.includes(keyword) || keyword.includes(obj)) {
            matches++;
            return score + 1;
          }
          return score;
        }, 0);

      totalScore += Math.min(keywordScore, 1); // Cap at 1 per keyword
    }

    // Normalize by number of expected keywords, but ensure at least some relevance
    const normalizedScore = matches > 0 ? Math.min(totalScore / Math.max(allKeywords.length, 2), 1) : 0;

    return normalizedScore;
  }

  /**
   * Validates and filters asset URLs, returning only working ones
   */
  static async validateAssetUrls(urls: string[]): Promise<string[]> {
    const validationPromises = urls.map(url => this.validateUrl(url));
    const results = await Promise.allSettled(validationPromises);

    const validUrls: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.isValid) {
        validUrls.push(urls[index]);
      } else {
        logger.warn(`Asset URL validation failed for ${urls[index]}:`, result.status === 'rejected' ? result.reason : result.value.error);
      }
    });

    return validUrls;
  }

  /**
   * Gets relevant images for a search query with validation
   */
  static async getRelevantImages(searchQuery: string, maxImages: number = 3): Promise<Array<{ url: string, relevance: ImageRelevanceResult, category: string }>> {
    // Extract keywords from search query
    const keywords = this.extractKeywords(searchQuery);

    // Find potential relevant images from library
    const candidateImages = this.findCandidateImages(keywords, ASSET_LIBRARY.images);

    // Validate URLs and check relevance
    const relevancePromises = candidateImages.map(async (image) => {
      const validation = await this.validateUrl(image.url);
      if (!validation.isValid) return null;

      const relevance = await this.validateImageRelevance(image.url, searchQuery, image.keywords);
      return {
        url: image.url,
        relevance,
        category: image.category
      };
    });

    const results = await Promise.allSettled(relevancePromises);
    const validResults = results
      .filter((result): result is PromiseFulfilledResult<CandidateImageResult> => result.status === 'fulfilled' && result.value !== null)
      .map(result => result.value)
      .filter(item => item.relevance.isRelevant)
      .sort((a, b) => b.relevance.relevanceScore - a.relevance.relevanceScore)
      .slice(0, maxImages);

    logger.info(`Found ${validResults.length} relevant images for query "${searchQuery}" from ${candidateImages.length} candidates`);
    return validResults;
  }

  /**
   * Extracts keywords from search query
   */
  private static extractKeywords(query: string): string[] {
    const agriculturalKeywords = [
      'maize', 'corn', 'beans', 'rice', 'wheat', 'potato', 'tomato', 'cabbage',
      'soil', 'fertility', 'ph', 'irrigation', 'water', 'drip', 'sprinkler',
      'pests', 'disease', 'fungus', 'bacteria', 'virus', 'aphids', 'weevils',
      'harvest', 'yield', 'crop', 'farming', 'agriculture', 'tractor', 'plow',
      'seeds', 'planting', 'germination', 'fertilizer', 'pesticide', 'herbicide',
      'greenhouse', 'hydroponic', 'organic', 'sustainable', 'climate', 'weather'
    ];

    const words = query.toLowerCase().split(/\s+/);
    return words.filter(word => agriculturalKeywords.some(keyword =>
      keyword.includes(word) || word.includes(keyword)
    ));
  }

  /**
   * Finds candidate images from asset library based on keywords
   */
  private static findCandidateImages(keywords: string[], imageLibrary: Record<string, string>): Array<{ url: string, keywords: string[], category: string }> {
    const candidates: Array<{ url: string, keywords: string[], category: string }> = [];

    for (const [category, url] of Object.entries(imageLibrary)) {
      const categoryKeywords = category.split('_').concat([category]);
      const relevanceScore = keywords.reduce((score, keyword) =>
        categoryKeywords.some(cat => cat.toLowerCase().includes(keyword.toLowerCase())) ? score + 1 : score,
        0
      );

      if (relevanceScore > 0) {
        candidates.push({
          url,
          keywords: categoryKeywords,
          category
        });
      }
    }

    // Sort by relevance and return top candidates
    return candidates
      .sort((a, b) => b.keywords.length - a.keywords.length)
      .slice(0, 10); // Limit to prevent too many API calls
  }
}