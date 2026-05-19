/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ALFA VERIFIED ASSET LIBRARY (Hardened for Production)
 * 
 * ALL image URLs below have been individually verified with HTTP 200 status.
 * ALL video URLs are verified working YouTube links.
 * DO NOT change these URLs without re-verifying them first.
 */
export const ASSET_LIBRARY = {
    images: {
        maize: "https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?q=80&w=800&auto=format&fit=crop",
        soil: "https://images.unsplash.com/photo-1615811361523-6bd03d7748e7?q=80&w=800&auto=format&fit=crop",
        irrigation: "https://images.unsplash.com/photo-1622383563227-04401ab4e5ea?q=80&w=800&auto=format&fit=crop",
        farmer: "https://images.unsplash.com/photo-1589923188900-85dae523342b?q=80&w=800&auto=format&fit=crop",
        pests: "https://images.unsplash.com/photo-1471193945509-9ad0617afabf?q=80&w=800&auto=format&fit=crop",
        harvest: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?q=80&w=800&auto=format&fit=crop",
        tractor: "https://images.unsplash.com/photo-1586771107445-d3ca888129ff?q=80&w=800&auto=format&fit=crop",
        field: "https://images.unsplash.com/photo-1464226184884-fa280b87c399?q=80&w=800&auto=format&fit=crop",
        livestock: "https://images.unsplash.com/photo-1500595046743-cd271d694d30?q=80&w=800&auto=format&fit=crop",
        landscape: "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?q=80&w=800&auto=format&fit=crop",
        crops: "https://images.unsplash.com/photo-1560493676-04071c5f467b?q=80&w=800&auto=format&fit=crop",
        greenhouse: "https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?q=80&w=800&auto=format&fit=crop",
        weather: "https://images.unsplash.com/photo-1499529112087-3cb3b73cec95?q=80&w=800&auto=format&fit=crop",
        seeds: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?q=80&w=800&auto=format&fit=crop",
        market: "https://images.unsplash.com/photo-1595855759920-86582396756a?q=80&w=800&auto=format&fit=crop",
        research: "https://images.unsplash.com/photo-1574943320219-553eb213f72d?q=80&w=800&auto=format&fit=crop"
    },
    videos: {
        maize_farming: "https://www.youtube.com/watch?v=j11x_F5S53w",
        soil_health: "https://www.youtube.com/watch?v=Z-wj139PXiI",
        climate_smart: "https://www.youtube.com/watch?v=vCn8kPzLIkY",
        ipm: "https://www.youtube.com/watch?v=GkteUqsxAWw",
        irrigation_methods: "https://www.youtube.com/watch?v=2dXUxMqxL0w"
    }
};

/**
 * Shared System Prompt for Multimodal Reasoning
 */
export const REASONING_SYSTEM_PROMPT = `
You are an expert AI Agricultural Analyst for the ALFA Intelligence Engine.
Provide a high-quality, actionable response including expert analysis and visual data.

### COMPREHENSIVE EXPERT LAYOUT REQUIREMENTS:
Your response should be incredibly publication-grade, detailed, and cover the following aspects systematically:
- **Executive Summary / Advisory**: Provide a highly readable grid of bulleted takeaways.
- **Soil & Nutrient Profile**: Diagnostic review of soil composition, pH, N-P-K requirements (in kg/ha), and organic composting recommendations.
- **Water & Irrigation Plan**: Daily precision irrigation schedules based on Evapotranspiration (ETc = ETo x Kc) or specific crop factors, detailing flow rates and emitter placement.
- **Pathology & Prevention Protocols**: Pest control, whitefly or rust mitigations, pruning cycles, and integrated pest management (IPM) guidelines.
- **Scientific Equations & Mathematical Modeling**: Whenever applicable, write out the explicit equations and math calculations (e.g. daily water budget, nutrient ratio math).

### ALFA VERIFIED ASSET LIBRARY WITH RUNTIME VALIDATION:
You MUST ONLY use the EXACT URLs below. DO NOT modify, shorten, or construct new URLs.
COPY-PASTE these URLs exactly as shown. The system will automatically validate URLs and ensure image relevance.

**IMAGES (use the FULL URL exactly as written — choose 2-3 most relevant based on search query):**
- maize/corn: https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?q=80&w=800&auto=format&fit=crop
- soil/earth: https://images.unsplash.com/photo-1615811361523-6bd03d7748e7?q=80&w=800&auto=format&fit=crop
- irrigation/water: https://images.unsplash.com/photo-1622383563227-04401ab4e5ea?q=80&w=800&auto=format&fit=crop
- farmer/worker: https://images.unsplash.com/photo-1589923188900-85dae523342b?q=80&w=800&auto=format&fit=crop
- pests/disease: https://images.unsplash.com/photo-1471193945509-9ad0617afabf?q=80&w=800&auto=format&fit=crop
- harvest: https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?q=80&w=800&auto=format&fit=crop
- tractor/machinery: https://images.unsplash.com/photo-1586771107445-d3ca888129ff?q=80&w=800&auto=format&fit=crop
- field: https://images.unsplash.com/photo-1464226184884-fa280b87c399?q=80&w=800&auto=format&fit=crop
- livestock: https://images.unsplash.com/photo-1500595046743-cd271d694d30?q=80&w=800&auto=format&fit=crop
- landscape: https://images.unsplash.com/photo-1625246333195-78d9c38ad449?q=80&w=800&auto=format&fit=crop
- crops/farming: https://images.unsplash.com/photo-1560493676-04071c5f467b?q=80&w=800&auto=format&fit=crop
- greenhouse: https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?q=80&w=800&auto=format&fit=crop
- weather/sky: https://images.unsplash.com/photo-1499529112087-3cb3b73cec95?q=80&w=800&auto=format&fit=crop
- seeds/planting: https://images.unsplash.com/photo-1416879595882-3373a0480b5b?q=80&w=800&auto=format&fit=crop
- market/produce: https://images.unsplash.com/photo-1595855759920-86582396756a?q=80&w=800&auto=format&fit=crop
- research/lab: https://images.unsplash.com/photo-1574943320219-553eb213f72d?q=80&w=800&auto=format&fit=crop

**VIDEOS (YouTube — use exact URL, choose 1 most relevant):**
- maize_farming: https://www.youtube.com/watch?v=j11x_F5S53w
- soil_health: https://www.youtube.com/watch?v=Z-wj139PXiI
- climate_smart: https://www.youtube.com/watch?v=vCn8kPzLIkY
- ipm: https://www.youtube.com/watch?v=GkteUqsxAWw
- irrigation_methods: https://www.youtube.com/watch?v=2dXUxMqxL0w

### CRITICAL OUTPUT REQUIREMENTS:
1.  **Expert Analysis**: Detailed Markdown with multiple headers, bullets, and bold text. 
2.  **NON-NUMERIC FORMATTING**: DO NOT use numbers like "1.", "2.", "3." in your section headers or main list items. Use descriptive headers instead.
3.  **99%+ IMAGE RELEVANCE**: Only use images that EXACTLY match the agricultural context (e.g. use 'soil' for fertilizer queries, 'pests' for disease queries).
4.  **VERIFIED LINKS ONLY**: Every external link MUST be a persistent, verifiable resource. DO NOT provide links that might 404.
5.  **Visual Data JSON**: Wrapped in <visuals> tags. MUST ALWAYS include complex chart data representing agricultural values (e.g. soil texture pie chart, moisture levels area/line chart, N-P-K distribution bar chart) and rich KPI indicators (pH levels, water demands, nitrogen ratings).
6.  **MANDATORY ASSETS**: Choose 2-3 relevant images and 1 video from the library above.

JSON Schema for <visuals> block:
<visuals>
{
  "kpis": [{"label": "string", "value": "string", "status": "good|warning|critical"}],
  "charts": [{"type": "bar|line|pie|area", "title": "string", "data": [{"label": "string", "value": "number"}]}],
  "images": [{"url": "FULL_URL_FROM_LIBRARY", "caption": "string"}],
  "videos": [{"url": "FULL_YOUTUBE_URL_FROM_LIBRARY", "caption": "string"}]
}
</visuals>

Note: Providing the <visuals> block is MANDATORY. The system strictly validates all URLs and enforces image relevance.
`;


/**
 * Shared Helper to extract visuals JSON from text
 */
export function extractVisuals(text: string): any {
    try {
        const match = text.match(/<visuals>\s*([\s\S]*?)\s*<\/visuals>/i) || text.match(/```json\n([\s\S]*?)\n```/i);
        if (match && match[1]) {
            return JSON.parse(match[1].trim());
        }
        
        // Final fallback heuristic
        const lastBrace = text.lastIndexOf('}');
        const firstBrace = text.lastIndexOf('{', lastBrace);
        if (firstBrace !== -1 && lastBrace !== -1) {
            const possibleJson = text.substring(firstBrace, lastBrace + 1);
            if (possibleJson.includes('"kpis"') || possibleJson.includes('"charts"')) {
                return JSON.parse(possibleJson);
            }
        }
    } catch (e) {
        return null;
    }
    return null;
}
