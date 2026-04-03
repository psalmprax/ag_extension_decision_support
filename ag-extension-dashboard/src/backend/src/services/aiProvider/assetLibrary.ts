/**
 * ALFA VERIFIED ASSET LIBRARY (Hardened for Production)
 * 
 * Contains high-quality, professional, and realistic agricultural assets.
 * All image URLs are COMPLETE, DIRECTLY-LOADABLE URLs — no construction needed.
 * All video URLs are verified working YouTube links.
 */
export const ASSET_LIBRARY = {
    images: {
        maize: "https://images.unsplash.com/photo-1601615553042-3ebd28de20b2?q=80&w=800&auto=format&fit=crop",
        soil: "https://images.unsplash.com/photo-1615811361523-6bd03d7748e7?q=80&w=800&auto=format&fit=crop",
        irrigation: "https://images.unsplash.com/photo-1622383563227-04401ab4e5ea?q=80&w=800&auto=format&fit=crop",
        farmer: "https://images.unsplash.com/photo-1589923188900-85dae523342b?q=80&w=800&auto=format&fit=crop",
        pests: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?q=80&w=800&auto=format&fit=crop",
        harvest: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?q=80&w=800&auto=format&fit=crop",
        tractor: "https://images.unsplash.com/photo-1586771107445-d3ca888129ff?q=80&w=800&auto=format&fit=crop",
        greenhouse: "https://images.unsplash.com/photo-1585500671313-5a30875f73f6?q=80&w=800&auto=format&fit=crop",
        livestock: "https://images.unsplash.com/photo-1500595046743-cd271d694d30?q=80&w=800&auto=format&fit=crop"
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

### ALFA VERIFIED ASSET LIBRARY (MANDATORY):
You MUST ONLY use the EXACT URLs below. DO NOT modify, shorten, or construct new URLs.
COPY-PASTE these URLs exactly as shown.

**IMAGES (use the FULL URL exactly as written):**
- Maize/Corn: https://images.unsplash.com/photo-1601615553042-3ebd28de20b2?q=80&w=800&auto=format&fit=crop
- Soil/Earth: https://images.unsplash.com/photo-1615811361523-6bd03d7748e7?q=80&w=800&auto=format&fit=crop
- Irrigation/Water: https://images.unsplash.com/photo-1622383563227-04401ab4e5ea?q=80&w=800&auto=format&fit=crop
- Farmer/Worker: https://images.unsplash.com/photo-1589923188900-85dae523342b?q=80&w=800&auto=format&fit=crop
- Pests/Disease: https://images.unsplash.com/photo-1558618666-fcd25c85f82e?q=80&w=800&auto=format&fit=crop
- Harvest: https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?q=80&w=800&auto=format&fit=crop
- Tractor/Machinery: https://images.unsplash.com/photo-1586771107445-d3ca888129ff?q=80&w=800&auto=format&fit=crop
- Greenhouse: https://images.unsplash.com/photo-1585500671313-5a30875f73f6?q=80&w=800&auto=format&fit=crop
- Livestock: https://images.unsplash.com/photo-1500595046743-cd271d694d30?q=80&w=800&auto=format&fit=crop

**VIDEOS (YouTube — use exact URL):**
- Modern Maize Farming: https://www.youtube.com/watch?v=j11x_F5S53w
- Soil Health Basics: https://www.youtube.com/watch?v=Z-wj139PXiI
- Climate Smart Agriculture: https://www.youtube.com/watch?v=vCn8kPzLIkY
- Integrated Pest Management: https://www.youtube.com/watch?v=GkteUqsxAWw
- Sustainable Irrigation: https://www.youtube.com/watch?v=2dXUxMqxL0w

### CRITICAL OUTPUT REQUIREMENTS:
1.  **Expert Analysis**: Detailed Markdown with multiple headers, bullets, and bold text.
2.  **Visual Data JSON**: Wrapped in <visuals> tags.
3.  **MANDATORY ASSETS**: Choose 2-3 relevant images and 1 video from the library above. Use the FULL URL exactly as listed.
4.  **REAL-WORLD CITATIONS**: Every external link MUST point to a verified resource (FAO, Ministry, or Research paper).

JSON Schema for <visuals> block:
<visuals>
{
  "kpis": [{"label": "string", "value": "string", "status": "good|warning|critical"}],
  "charts": [{"type": "bar|line|pie|area", "title": "string", "data": [{"label": "string", "value": "number"}]}],
  "images": [{"url": "FULL_URL_FROM_LIBRARY", "caption": "string"}],
  "videos": [{"url": "FULL_YOUTUBE_URL_FROM_LIBRARY", "caption": "string"}]
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
