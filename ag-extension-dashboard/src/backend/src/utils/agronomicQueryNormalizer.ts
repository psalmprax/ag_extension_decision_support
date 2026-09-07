/**
 * Agronomic Query Normalizer & Domain Guardrails
 * 
 * Prevents semantic pollution in RAG by:
 * 1. Correcting common agricultural typos (e.g., "farners" -> "farmers", "fetilizer" -> "fertilizer").
 * 2. Anchoring ambiguous queries to agricultural domain for web retrieval.
 * 3. Rejecting non-agronomic search results (e.g., fashion tailors, retail blogs, security identity politics).
 */

// Common agricultural spelling mistakes and phonetic variations
const TYPO_MAP: Record<string, string> = {
    // Farmer / Farm
    'farner': 'farmer',
    'farners': 'farmers',
    'farn': 'farm',
    'farns': 'farms',
    'farning': 'farming',
    'famers': 'farmers',
    'famer': 'farmer',
    'frmers': 'farmers',
    'frmer': 'farmer',
    'smallhoder': 'smallholder',
    'smallhoders': 'smallholders',
    'smallhlders': 'smallholders',

    // Fertilizer / Soil nutrients
    'fetilizer': 'fertilizer',
    'fetilizers': 'fertilizers',
    'fertizer': 'fertilizer',
    'fertizers': 'fertilizers',
    'fertilzer': 'fertilizer',
    'fertilzers': 'fertilizers',
    'fertlizer': 'fertilizer',
    'fertlizers': 'fertilizers',
    'fetiliser': 'fertiliser',
    'fetilisers': 'fertilisers',
    'manur': 'manure',
    'compostng': 'composting',

    // Pesticides / Chemicals / IPM
    'pestiside': 'pesticide',
    'pestisides': 'pesticides',
    'pesticid': 'pesticide',
    'fungiside': 'fungicide',
    'fungisides': 'fungicides',
    'herbiside': 'herbicide',
    'herbisides': 'herbicides',
    'insectiside': 'insecticide',
    'insectisides': 'insecticides',

    // Crops
    'casava': 'cassava',
    'cassave': 'cassava',
    'maiz': 'maize',
    'cornn': 'corn',
    'sorghun': 'sorghum',
    'sorgum': 'sorghum',
    'plantan': 'plantain',
    'plantains': 'plantains',
    'cowpeas': 'cowpea',
    'cow pea': 'cowpea',
    'grounduts': 'groundnut',
    'ground nuts': 'groundnut',
    'tomat': 'tomato',
    'tomatos': 'tomatoes',
    'vegtables': 'vegetables',

    // Agronomy & Practices
    'agriculure': 'agriculture',
    'agricuture': 'agriculture',
    'agriclture': 'agriculture',
    'agronomist': 'agronomist',
    'agronomy': 'agronomy',
    'irrigtion': 'irrigation',
    'irigation': 'irrigation',
    'yeild': 'yield',
    'yeilds': 'yields',
    'harvst': 'harvest',
    'harves': 'harvest',
    'postharvest': 'post-harvest',
    'post harvest': 'post-harvest',
    'livestok': 'livestock',
    'poultri': 'poultry',
    'weevill': 'weevil',
    'weevils': 'weevils',
    'caterpilar': 'caterpillar',
    'caterpilars': 'caterpillars'
};

// Key roots that indicate agricultural relevance
const AGRONOMIC_KEYWORDS = [
    // General agriculture
    'farm', 'farmer', 'farmers', 'farming', 'farmland', 'farmlands',
    'crop', 'crops', 'cropland', 'cropping',
    'yield', 'yields', 'harvest', 'harvests', 'harvesting', 'post-harvest',
    'agriculture', 'agricultural', 'agronomy', 'agronomic', 'agribusiness',
    'smallholder', 'smallholders', 'extension', 'extensionist',

    // Soil & inputs
    'soil', 'soils', 'fertility', 'fertilizer', 'fertiliser', 'npk', 'urea',
    'compost', 'manure', 'mulch', 'mulching', 'tillage', 'irrigation', 'drainage',
    'seed', 'seeds', 'seedling', 'seedlings', 'variety', 'varieties', 'germination',

    // Protection & health
    'pest', 'pests', 'pesticide', 'pesticides', 'fungicide', 'fungicides',
    'herbicide', 'herbicides', 'insecticide', 'insecticides', 'ipm',
    'disease', 'diseases', 'blight', 'rot', 'wilt', 'rust', 'canker', 'mosaic',
    'armyworm', 'fall armyworm', 'stemborer', 'weevil', 'locust', 'aphid', 'whitefly',

    // Specific tropical / African crops
    'maize', 'corn', 'cassava', 'yam', 'yams', 'rice', 'paddy', 'sorghum',
    'millet', 'cowpea', 'cowpeas', 'beans', 'groundnut', 'groundnuts', 'peanut',
    'soybean', 'soybeans', 'cocoa', 'cacao', 'coffee', 'oil palm', 'palmoil',
    'cashew', 'ginger', 'sesame', 'plantain', 'plantains', 'banana', 'bananas',
    'tomato', 'tomatoes', 'pepper', 'peppers', 'chili', 'okra', 'onion', 'onions',
    'vegetable', 'vegetables', 'cassava mosaic',

    // Livestock & integration
    'livestock', 'cattle', 'cow', 'cows', 'goat', 'goats', 'sheep', 'poultry',
    'chicken', 'broiler', 'layer', 'dairy', 'fodder', 'pasture', 'silage',
    'veterinary', 'pastoralist', 'pastoralism',

    // Agricultural organizations & contexts
    'fao', 'iita', 'cabi', 'cgiar', 'moa', 'fmard', 'adp', 'agritech',
    'grain', 'tubers', 'agrochemical', 'agrochemicals', 'agro-dealer'
];

const AGRONOMIC_KEYWORD_REGEX = new RegExp(
    `\\b(${AGRONOMIC_KEYWORDS.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
    'i'
);

/**
 * Retail-venture framings that mention farmers only incidentally and must not
 * enter RAG context. Example: "how to start a farmers market business" guides
 * describe a retail-stall venture, not a farmer cooperative or agronomic
 * practice — yet they pass the keyword test via "farmers". Kept deliberately
 * narrow: legitimate market-access content (prices, buyers, cooperatives,
 * aggregation) never uses this phrasing.
 */
const RETAIL_VENTURE_CONFUSION_PATTERNS = [
    /\bfarmers?\s+market\s+business\b/i,
    /\bhow\s+to\s+start\s+a\s+farmers?\s+market\b/i,
];

function isRetailVentureConfusion(text: string): boolean {
    return RETAIL_VENTURE_CONFUSION_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Normalizes query string by fixing known agricultural typos and standardizing whitespace.
 */
export function normalizeAgronomicQuery(rawQuery: string): string {
    if (!rawQuery || typeof rawQuery !== 'string') return '';

    let cleaned = rawQuery.trim();

    // Replace words matching typo dictionary (case-insensitive, preserving boundary)
    for (const [typo, correction] of Object.entries(TYPO_MAP)) {
        const regex = new RegExp(`\\b${typo}\\b`, 'gi');
        cleaned = cleaned.replace(regex, correction);
    }

    return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Checks whether a text snippet, article, or search result is agronomically relevant.
 * Returns true if the text matches core agricultural terms.
 */
export function isAgronomicContent(text: string): boolean {
    if (!text || typeof text !== 'string') return false;
    if (isRetailVentureConfusion(text)) return false;
    return AGRONOMIC_KEYWORD_REGEX.test(text);
}

/**
 * Prepares a search query for external web search (Tavily/Jina).
 * If the query does not explicitly contain strong agricultural context,
 * appends domain keywords so the search engine does not match irrelevant retail,
 * fashion, or general political blogs.
 */
export function prepareWebSearchQuery(query: string): string {
    const normalized = normalizeAgronomicQuery(query);
    const lower = normalized.toLowerCase();

    const hasExplicitAgriSignal = /\b(farm|farmer|farmers|farming|crop|crops|agriculture|agricultural|agronomy|livestock|soil|pest|fertilizer|harvest)\b/i.test(lower);

    if (hasExplicitAgriSignal) {
        return normalized;
    }

    // Anchor ambiguous query to agriculture
    return `${normalized} agriculture farming`;
}
