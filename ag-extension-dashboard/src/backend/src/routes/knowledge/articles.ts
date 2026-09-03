import { Router, Request, Response } from 'express';
import { KnowledgeService } from '@/services/knowledgeService';
import { getPool, query } from '@/services/databaseService';
import type {
  KnowledgeArticleRow,
  KnowledgeArticleForVector,
} from '@/types/rowTypes';
import {
  mapKnowledgeArticleRow,
} from '@/types/dtos';
import { getPrisma } from '@/services/prismaService';
import { logger } from '@/utils/logger';
import { authorize, UserRole } from '@/middleware/authorize';
import { VectorService } from '@/services/vectorService';
import { safeError } from '@/utils/safeResponse';

const router = Router();
const knowledgeAdminRoles: UserRole[] = ['admin', 'regional_manager', 'extension_officer'];

function sanitizeKnowledgeContent(content: string, contentType: string): string {
    if (contentType !== 'html') return content;
    return content
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
        .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '')
        .replace(/<embed[^>]*>[\s\S]*?<\/embed>/gi, '')
        .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, '$1="#"');
}

const errorStatusMap: Record<string, number> = {
    'ARTICLE_NOT_FOUND': 404,
    'SEARCH_FAILED': 500,
    'USER_NOT_AUTHENTICATED': 401,
    'REORDER_FAILED': 400
};

async function upsertVector(article: KnowledgeArticleForVector): Promise<void> {
    await VectorService.upsertDocument(article.id, article.content, {
        title: article.title,
        category: article.category,
        tags: article.tags,
        crops: article.crops,
        regions: article.regions,
        source: article.source,
        sourceUrl: article.sourceUrl,
        contentType: article.contentType
    });
}

// Static seed articles used only when the live knowledge corpus is unavailable.
export const seedKnowledgeArticlesData = [
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb01',
        title: 'Maize Disease Management',
        content: 'Common maize diseases include Northern leaf blight, Southern rust, and Grey leaf spot. Prevention strategies include crop rotation, using resistant varieties, and proper plant spacing. For Northern leaf blight, apply fungicides at the first sign of symptoms.',
        category: 'Crop Management',
        tags: ['maize', 'diseases', 'prevention'],
        crop: 'maize',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb02',
        title: 'Soil Fertility Management',
        content: 'Regular soil testing helps determine nutrient requirements. Organic matter addition through compost or manure improves soil structure and water retention. Apply nitrogen in split doses for optimal uptake.',
        category: 'Soil Health',
        tags: ['soil', 'fertility', 'organic'],
        crop: 'all',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb03',
        title: 'Climate-Smart Agriculture',
        content: 'Climate-smart agriculture practices include conservation agriculture, agroforestry, and water harvesting techniques. These methods help adapt to changing weather patterns while reducing greenhouse gas emissions.',
        category: 'Climate',
        tags: ['climate', 'weather', 'adaptation'],
        crop: 'all',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb04',
        title: 'Pest Control in Vegetables',
        content: 'Integrated Pest Management (IPM) combines biological, cultural, and chemical methods. Common vegetable pests include aphids, whiteflies, and fruit borers. Use neem oil for organic control.',
        category: 'Pest Management',
        tags: ['pests', 'vegetables', 'IPM'],
        crop: 'vegetables',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb05',
        title: 'Post-Harvest Handling',
        content: 'Proper post-harvest practices include timely harvesting, appropriate storage conditions, and processing techniques. Store produce at cool temperatures when possible. Use proper packaging to prevent damage.',
        category: 'Post-Harvest',
        tags: ['harvest', 'storage', 'processing'],
        crop: 'all',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb06',
        title: 'Cassava Crop Management & Irrigation',
        content: 'Cassava (Manihot esculenta) is a staple tropical root crop. Soil Diagnostics: Grows best in deep, well-drained sandy loam or silt loam soils with a pH of 5.5 to 6.5. Highly sensitive to waterlogging. Irrigation Guidelines: Evapotranspiration demand is 3-4mm/day. Requires moderate but consistent watering (about 250mm to 350mm total) during the first 3 months (tuber initiation phase) for maximum starch build-up. Once established, cassava is extremely drought-tolerant and can survive 4-6 months with minimal moisture, although yields will be reduced. Drip irrigation emitters should be placed 30cm from the stem base, delivering 2 liters/hour in 1-hour cycles twice per week during dry spells.',
        category: 'Crop Management',
        tags: ['cassava', 'irrigation', 'soil', 'tropics'],
        crop: 'cassava',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb07',
        title: 'Yam Cultivation & Staking',
        content: 'Yam (Dioscorea spp.) cultivation requires rich, loose, deep soils (such as clay loam or alluvial silt loam) with a high concentration of organic compost and a pH range of 5.5 to 6.5. Yam tubers require active staking (height 2-3 meters) to maximize sunlight interception. Water Requirements: Yams are water-intensive, requiring 1200mm to 1500mm of water distributed evenly over their 7-8 month growing cycle. Starch accumulation occurs during the bulking stage (4-6 months after planting), where a moisture deficit can drop yields by up to 60%. Drip irrigation must maintain soil moisture above 60% field capacity.',
        category: 'Soil & Water',
        tags: ['yam', 'staking', 'organic', 'tropics'],
        crop: 'yam',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb08',
        title: 'Cocoa Tree Agronomy & Shade Control',
        content: 'Cocoa (Theobroma cacao) is a delicate tropical tree requiring highly structured clay-loam soils with a pH of 5.0 to 7.5 and a minimum soil depth of 1.5 meters. Soil Diagnostics: High levels of calcium, potassium, and magnesium are critical. Evapotranspiration is 4-5mm/day. Irrigation: Cocoa requires 1500mm to 2000mm of rain or micro-sprinkler irrigation annually. Avoid heavy sprinkler watering on leaves to prevent Black Pod Disease (Phytophthora megakarya). Shade management: Cocoa seedlings need 50% shade cover, reducing to 30% for mature trees. Pruning should be completed at the start of the dry season to improve ventilation and reduce pest habitats.',
        category: 'Pest & Crop Management',
        tags: ['cocoa', 'shade', 'black pod', 'tropics'],
        crop: 'cocoa',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb09',
        title: 'Coffee Agronomy (Arabica vs Robusta)',
        content: 'Coffee (Coffea arabica & Coffea canephora/robusta) grows best in deep, acidic volcanic soils (Ferralsols, Nitisols) with a pH of 5.0 to 6.0. Arabica prefers higher altitudes (1000-2000m) and cooler climates, whereas Robusta thrives in warmer, lower elevation zones. Nutrition Diagnostics: High nitrogen (N) and potassium (K) are required. Apply NPK 15-15-15 in split applications during the rainy seasons. Irrigation: Drip irrigation delivering 15-20 liters per tree weekly during dry flowering periods stabilizes berry size and prevents fruit drop. Maintain strict pruning rules (single-stem vs multi-stem systems) to optimize yields.',
        category: 'Crop Management',
        tags: ['coffee', 'arabica', 'robusta', 'pruning', 'fertilizer'],
        crop: 'coffee',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb10',
        title: 'Rice Cultivation and Water Submergence Systems',
        content: 'Rice (Oryza sativa) requires heavy, poorly drained clay or clay-loam soils to retain a standing water layer (flooding depth of 5cm to 10cm). Soil pH should ideally range from 6.0 to 7.0. Water Management: Traditional lowland rice requires continuous submergence from transplanting until 2 weeks before harvest. Alternate Wetting and Drying (AWD) is an advanced water-saving irrigation method where the field is allowed to dry until the water table drops to 15cm below the soil surface before re-flooding, reducing water consumption by up to 30% without yield loss.',
        category: 'Water Management',
        tags: ['rice', 'awd', 'flooding', 'water conservation'],
        crop: 'rice',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb11',
        title: 'Plantain & Banana Nutrient Management',
        content: 'Plantain and Banana (Musa spp.) require fertile, deep, well-aerated soils (volcanic or alluvial loams) with high organic matter, excellent drainage, and a pH between 5.5 and 7.0. Water requirements are extremely high (100-150mm per month). Moisture stress triggers immediate leaf yellowing, reduced bunch weight, and long fruit-filling times. Fertilization: Heavy potassium feeding is vital for bunch formation. Apply nitrogen (urea) and potassium (muriate of potash) monthly. Drip irrigation systems should use dual lateral lines on either side of the plant row to cover the dense feeder root zone.',
        category: 'Soil & Water',
        tags: ['plantain', 'banana', 'potassium', 'fertilizer'],
        crop: 'plantain',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb12',
        title: 'Sandy Loam Soil Diagnostics & Aeration',
        content: 'Sandy Loam soil consists of 60% sand, 20% silt, and 20% clay. Diagnostics: Excellent aeration and drainage but extremely low nutrient holding capacity (Cation Exchange Capacity of 5-15 meq/100g) and low water retention. Water management: Requires frequent, low-volume irrigation (micro-drip cycles of 20-30 minutes daily) to prevent nutrient leaching. Soil improvement: Incorporate green manures, cover crops, and mature organic compost (at least 10 tons per hectare annually) to increase soil carbon and water retention.',
        category: 'Soil Health',
        tags: ['soil', 'sandy loam', 'compost', 'aeration'],
        crop: 'all',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb13',
        title: 'Clay Loam Soil Management & Drainage',
        content: 'Clay Loam soil consists of 30-40% clay, 20-40% sand, and 20-40% silt. Diagnostics: High nutrient retention capacity (CEC of 20-30 meq/100g) but prone to compaction, slow drainage, and waterlogging. Management: Perform subsoiling or deep ripping to break up hardpans. Add gypsum (calcium sulfate) at 2-5 tons/hectare to improve structure and promote flocculation of clay particles. Irrigation: Sprinkler or drip systems must use low application rates (less than 10mm/hour) to prevent runoff and ponding.',
        category: 'Soil Health',
        tags: ['soil', 'clay loam', 'drainage', 'compaction'],
        crop: 'all',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb14',
        title: 'Acidic Volcanic Soils (Ferralsols & Acrisols)',
        content: 'Acidic volcanic soils, common in high-altitude tropical zones, suffer from intense leaching and phosphorus (P) fixation (phosphorus binds tightly to iron and aluminum oxides, making it unavailable to plants). Diagnostics: pH levels are often below 5.0. Lime requirements: Apply agricultural lime (calcium carbonate) or dolomite to raise pH above 5.5, which unlocks bound phosphorus. Fertilizer guidelines: Apply rock phosphate or triple superphosphate (TSP) in banded rows directly next to plant roots to minimize soil contact and fixation.',
        category: 'Soil Health',
        tags: ['soil', 'acidic', 'lime', 'volcanic', 'phosphorus'],
        crop: 'all',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb15',
        title: 'Precision Irrigation Calculations',
        content: 'Effective crop irrigation requires calculating the daily water requirement using the equation: ETc = ETo x Kc. ETc is the crop evapotranspiration, ETo is the reference evapotranspiration (based on local temperature, solar radiation, wind, and humidity), and Kc is the crop coefficient (which varies by growth stage). For example, Maize has a Kc of 0.4 at emergence, rising to 1.15 during tasseling/silking, and dropping to 0.5 at maturity. During tasseling in a dry region with an ETo of 5mm/day, the crop requires: 5 x 1.15 = 5.75mm of water daily.',
        category: 'Water Management',
        tags: ['irrigation', 'math', 'evapotranspiration', 'kc'],
        crop: 'all',
    },
    // Extended seed articles for broader knowledge coverage
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb16',
        title: 'Livestock-Crop Integration for Smallholders',
        content: 'Integrating livestock with crops creates nutrient cycles: manure fertilizes crops, crop residues feed animals. Poultry manure provides 1-2% N, 1-2% P, 1% K. For a 1-hectare maize plot, 5-10 tons of composted poultry manure per season replaces mineral fertilizer. Use chicken tractors to rotate birds through fallow fields. Zero-grazing dairy units (3-5 cows) on 1 hectare of napier grass can produce 15-20 liters milk/day while providing 10-15 tons manure/year for adjacent vegetable plots.',
        category: 'Integrated Farming',
        tags: ['livestock', 'manure', 'nutrient cycling', 'smallholder'],
        crop: 'all',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb17',
        title: 'Agroforestry Systems for Climate Resilience',
        content: 'Agroforestry combines trees with crops/livestock. Alley cropping: plant rows of Gliricidia sepium or Leucaena leucocephala (4m apart) with maize/beans between rows. Trees fix 100-200 kg N/ha/year via leaf litter, reducing fertilizer needs by 30-50%. Multistrata systems (cocoa + banana + timber + medicinal plants) yield 3-5x more per hectare than monoculture. Windbreaks (Casuarina, Grevillea) reduce evapotranspiration by 15-20% downwind.',
        category: 'Agroforestry',
        tags: ['trees', 'nitrogen fixation', 'biodiversity', 'carbon'],
        crop: 'all',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb18',
        title: 'Market Access & Value Chain Development',
        content: 'Smallholder market linkage requires: (1) Collective marketing through farmer groups/cooperatives to achieve volume for bulk buyers; (2) Contract farming agreements specifying price, quality, and delivery terms with processors/exporters; (3) Market information systems (SMS/WhatsApp) providing daily wholesale prices; (4) Post-harvest infrastructure (collection centers, cold rooms, drying platforms) to reduce losses. Digital platforms (Twiga, Mkulima Young) connect farmers directly to urban retailers, cutting 3-4 intermediaries and increasing farm-gate price by 20-40%.',
        category: 'Market Access',
        tags: ['market', 'value chain', 'cooperatives', 'digital'],
        crop: 'all',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb19',
        title: 'Post-Harvest Technology & Food Loss Reduction',
        content: 'Sub-Saharan Africa loses 30-50% of food post-harvest. Technologies: (1) Hermetic storage bags (PICS bags) for grains kill insects without chemicals, store 9+ months; (2) Solar dryers (cabinet or tunnel) reduce moisture to 12-14% for fruits/vegetables in 1-2 days; (4) Cold rooms (10-15°C, 85-95% RH) extend shelf life of tomatoes/leafy greens by 2-3 weeks; (5) Mobile processing units (cassava chippers, maize shellers) reduce transport costs. Investment of $500-1000 in village-level drying/storage cuts losses by 60-80%.',
        category: 'Post-Harvest',
        tags: ['storage', 'drying', 'cold chain', 'food loss'],
        crop: 'all',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb20',
        title: 'Digital Agriculture & Advisory Services',
        content: 'Digital tools for extension: (1) USSD/SMS platforms (e.g., iCow, M-Farm) deliver weather, prices, and agronomic tips to feature phones; (2) Smartphone apps (PlantVillage, Crop Doctor) use AI vision for disease ID; (3) IoT sensors (soil moisture, weather stations) feed data to dashboards; (4) Drone imagery (NDVI) maps crop stress at 5cm resolution; (5) Blockchain traceability (Farmer Connect, Provenance) verifies organic/fair-trade claims. Key barrier: digital literacy training for women and youth extension officers.',
        category: 'Digital Agriculture',
        tags: ['digital', 'AI', 'IoT', 'extension', 'blockchain'],
        crop: 'all',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb21',
        title: 'Gender-Responsive Agricultural Extension',
        content: 'Women produce 60-80% of food in SSA but access 10-20% of extension services. Gender-responsive design: (1) Train female extension agents (target 40-50%); (2) Schedule meetings at times/locations accessible to women; (3) Address women-specific crops (vegetables, legumes) and constraints (land tenure, credit); (4) Use women groups (savings, seed, processing) as entry points; (5) Collect sex-disaggregated data. Projects with gender lens show 20-30% higher adoption of improved varieties and soil practices.',
        category: 'Social Equity',
        tags: ['gender', 'women', 'extension', 'adoption'],
        crop: 'all',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb22',
        title: 'Youth Engagement in Agriculture & Agripreneurship',
        content: 'Average farmer age in Africa is 60. Youth strategies: (1) Incubators for agri-tech startups (precision farming, logistics, processing); (2) Access to land via youth land banks or lease-to-own models; (3) Blended finance (grants + loans) for mechanization services (tractor hire, drone spraying); (4) Curriculum reform: agribusiness modules in TVET/universities; (5) Digital platforms for market access (Twiga, Apollo Agriculture). Successful youth agripreneurs earn 2-3x average rural income and create jobs for 5-10 peers.',
        category: 'Youth & Employment',
        tags: ['youth', 'agripreneurship', 'mechanization', 'finance'],
        crop: 'all',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb23',
        title: 'Climate Finance for Smallholder Adaptation',
        content: 'Climate funds accessible to smallholders: (1) Green Climate Fund (GCF) - readiness grants for NAPs, project funding up to $50M; (2) Adaptation Fund - concrete adaptation projects; (3) GEF Small Grants Programme - up to $50K for community projects; (4) Carbon credits: soil carbon (1-3 tCO2/ha/yr via conservation ag) sold at $10-30/tCO2 via Verra/Gold Standard; (5) Weather-index insurance (ACRE Africa, Pula) pays out automatically when satellite rainfall index triggers. Bundling credit + insurance + inputs de-risks lending.',
        category: 'Climate Finance',
        tags: ['climate finance', 'carbon', 'insurance', 'GCF'],
        crop: 'all',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb24',
        title: 'Soil Organic Carbon Sequestration & MRV',
        content: 'Conservation agriculture (no-till + cover crops + rotation) sequesters 0.5-2 tC/ha/yr. Measurement: (1) Direct soil sampling (0-30cm, bulk density, %C via dry combustion); (2) Satellite proxies (NDVI, soil moisture); (3) Models (RothC, Century) calibrated to local data. MRV standards: IPCC Tier 2 (country-specific emission factors) or Tier 3 (process models). Carbon credit prices: $15-30/tCO2 for agriculture. Co-benefits: +10-20% yield, -30% fertilizer use, drought resilience.',
        category: 'Soil Carbon',
        tags: ['carbon', 'MRV', 'conservation agriculture', 'climate'],
        crop: 'all',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb25',
        title: 'Biochar Production & Soil Application',
        content: 'Biochar: pyrolysis of crop residues (corn cobs, rice husks, wood) at 400-600°C with limited oxygen. Properties: 70-90% C, high surface area (100-400 m2/g), pH 8-10, CEC 20-50 cmol/kg. Application: 5-20 t/ha incorporated into topsoil. Benefits: +15-30% water retention, +10-20% crop yield (especially in acidic/sandy soils), -20-50% N2O emissions, long-term C sequestration (100-1000 yr). Small-scale production: Kon-Tiki kiln (100-500 kg/batch) or TLUD stove for household use.',
        category: 'Soil Amendments',
        tags: ['biochar', 'pyrolysis', 'carbon', 'soil health'],
        crop: 'all',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb26',
        title: 'Composting & Vermiculture for Soil Fertility',
        content: 'Composting: mix C-rich (straw, leaves, maize stover C:N 50-80:1) and N-rich (manure, kitchen waste, legume residues C:N 15-25:1) materials to achieve initial C:N of 25-30:1. Turn every 3-5 days; ready in 6-8 weeks (dark, crumbly, earthy smell). Vermiculture: Eisenia fetida worms process 0.5-1 kg waste/kg worms/day. Vermicast contains 1-2% N, 1-2% P, 1-2% K, humic acids, and beneficial microbes. Application: 2-5 t/ha compost or 1-2 t/ha vermicast as basal dressing.',
        category: 'Soil Amendments',
        tags: ['compost', 'vermicompost', 'organic', 'nutrients'],
        crop: 'all',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb27',
        title: 'Green Manure & Cover Cropping Systems',
        content: 'Green manures: legumes grown for soil improvement, incorporated before flowering. Top species: (1) Mucuna pruriens (velvet bean) - 150-250 kg N/ha, suppresses weeds; (2) Crotalaria juncea (sunn hemp) - 100-150 kg N/ha, nematode suppression; (3) Sesbania sesban - 80-120 kg N/ha, fast-growing tree legume; (4) Vigna unguiculata (cowpea) - 50-80 kg N/ha, dual-purpose food/cover. Cover crops: off-season planting (oats, rye, radish) prevents erosion, scavenges residual N, breaks pest cycles. Terminate 2-3 weeks before main crop planting.',
        category: 'Soil Health',
        tags: ['cover crops', 'green manure', 'nitrogen', 'erosion'],
        crop: 'all',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb28',
        title: 'Crop Insurance & Index-Based Risk Management',
        content: 'Index insurance pays out based on weather/satellite triggers, not individual loss assessment. Products: (1) Area Yield Index Insurance (AYII) - uses historical district yields; (2) Weather Index Insurance (WII) - rainfall/temperature thresholds from satellite/station data; (3) Satellite Yield Index - NDVI-based anomaly detection. Key players: ACRE Africa (Kenya/Rwanda/Tanzania), Pula (Nigeria/Ghana/Zambia), OKO (Mali/Uganda). Bundling: input packages (seeds + fertilizer) + insurance + extension = 30-50% higher adoption. Payouts automated via mobile money within 48h of trigger.',
        category: 'Risk Management',
        tags: ['insurance', 'index', 'weather', 'satellite', 'mobile money'],
        crop: 'all',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb29',
        title: 'Integrated Striga (Witchweed) Management',
        content: 'Striga hermonthica parasitizes maize, sorghum, millet causing 30-100% yield loss. Integrated control: (1) Resistant/tolerant varieties (IR-maize, ICSV sorghum); (2) Trap crops: Desmodium (push-pull), cotton, sunflower induce suicidal germination; (3) Catch crops: Striga-resistant sorghum varieties stimulate germination without attachment; (4) N fertilization reduces Striga emergence; (4) Hand-pulling before seed set; (5) Imazapyr-resistant (IR) maize seed coating (StrigAway®) allows herbicide control. Push-pull (Desmodium intercrop + Napier border) reduces Striga by 80% and stemborer by 70%.',
        category: 'Pest Management',
        tags: ['striga', 'push-pull', 'parasitic weed', 'maize'],
        crop: 'maize',
    },
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb30',
        title: 'Fall Armyworm (FAW) IPM & Biocontrol',
        content: 'Spodoptera frugiperda invaded Africa 2016, now in 40+ countries. IPM strategy: (1) Monitoring: pheromone traps (1 trap/ha), scout 10 plants/plot weekly; (2) Action threshold: 3+ egg masses or 20% infested plants with early instar larvae; (3) Biocontrol: release Telenomus remus (egg parasitoid) 50,000/ha, Cotesia icipe (larval parasitoid); (4) Botanicals: neem oil (azadirachtin 1-3%) every 7-10 days, Bacillus thuringiensis (Bt) formulations; (5) Chemical (last resort): emamectin benzoate, spinetoram - rotate MoA classes; (6) Resistant varieties: FAW-tolerant maize hybrids (e.g., WE2121, WE3131). Early planting avoids peak moth flights.',
        category: 'Pest Management',
        tags: ['fall armyworm', 'IPM', 'biocontrol', 'maize'],
        crop: 'maize',
    },
];

// Seed knowledge articles into database
export async function seedKnowledgeArticles(): Promise<void> {
    const pool = getPool();
    if (!pool) return;

    const articles = seedKnowledgeArticlesData.map(art => ({
        id: art.id,
        title: art.title,
        content: art.content,
        category: art.category,
        tags: art.tags,
        crops: [art.crop],
        regions: art.crop === 'maize' ? ['East Africa'] : ['tropical'],
        source: 'AG Extension Tropical Agronomy Seed'
    }));

    try {
        logger.info(`Upserting ${articles.length} standard seed articles to database`);
        await query(`
            DELETE FROM knowledge_articles
            WHERE id <> ALL($1::uuid[])
              AND title = ANY($2::text[])
              AND source IS NULL
              AND embedding IS NULL
        `, [articles.map(article => article.id), articles.map(article => article.title)]);

        for (const article of articles) {
            await query(`
                INSERT INTO knowledge_articles (id, title, content, category, tags, crops, regions, source, content_type)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'text')
                ON CONFLICT (id) DO UPDATE SET
                    title = EXCLUDED.title,
                    content = EXCLUDED.content,
                    category = EXCLUDED.category,
                    tags = EXCLUDED.tags,
                    crops = EXCLUDED.crops,
                    regions = EXCLUDED.regions,
                    source = EXCLUDED.source,
                    content_type = EXCLUDED.content_type,
                    updated_at = NOW()
            `, [article.id, article.title, article.content, article.category, article.tags, article.crops, article.regions, article.source]);
        }
        logger.info('Knowledge articles upserted successfully');
    } catch (error) {
        logger.error('Error seeding knowledge articles:', error);
    }
}

// Get recent search history
router.get('/history', async (req: Request, res: Response) => {
    try {
        const user = (req as Request & { user?: Record<string, unknown> }).user;
        const userId = (user?.userId || user?.id) as string | undefined;
        if (!userId) {
            return res.status(errorStatusMap['USER_NOT_AUTHENTICATED']).json({
                success: false,
                errorCode: 'USER_NOT_AUTHENTICATED',
                error: 'User not authenticated'
            });
        }
        const history = await KnowledgeService.getSearchHistory(userId);
        res.json({ success: true, data: history });
    } catch (error) {
        logger.error('Get search history error:', error);
        safeError(res, 500, 'Failed to get search history');
    }
});

// Get search statistics
router.get('/stats', async (_req: Request, res: Response) => {
    try {
        const stats = await KnowledgeService.getSearchStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        logger.error('Get search stats error:', error);
        safeError(res, 500, 'Failed to get search statistics');
    }
});

// Get article by ID
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const pool = getPool();
        let article: KnowledgeArticleRow | null = null;
        if (pool) {
            const result = await query<KnowledgeArticleRow>('SELECT * FROM knowledge_articles WHERE id = $1', [id]);
            article = result.rows[0] ?? null;
        }
        if (!article) {
            return res.status(errorStatusMap['ARTICLE_NOT_FOUND']).json({
                success: false,
                errorCode: 'ARTICLE_NOT_FOUND',
                error: 'Article not found'
            });
        }
        res.json({ success: true, data: mapKnowledgeArticleRow(article) });
    } catch (error) {
        logger.error('Get article error:', error);
        safeError(res, 500, 'Failed to get article');
    }
});

// Reorder knowledge articles
router.post('/reorder', authorize(knowledgeAdminRoles), async (req: Request, res: Response) => {
    try {
        const { items } = req.body;
        const prisma = getPrisma();

        if (!items || !Array.isArray(items)) {
            return res.status(400).json({
                success: false,
                error: 'Items array is required',
            });
        }

        for (const item of items) {
            if (!item.id || typeof item.order !== 'number') {
                return res.status(400).json({
                    success: false,
                    error: 'Each item must have id and order',
                });
            }
        }

        const articleIds = items.map(item => item.id);
        const articles = await prisma.knowledgeArticle.findMany({
            where: { id: { in: articleIds } },
            select: { id: true }
        });

        if (articles.length !== items.length) {
            return res.status(400).json({
                success: false,
                error: 'Some articles not found',
            });
        }

        await prisma.$transaction(
            items.map(item =>
                prisma.knowledgeArticle.update({
                    where: { id: item.id },
                    data: { order: item.order }
                })
            )
        );

        res.json({ success: true, message: 'Articles reordered successfully' });
    } catch (error) {
        logger.error('Reorder articles error:', error);
        safeError(res, 500, 'Failed to reorder articles');
    }
});

// Create a new knowledge article
router.post('/', authorize(knowledgeAdminRoles), async (req: Request, res: Response) => {
    try {
        const {
            title, content, contentType = 'text', summary, category,
            tags = [], crops = [], regions = [], source, sourceUrl
        } = req.body;
        const prisma = getPrisma();

        if (!title || !content) {
            return res.status(400).json({
                success: false,
                error: 'Title and content are required',
            });
        }

        if (!['text', 'html'].includes(contentType)) {
            return res.status(400).json({
                success: false,
                error: 'contentType must be either "text" or "html"',
            });
        }

        const sanitizedContent = sanitizeKnowledgeContent(content, contentType);

        const article = await prisma.knowledgeArticle.create({
            data: {
                title,
                content: sanitizedContent,
                contentType,
                summary,
                category,
                tags,
                crops,
                regions,
                source,
                sourceUrl,
            },
        });

        await upsertVector(article);

        res.status(201).json({
            success: true,
            data: article,
        });
    } catch (error) {
        logger.error('Create article error:', error);
        safeError(res, 500, 'Failed to create article');
    }
});

async function processUpdateArticle(req: Request, res: Response) {
    const { id } = req.params;
    const {
        title, content, contentType, summary, category,
        tags, crops, regions, source, sourceUrl
    } = req.body;
    const prisma = getPrisma();

    const existingArticle = await prisma.knowledgeArticle.findUnique({
        where: { id }
    });

    if (!existingArticle) {
        return res.status(404).json({
            success: false,
            error: 'Article not found',
        });
    }

    if (contentType && !['text', 'html'].includes(contentType)) {
        return res.status(400).json({
            success: false,
            error: 'contentType must be either "text" or "html"',
        });
    }

    const sanitizedContent = content === undefined ? undefined : sanitizeKnowledgeContent(content, contentType || existingArticle.contentType || 'text');

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = sanitizedContent;
    if (contentType !== undefined) updateData.contentType = contentType;
    if (summary !== undefined) updateData.summary = summary;
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) updateData.tags = tags;
    if (crops !== undefined) updateData.crops = crops;
    if (regions !== undefined) updateData.regions = regions;
    if (source !== undefined) updateData.source = source;
    if (sourceUrl !== undefined) updateData.sourceUrl = sourceUrl;
    updateData.updatedAt = new Date();

    const article = await prisma.knowledgeArticle.update({
        where: { id },
        data: updateData,
    });

    await upsertVector(article);

    return res.json({ success: true, data: article });
}

// Update a knowledge article
router.put('/:id', authorize(knowledgeAdminRoles), async (req: Request, res: Response) => {
    try {
        await processUpdateArticle(req, res);
    } catch (error) {
        logger.error('Update article error:', error);
        safeError(res, 500, 'Failed to update article');
    }
});

export default router;
