// Document catalog moved verbatim from components/KnowledgeBase/index.tsx (pure move).

export interface DocumentArticle {
  id: string;
  title: string;
  author: string;
  category: 'Agronomy' | 'IPM & Pest' | 'Soil Chemistry' | 'Climatology' | 'Horticulture';
  crop: string;
  verified: boolean;
  readingTime: string;
  chunks: number;
  excerpt: string;
  fullText: string;
}

export const DOCUMENT_CATALOG: DocumentArticle[] = [
  {
    id: 'fao-faw-guidelines',
    title: 'FAO Fall Armyworm (Spodoptera frugiperda) Integrated Pest Management Field Guide',
    author: 'Food and Agriculture Organization (FAO) & CIMMYT',
    category: 'IPM & Pest',
    crop: 'Maize & Cereals',
    verified: true,
    readingTime: '6 min read',
    chunks: 42,
    excerpt: 'Comprehensive biological, parasitoid (Telenomus remus), and low-toxicity thresholds for smallholder maize whorl protection.',
    fullText: `## Executive Protocol: Fall Armyworm (FAW) Management in Sub-Saharan Africa

### 1. Scouting and Thresholds
* Scout at least 50 plants in a 'W' trajectory across each 1-hectare plot.
* **Early Vegetative:** If >= 20% of plants display window-pane feeding damage, initiate biological or botanical intervention immediately.
* **Mid-Whorl to Tasseling:** If >= 10% of plants show fresh frass and active larvae in whorls, apply targeted bio-pesticides directly into leaf funnels.

### 2. Biological Control Agents
* **Bacillus thuringiensis (Bt) kurstaki:** Apply at 1.5–2.0 kg/ha during late afternoon to prevent UV degradation.
* **Cold-Pressed Neem Oil (Azadirachtin 0.03%):** Dilute 5 ml/L water with mild surfactant. Interrupts ecdysone molting cycle.
* **Push-Pull Technology:** Intercrop with *Desmodium uncinatum* (repellent) and plant *Brachiaria* grass border trap strips.

### 3. Approved Chemical Options (Rescue Phase)
* Emamectin Benzoate 5% SG (0.4 g/L)
* Chlorantraniliprole 18.5% SC (0.3 ml/L)
* Direct sprays into the central whorl with a solid-cone nozzle. Avoid broad-spectrum synthetic pyrethroids to preserve native parasitoids.`,
  },
  {
    id: 'isric-soil-acidity',
    title: 'ISRIC SoilGrids v2 Smallholder Liming & Aluminum Toxicity Neutralization Guide',
    author: 'ISRIC World Soil Information & IFDC',
    category: 'Soil Chemistry',
    crop: 'Multi-Crop',
    verified: true,
    readingTime: '8 min read',
    chunks: 58,
    excerpt: 'Quantitative lime requirement equations (CaCO3) for tropical Ferralsols and Acrisols with exchangeable aluminum saturation >30%.',
    fullText: `## Diagnostic Matrix & Remediation for Acidic Tropical Soils

### 1. Soil Acidity Profile
* **Target pH:** 6.0 – 6.5 for optimal CEC and phosphorus bioavailability.
* **Critical Threshold:** Soil pH < 5.0 triggers soluble Al3+ mobilization, causing acute root tip swelling and stunting.

### 2. Liming Rate Calculation
* **Equation:** $\text{Lime Required (t/ha)} = 1.5 \times \text{Exchangeable Al (cmol/kg)} \times \text{Buffer Factor}$.
* For typical volcanic Ferralsols (pH 4.8, 35% Al saturation), apply **2.5 to 3.0 tonnes/ha** of fine agricultural lime (CaCO3, ENV > 80%).
* Broadcast and incorporate into the upper 0–15 cm depth at least **3 to 4 weeks before sowing**.

### 3. Integrated Nutrient Strategy
* Co-apply with organic compost ($5\text{ t/ha}$) to complex residual aluminum ions.
* Use Single Superphosphate (SSP) or rock phosphate to supply calcium and sulfur alongside bioavailable phosphorus.`,
  },
  {
    id: 'nasa-clim-planting',
    title: 'NASA POWER Agroclimatology Surface Meteorology & Sowing Window Almanac',
    author: 'NASA Earth Science Applied Sciences & CIAT',
    category: 'Climatology',
    crop: 'Cassava, Maize & Legumes',
    verified: true,
    readingTime: '5 min read',
    chunks: 36,
    excerpt: 'Utilizing 14-day rainfall anomalies, root-zone saturation indices, and growing degree days (GDD) for precision planting.',
    fullText: `## Satellite Agroclimatology & Moisture Calibration

### 1. Satellite Moisture Index Interpretation
* **Root-Zone Saturation (0–100 cm):** Minimum 0.32 m³/m³ required for uniform germination.
* **14-Day Rainfall Anomaly:** Positive anomalies (+15% to +35% above 10-year median) confirm sustained bimodal onset.

### 2. Sowing Window Protocols
* Ensure at least **25 mm of cumulative rainfall** over 3 consecutive days prior to seeding.
* For Cassava: Plant stem cuttings at 45° angle, burying 2/3 of nodes into warm moist topsoil.
* For Maize: Seed at 5 cm depth; apply basal fertilizer at planting when soil temperature is 18°C–28°C.`,
  },
  {
    id: 'kalro-push-pull-manual',
    title: 'KALRO Push-Pull Agroecological Crop Protection Technical Bulletin',
    author: 'Kenya Agricultural & Livestock Research Organization (KALRO) & ICIPE',
    category: 'Agronomy',
    crop: 'Maize & Sorghum',
    verified: true,
    readingTime: '7 min read',
    chunks: 48,
    excerpt: 'Intercropping Desmodium and Napier/Brachiaria grasses for simultaneous Striga weed suppression and stemborer deterrence.',
    fullText: `## Climate-Adapted Push-Pull Protocol

### 1. Mechanism
* **The "Push":** Greenleaf Desmodium (*Desmodium intortum*) intercropped between maize rows emits volatile monoterpenes that repel ovipositing moths.
* **The "Pull":** Border strips of Napier (*Pennisetum purpureum*) or Brachiaria grass attract moths to lay eggs on gummy trap leaves where larvae cannot develop.

### 2. Striga Weed (*Striga hermonthica*) Suppression
* Root exudates of Desmodium contain isoflavonones that induce suicidal germination of Striga seeds without attaching to maize roots.
* Reduces Striga seed bank by over 80% within two cropping seasons while fixing up to 100 kg N/ha.`,
  },
  {
    id: 'horticulture-drip-fertigation',
    title: 'Precision Smallholder Drip Fertigation & NPK Uptake Kinetics',
    author: 'AVRDC World Vegetable Center',
    category: 'Horticulture',
    crop: 'Tomato, Capsicum & Onion',
    verified: true,
    readingTime: '6 min read',
    chunks: 39,
    excerpt: 'Split soluble fertilizer application schedules, electrical conductivity (EC) thresholds, and blossom-end rot calcium prevention.',
    fullText: `## Solanaceous Crop Fertigation Management

### 1. Nutrient Scheduling
* **Vegetative Stage:** N:P:K ratio of 2:1:1 to establish robust foliage and root structure.
* **Flowering & Fruit Set:** Shift to 1:1:2 ratio with high potassium and soluble calcium nitrate to prevent blossom-end rot.

### 2. Irrigation Calibration
* Maintain EC at 1.8–2.2 mS/cm and pH between 5.8 and 6.5.
* Pulse irrigate 2–3 times daily during peak evapotranspiration (11:00 AM – 2:00 PM) to maintain continuous capillary moisture.`,
  },
];
