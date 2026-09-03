// Research scenarios moved verbatim from components/KnowledgeBase/index.tsx (pure move).

import type { Citation } from '@/api/knowledgeService';

export type SpatialCanvasMode = 'phenology' | 'soil_heatmap' | 'pathology';

export interface ResearchScenario {
  id: string;
  title: string;
  crop: string;
  category: string;
  badge: string;
  query: string;
  canvasMode: SpatialCanvasMode | 'rag_graph';
  sampleAnswer: string;
  citations: Citation[];
}

export const RESEARCH_SCENARIOS: ResearchScenario[] = [
  {
    id: 'fall_armyworm_ipm',
    title: 'Fall Armyworm Integrated Pest Protocol',
    crop: 'Maize',
    category: 'Entomology & IPM',
    badge: 'FAO / CIMMYT IPM Protocol',
    query: 'What are the biological and low-toxicity chemical control thresholds for Fall Armyworm (Spodoptera frugiperda) in maize?',
    canvasMode: 'rag_graph',
    sampleAnswer: `### Verified Agro-RAG Synthesis: Fall Armyworm (*Spodoptera frugiperda*) IPM

**1. Action Thresholds:**
* **Whorl Stage:** Intervene when **20% of plants** show fresh leaf damage (window-paning / shot holes) with live early-instar larvae.
* **Tasseling / Silking:** Intervene immediately if **5% of plants** show larval infestation before ear penetration.

**2. Biological & Cultural Controls:**
* **Bio-Pesticides:** Apply *Bacillus thuringiensis* (Bt) kurstaki or *Beauveria bassiana* foliar spray in late afternoon to protect UV sensitivity.
* **Botanicals:** Cold-pressed Neem oil (Azadirachtin 0.03% EC at 5 ml/L water) disrupts larval molting and oviposition.
* **Parasitoid Conservation:** Encourage local *Telenomus remus* and *Trichogramma* wasp populations by avoiding broad-spectrum pyrethroids.

**3. Targeted Chemical Intervention (High Infestation):**
* Apply *Emamectin benzoate* 5% SG (0.4 g/L) or *Chlorantraniliprole* 18.5% SC (0.3 ml/L) directed into the central leaf whorl.`,
    citations: [
      {
        sourceId: 'fao-faw-2024',
        title: 'FAO Fall Armyworm Guidance Note 14',
        category: 'IPM Guidelines',
        excerpt: 'Action thresholds and biological control mechanisms for smallholder maize systems.',
        score: 0.96,
      },
      {
        sourceId: 'cimmyt-ent-88',
        title: 'CIMMYT Tropical Maize Pathology Manual v4.1',
        category: 'Entomological Studies',
        excerpt: 'Neem and Bt application protocols during early vegetative development.',
        score: 0.92,
      },
      {
        sourceId: 'kalro-crop-112',
        title: 'KALRO Push-Pull Desmodium Pest Control Bulletin',
        category: 'Agroecology',
        excerpt: 'Intercropping Desmodium uncinatum to deter oviposition and repel Spodoptera moths.',
        score: 0.89,
      },
    ],
  },
  {
    id: 'soil_acidity_liming',
    title: 'Severe Soil Acidity (pH 4.8) & Liming Protocol',
    crop: 'Multi-Crop',
    category: 'Soil Chemistry & Agronomy',
    badge: 'ISRIC SoilGrids v2 Verified',
    query: 'How to calculate agricultural lime (CaCO3) requirement for soils with pH below 5.0 and high aluminum toxicity?',
    canvasMode: 'soil_heatmap',
    sampleAnswer: `### Verified Agro-RAG Synthesis: Soil Acidity Neutralization & Aluminum Shielding

**1. Diagnostic Soil Matrix:**
* **Soil pH:** $4.8$ (Strongly Acidic, volcanic/ferralsol profile).
* **Exchangeable Aluminum:** >35% saturation, causing acute root tip necrosis and phosphorus fixation.

**2. Liming Prescription Calculation:**
* **Dosage:** Broadcast **2.5 to 3.0 tonnes/ha** of finely ground agricultural lime (CaCO3, Effective Neutralizing Value >80%).
* **Incorporation Depth:** Evenly disc into top 0–15 cm root zone at least **21 to 30 days prior to sowing**.

**3. Phosphorus Availability Restoration:**
* Apply single superphosphate (SSP) or DAP alongside well-decomposed manure ($5\text{ tonnes/ha}$) to shield phosphate ions from aluminum chelation.`,
    citations: [
      {
        sourceId: 'isric-soilgrids-2024',
        title: 'ISRIC SoilGrids v2 Global Acidity & Base Saturation Map',
        category: 'Pedology',
        excerpt: 'Exchangeable aluminum saturation dynamics in sub-Saharan African oxisols.',
        score: 0.97,
      },
      {
        sourceId: 'ifdc-lime-09',
        title: 'IFDC Smallholder Soil Amendment & Liming Field Guide',
        category: 'Soil Fertility',
        excerpt: 'Dosage equations and reaction kinetics of calcitic lime in humid tropics.',
        score: 0.94,
      },
    ],
  },
  {
    id: 'nasa_precipitation_window',
    title: 'NASA POWER Satellite Moisture & Planting Sowing Window',
    crop: 'Cassava & Cereals',
    category: 'Agroclimatology',
    badge: 'NASA POWER 14-Day Sync',
    query: 'What is the optimal planting window based on NASA POWER rainfall anomalies and soil moisture for cassava?',
    canvasMode: 'phenology',
    sampleAnswer: `### Verified Agro-RAG Synthesis: NASA POWER Agroclimatological Planting Window

**1. Climatological Window:**
* **Precipitation Trend:** 14-day cumulative rainfall forecast indicates $>45\text{ mm}$ with steady soil saturation index ($0.38\text{ m}^3/\text{m}^3$).
* **Sowing Window:** Commencing within the next **4 to 8 days** once topsoil drains to field capacity.

**2. Stem Cutting & Planting Depth:**
* Select disease-free stem cuttings ($20\text{–}25\text{ cm}$ length, 4–6 nodes).
* Plant at a 45° angle with buds facing upward, leaving $2/3$ of the cutting buried to prevent desiccation.

**3. Disease Precaution:**
* Monitor for Cassava Mosaic Disease (CMD) and Whitefly vectors during early establishment.`,
    citations: [
      {
        sourceId: 'nasa-power-clim',
        title: 'NASA POWER Agroclimatology Surface Meteorology API',
        category: 'Satellite Telemetry',
        excerpt: 'Daily precipitation, root-zone soil moisture, and solar radiation index.',
        score: 0.98,
      },
      {
        sourceId: 'iita-cassava-30',
        title: 'IITA Cassava Agronomy & Phenology Manual',
        category: 'Crop Production',
        excerpt: 'Moisture requirements during nodal sprouting and root bulking stages.',
        score: 0.91,
      },
    ],
  },
  {
    id: 'maize_foliar_rust_pathology',
    title: 'Maize Foliar Rust & Chlorosis Pathology',
    crop: 'Maize',
    category: 'Pathology & Vision AI',
    badge: 'YOLOv8 Foliar Saliency',
    query: 'How to diagnose and mitigate Common Rust (Puccinia sorghi) versus Southern Corn Rust (Puccinia polysora)?',
    canvasMode: 'pathology',
    sampleAnswer: `### Verified Agro-RAG Synthesis: Foliar Rust Pathology Saliency & Protocol

**1. Saliency Differentiation:**
* **Common Rust (*P. sorghi*):** Golden-brown pustules on both upper and lower leaf surfaces, prevalent in cooler highland areas (16–23°C).
* **Southern Rust (*P. polysora*):** Smaller, densely clustered orange pustules primarily on upper surface, thrives in warm humid lowlands (25–32°C).

**2. Cultural & Resistance Strategy:**
* Deploy resistant hybrids (e.g. highland tolerant composites).
* Rotate with non-grass crops (legumes/potatoes) to reduce residual teliospore inoculum.

**3. Chemical Fungicide Threshold:**
* Apply Azoxystrobin + Difenoconazole (0.5 L/ha) if pustules reach ear leaves before the R3 milk stage.`,
    citations: [
      {
        sourceId: 'cimmyt-path-44',
        title: 'CIMMYT Maize Pathology & Diagnostic Compendium',
        category: 'Plant Pathology',
        excerpt: 'Epidemiological distinctions between Puccinia sorghi and Puccinia polysora.',
        score: 0.95,
      },
    ],
  },
];
