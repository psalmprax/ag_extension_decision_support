import { VectorService } from '@/services/vectorService';
import { logger } from '@/utils/logger';

export type KnowledgeSourceType = 'static_library' | 'dynamic_api' | 'external_reference';

export interface TropicalKnowledgeSource {
    id: string;
    name: string;
    provider: string;
    type: KnowledgeSourceType;
    license: string;
    url: string;
    syncMode: 'article_sync' | 'live_context' | 'admin_review';
    topics: string[];
    crops: string[];
    regions: string[];
    description: string;
    priority: 'high' | 'medium' | 'low';
}

export interface TropicalKnowledgeArticleSeed {
    id: string;
    title: string;
    content: string;
    category: string;
    tags: string[];
    crops: string[];
    regions: string[];
    source: string;
    sourceUrl: string;
}

export const tropicalKnowledgeSources: TropicalKnowledgeSource[] = [
    {
        id: 'fao-crop-guides',
        name: 'FAO crop, soil, water and post-harvest guidance',
        provider: 'FAO',
        type: 'static_library',
        license: 'Open public FAO publications; verify publication-specific license before bulk ingest.',
        url: 'https://www.fao.org/publications/',
        syncMode: 'article_sync',
        topics: ['crop management', 'soil health', 'irrigation', 'post-harvest', 'food safety'],
        crops: ['cassava', 'rice', 'maize', 'vegetables', 'banana', 'plantain'],
        regions: ['tropical', 'Africa', 'Asia', 'Latin America'],
        description: 'Source-backed extension guidance for tropical crop production, irrigation, storage and food safety.',
        priority: 'high'
    },
    {
        id: 'cgiar-iita-root-tuber',
        name: 'CGIAR/IITA root, tuber and banana agronomy',
        provider: 'CGIAR / IITA',
        type: 'static_library',
        license: 'Open research and extension materials; verify document license before bulk ingest.',
        url: 'https://www.iita.org/',
        syncMode: 'article_sync',
        topics: ['cassava', 'yam', 'banana', 'plantain', 'disease management', 'seed systems'],
        crops: ['cassava', 'yam', 'banana', 'plantain', 'maize', 'cowpea', 'soybean'],
        regions: ['Africa', 'tropical'],
        description: 'Priority source for cassava, yam, banana/plantain and tropical disease/pest extension recommendations.',
        priority: 'high'
    },
    {
        id: 'cgiar-africarice-irri-rice',
        name: 'AfricaRice and IRRI rice knowledge',
        provider: 'CGIAR / AfricaRice / IRRI',
        type: 'static_library',
        license: 'Open research and extension materials; verify document license before bulk ingest.',
        url: 'https://www.africarice.org/',
        syncMode: 'article_sync',
        topics: ['rice', 'water management', 'alternate wetting and drying', 'rice diseases'],
        crops: ['rice'],
        regions: ['Africa', 'Asia', 'tropical'],
        description: 'Rice-specific agronomy, water management and disease references for lowland and upland systems.',
        priority: 'high'
    },
    {
        id: 'cabi-plantwise',
        name: 'CABI Plantwise pest and disease factsheets',
        provider: 'CABI Plantwise',
        type: 'external_reference',
        license: 'Check API/content licensing before bulk ingestion.',
        url: 'https://plantwiseplusknowledgebank.org/',
        syncMode: 'admin_review',
        topics: ['plant pests', 'plant diseases', 'symptoms', 'integrated pest management'],
        crops: ['cassava', 'maize', 'rice', 'banana', 'cocoa', 'coffee', 'vegetables'],
        regions: ['global tropics'],
        description: 'High-value pest/disease diagnostic content; should be reviewed before storing permanently.',
        priority: 'high'
    },
    {
        id: 'nasa-power',
        name: 'NASA POWER agroclimatology',
        provider: 'NASA POWER',
        type: 'dynamic_api',
        license: 'NASA open data.',
        url: 'https://power.larc.nasa.gov/',
        syncMode: 'live_context',
        topics: ['temperature', 'rainfall', 'solar radiation', 'soil moisture', 'evapotranspiration context'],
        crops: ['all'],
        regions: ['global'],
        description: 'Live agroclimate data for location-specific irrigation, planting and stress-risk decisions.',
        priority: 'high'
    },
    {
        id: 'chirps-rainfall',
        name: 'CHIRPS rainfall monitoring',
        provider: 'UCSB Climate Hazards Center',
        type: 'dynamic_api',
        license: 'Open climate data; verify current distribution terms.',
        url: 'https://www.chc.ucsb.edu/data/chirps',
        syncMode: 'live_context',
        topics: ['rainfall anomaly', 'drought monitoring', 'seasonal rainfall'],
        crops: ['all'],
        regions: ['Africa', 'global tropics'],
        description: 'Useful for drought and rainfall-anomaly advisories; dynamic layer rather than article corpus.',
        priority: 'medium'
    },
    {
        id: 'soilgrids-isric',
        name: 'SoilGrids / ISRIC soil properties',
        provider: 'ISRIC',
        type: 'dynamic_api',
        license: 'Open data; verify attribution requirements.',
        url: 'https://soilgrids.org/',
        syncMode: 'live_context',
        topics: ['soil pH', 'texture', 'organic carbon', 'clay', 'sand', 'silt'],
        crops: ['all'],
        regions: ['global'],
        description: 'Location-specific soil-property context for fertility, pH, liming and irrigation recommendations.',
        priority: 'high'
    },
    {
        id: 'fews-net',
        name: 'FEWS NET seasonal and food-security context',
        provider: 'FEWS NET',
        type: 'external_reference',
        license: 'Public reports; verify reuse terms.',
        url: 'https://fews.net/',
        syncMode: 'admin_review',
        topics: ['seasonal risk', 'food security', 'rainfall outlook', 'livelihood zones'],
        crops: ['all'],
        regions: ['Africa', 'Central America', 'Asia'],
        description: 'Regional risk context for advisories and planning; keep current reports as reviewed references.',
        priority: 'medium'
    }
];

export const tropicalArticleSeeds: TropicalKnowledgeArticleSeed[] = [
    {
        id: '11111111-1111-4111-8111-111111111101',
        title: 'Cassava Mosaic and Brown Streak Disease Field Guide',
        category: 'Plant Health',
        tags: ['cassava', 'mosaic disease', 'brown streak', 'clean planting material', 'whitefly'],
        crops: ['cassava'],
        regions: ['Africa', 'tropical'],
        source: 'AG Extension Tropical Library - FAO/CGIAR aligned',
        sourceUrl: 'https://www.iita.org/cropsnew/cassava/',
        content: 'Cassava mosaic disease causes distorted, mottled leaves and reduced root yield. Cassava brown streak disease causes leaf chlorosis, stem streaking and brown necrotic root rot that may only be visible at harvest. Use clean disease-free cuttings, plant tolerant varieties where available, rogue visibly infected plants early, control volunteer cassava and avoid moving cuttings from infected fields. Whitefly pressure increases virus spread; combine clean seed systems with field sanitation and resistant varieties.'
    },
    {
        id: '11111111-1111-4111-8111-111111111102',
        title: 'Fall Armyworm Integrated Management in Maize',
        category: 'Plant Health',
        tags: ['maize', 'fall armyworm', 'ipm', 'scouting', 'biocontrol'],
        crops: ['maize'],
        regions: ['Africa', 'tropical'],
        source: 'AG Extension Tropical Library - FAO/CGIAR aligned',
        sourceUrl: 'https://www.fao.org/fall-armyworm/',
        content: 'Scout maize fields from emergence through tasseling, checking the whorl for fresh windowing, frass and larvae. Prioritize early control when larvae are small. Conserve natural enemies, avoid unnecessary broad-spectrum insecticide sprays, use locally approved biopesticides or selective products when thresholds are exceeded, and rotate modes of action to reduce resistance. Good crop nutrition, timely planting and destruction of heavily infested residues reduce risk.'
    },
    {
        id: '11111111-1111-4111-8111-111111111103',
        title: 'Aflatoxin Risk Reduction for Maize and Groundnut',
        category: 'Post-Harvest',
        tags: ['aflatoxin', 'maize', 'groundnut', 'drying', 'storage'],
        crops: ['maize', 'groundnut'],
        regions: ['Africa', 'tropical'],
        source: 'AG Extension Tropical Library - FAO/CGIAR aligned',
        sourceUrl: 'https://www.fao.org/food-safety/',
        content: 'Aflatoxin risk increases with drought stress, insect damage, delayed drying and humid storage. Harvest promptly, discard moldy or damaged produce, dry grain or pods quickly to safe moisture levels, keep produce off bare soil, use clean bags or hermetic storage, and store in dry ventilated conditions. Control field insects and avoid mixing visibly contaminated lots with clean produce.'
    },
    {
        id: '11111111-1111-4111-8111-111111111104',
        title: 'Banana and Plantain Bacterial Wilt Prevention',
        category: 'Plant Health',
        tags: ['banana', 'plantain', 'bacterial wilt', 'sanitation', 'tools'],
        crops: ['banana', 'plantain'],
        regions: ['Africa', 'tropical'],
        source: 'AG Extension Tropical Library - FAO/CGIAR aligned',
        sourceUrl: 'https://www.iita.org/cropsnew/banana-plantain/',
        content: 'Banana bacterial wilt spreads through infected planting material, insects visiting male buds, contaminated tools and movement of infected plant parts. Use clean planting material, remove male buds with a forked stick where recommended, disinfect cutting tools, uproot and destroy infected mats according to local guidance, and restrict movement of infected suckers. Early symptoms include yellowing, wilting, premature ripening and bacterial ooze from cut tissues.'
    },
    {
        id: '11111111-1111-4111-8111-111111111105',
        title: 'Cocoa Black Pod and Shade Management',
        category: 'Plant Health',
        tags: ['cocoa', 'black pod', 'shade', 'pruning', 'phytophthora'],
        crops: ['cocoa'],
        regions: ['West Africa', 'tropical'],
        source: 'AG Extension Tropical Library - FAO/CGIAR aligned',
        sourceUrl: 'https://www.cgiar.org/research/program-platform/cocoa/',
        content: 'Cocoa black pod risk rises under high humidity, dense canopy and poor sanitation. Prune to improve airflow, maintain moderate shade, remove infected pods quickly, improve drainage and avoid overhead irrigation that keeps pods wet. Where locally approved, copper-based fungicides or other recommended products may be used preventively in high-risk periods. Harvest and pod sanitation are essential to reduce inoculum.'
    },
    {
        id: '11111111-1111-4111-8111-111111111106',
        title: 'Rice Alternate Wetting and Drying Water Management',
        category: 'Water Management',
        tags: ['rice', 'awd', 'irrigation', 'water saving'],
        crops: ['rice'],
        regions: ['Africa', 'Asia', 'tropical'],
        source: 'AG Extension Tropical Library - AfricaRice/IRRI aligned',
        sourceUrl: 'https://www.irri.org/alternate-wetting-and-drying-awd',
        content: 'Alternate Wetting and Drying saves irrigation water in lowland rice by allowing the field water level to fall below the soil surface before re-irrigation. Use a field water tube where possible. Avoid severe drying during flowering because drought stress at this stage reduces grain set. AWD works best on fields with good bunds and level land, and it should be adapted to local soil type and farmer water control.'
    }
];

export class TropicalKnowledgeSourceService {
    static listSources(): TropicalKnowledgeSource[] {
        return tropicalKnowledgeSources;
    }

    static listArticleSeeds(): TropicalKnowledgeArticleSeed[] {
        return tropicalArticleSeeds;
    }

    static async syncCuratedArticles(): Promise<{ synced: number; articles: Array<{ id: string; title: string; crops: string[]; source: string }> }> {
        const synced: Array<{ id: string; title: string; crops: string[]; source: string }> = [];

        for (const article of tropicalArticleSeeds) {
            await VectorService.upsertDocument(article.id, article.content, {
                title: article.title,
                category: article.category,
                tags: article.tags,
                crops: article.crops,
                regions: article.regions,
                source: article.source,
                sourceUrl: article.sourceUrl,
                contentType: 'text'
            });
            synced.push({ id: article.id, title: article.title, crops: article.crops, source: article.source });
        }

        logger.info(`Synced ${synced.length} curated tropical knowledge articles`);
        return { synced: synced.length, articles: synced };
    }
}
