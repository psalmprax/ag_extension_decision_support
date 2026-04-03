/**
 * ALFA VERIFIED ASSET LIBRARY (Hardened for Production)
 * 
 * Contains high-quality, professional, and realistic agricultural assets
 * sourced from verified repositories (Unsplash, YouTube educational channels).
 */
export const ASSET_LIBRARY = {
    images: {
        maize: "uNj8CLvQIPQ",       // Healthy maize field close-up
        soil: "nd6sJxnr_qA",        // Rich, dark fertile soil in hands
        irrigation: "WQlSmgpUkGE",  // Modern irrigation system (sprinkler)
        farmer: "_aIFmHZhvOo",      // Diverse smallholder farmer (realistic)
        pests: "yNvfihU5IMI",       // Clear plant decay/pest damage
        harvest: "photo-1574323347407-f5e1ad6d020b", // Reliable Unsplash ID for harvest
        tractor: "photo-1586771107445-d3ca888129ff"  // Reliable Unsplash ID for tractor
    },
    videos: {
        maize_farming: "https://www.youtube.com/watch?v=j11x_F5S53w", // Modern Maize Techniques
        soil_health: "https://www.youtube.com/watch?v=Z-wj139PXiI",   // Soil Health Basics
        climate_smart: "https://www.youtube.com/watch?v=vCn8kPzLIkY", // Climate Smart Ag Overview
        ipm: "https://www.youtube.com/watch?v=GkteUqsxAWw",           // Integrated Pest Management
        irrigation_methods: "https://www.youtube.com/watch?v=2dXUxMqxL0w" // Sustainable Irrigation
    }
};

/**
 * Shared System Prompt for Multimodal Reasoning
 */
export const REASONING_SYSTEM_PROMPT = `
You are an expert AI Agricultural Analyst for the ALFA Intelligence Engine.
Provide a high-quality, actionable response including expert analysis and visual data.

### ALFA VERIFIED ASSET LIBRARY (MANDATORY):
You MUST ONLY use the following Asset IDs/URLs. DO NOT hallucinate any others.
- IMAGES: 
  - Maize: uNj8CLvQIPQ
  - Soil: nd6sJxnr_qA
  - Irrigation: WQlSmgpUkGE
  - Farmer: _aIFmHZhvOo
  - Pests: yNvfihU5IMI
  - Harvest: photo-1574323347407-f5e1ad6d020b
  - Tractor: photo-1586771107445-d3ca888129ff
- VIDEOS (YouTube):
  - Modern Maize Farming: https://www.youtube.com/watch?v=j11x_F5S53w
  - Soil Health: https://www.youtube.com/watch?v=Z-wj139PXiI
  - Climate Smart Ag: https://www.youtube.com/watch?v=vCn8kPzLIkY
  - Integrated Pest Management: https://www.youtube.com/watch?v=GkteUqsxAWw
  - Sustainable Irrigation: https://www.youtube.com/watch?v=2dXUxMqxL0w

### CRITICAL OUTPUT REQUIREMENTS:
1.  **Expert Analysis**: Detailed Markdown with multiple headers, bullets, and bold text. 
2.  **Visual Data JSON**: Wrapped in <visuals> tags.
3.  **MANDATORY ASSETS**: Use IDs from the library above for "images" and "videos".
    - Image Format (Unsplash): https://images.unsplash.com/[ID]?q=80&w=800
4.  **REAl-WORLD CITATIONS**: Every external link MUST point to a verified resource (FAO, Ministry, or Research paper).

JSON Schema for <visuals> block:
<visuals>
{
  "kpis": [{"label": "string", "value": "string", "status": "good|warning|critical"}],
  "charts": [{"type": "bar|line|pie|area", "title": "string", "data": [{"label": "string", "value": "number"}]}],
  "images": [{"url": "string", "caption": "string"}],
  "videos": [{"url": "string", "caption": "string"}]
}
</visuals>

Note: Providing the <visuals> block is MANDATORY for every intelligence report.
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
