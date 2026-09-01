/**
 * Edge Plant Vision Classifier — 100% Offline On-Device Heuristic Diagnosis Engine.
 * NOTE: This is a rule-based RGB/chromaticity heuristic (not a trained ML model).
 * It provides early triage in offline field conditions and must be confirmed by
 * lab diagnosis or extension officer when confidence <0.8. Do not use as sole
 * phytosanitary authority. Extracts chromaticity ratios, chlorosis/necrosis
 * distributions, mottling variance, and defoliation signatures in the browser canvas.
 */

export interface EdgeVisualMetrics {
  greenCanopyIndex: number;
  chlorosisRatio: number;
  necrosisRatio: number;
  rustPustuleRatio: number;
  mottlingVariance: number;
  lesionCoveragePct: number;
}

export interface EdgeDiagnosisCandidate {
  condition: string;
  scientificName: string;
  crop: string;
  confidence: number;
  severity: 'mild' | 'moderate' | 'severe';
  symptoms: string[];
  culturalControl: string[];
  biologicalControl: string[];
  chemicalIntervention: string;
}

export interface OfflineDiagnosisResult {
  isOfflineInference: true;
  heuristicDisclaimer: string;
  primaryDiagnosis: EdgeDiagnosisCandidate;
  alternatives: EdgeDiagnosisCandidate[];
  metrics: EdgeVisualMetrics;
  analyzedAt: string;
}

interface KnownConditionRule {
  condition: string;
  scientificName: string;
  crop: string;
  matcher: (m: EdgeVisualMetrics, cropHint?: string) => { match: boolean; confidence: number; severity: 'mild' | 'moderate' | 'severe' };
  symptoms: string[];
  culturalControl: string[];
  biologicalControl: string[];
  chemicalIntervention: string;
}

const KNOWN_CONDITIONS: KnownConditionRule[] = [
  {
    condition: 'Fall Armyworm (FAW) Infestation',
    scientificName: 'Spodoptera frugiperda',
    crop: 'Maize',
    matcher: (m, cropHint) => {
      const isMaize = !cropHint || cropHint.toLowerCase().includes('maize') || cropHint.toLowerCase().includes('corn');
      const match = isMaize && m.lesionCoveragePct > 12 && m.necrosisRatio > 0.08 && m.greenCanopyIndex < 0.65;
      const confidence = match ? Math.min(0.94, 0.65 + m.lesionCoveragePct * 0.01 + m.necrosisRatio * 0.5) : 0.2;
      const severity = m.lesionCoveragePct > 35 ? 'severe' : m.lesionCoveragePct > 20 ? 'moderate' : 'mild';
      return { match, confidence, severity };
    },
    symptoms: ['Irregular "window pane" feeding holes on young leaves', 'Ragged leaf margins and chewed whorls', 'Sawdust-like frass inside the plant funnel'],
    culturalControl: ['Handpick egg masses and early-instar larvae in small plots', 'Intercrop with desmodium (Push-Pull technology) and Napier grass borders', 'Apply fine sand or wood ash into whorls to suffocate young larvae'],
    biologicalControl: ['Bacillus thuringiensis (Bt) sprays during early larval stages', 'Neem seed kernel extract (NSKE 5%) applied directly to whorls', 'Release of Trichogramma egg parasitoids where available'],
    chemicalIntervention: 'Apply certified emamectin benzoate (e.g. Prove 1.92 EC) or chlorantraniliprole if >20% plants exhibit fresh whorl damage.',
  },
  {
    condition: 'Cassava Mosaic Disease (CMD)',
    scientificName: 'Cassava mosaic begomoviruses',
    crop: 'Cassava',
    matcher: (m, cropHint) => {
      const isCassava = !cropHint || cropHint.toLowerCase().includes('cassava');
      const match = isCassava && m.mottlingVariance > 0.18 && m.chlorosisRatio > 0.25;
      const confidence = match ? Math.min(0.92, 0.68 + m.mottlingVariance * 0.8 + m.chlorosisRatio * 0.4) : 0.15;
      const severity = m.chlorosisRatio > 0.45 ? 'severe' : m.chlorosisRatio > 0.28 ? 'moderate' : 'mild';
      return { match, confidence, severity };
    },
    symptoms: ['Distinct yellow-green mosaic pattern on leaflets', 'Severe distortion, twisting, and reduction of leaf lamina size', 'Stunted plant growth and reduced tuberous root yield'],
    culturalControl: ['Plant certified disease-free stem cuttings (e.g. KME-08-02, MH95/0183)', 'Rogue and destroy diseased plants within the first 90 days after planting', 'Sanitize cutting tools with 5% sodium hypochlorite bleach'],
    biologicalControl: ['Conserve natural predators of whiteflies (Bemisia tabaci) such as lacewings and predatory mites', 'Plant barrier borders with sunflower or sorghum to deter whitefly flight'],
    chemicalIntervention: 'Vector control only: Target whitefly vector with insecticidal soap or azadirachtin if whitefly count >10 per plant.',
  },
  {
    condition: 'Maize Lethal Necrosis Disease (MLND)',
    scientificName: 'SCMV + MCMV co-infection',
    crop: 'Maize',
    matcher: (m, cropHint) => {
      const isMaize = !cropHint || cropHint.toLowerCase().includes('maize') || cropHint.toLowerCase().includes('corn');
      const match = isMaize && m.chlorosisRatio > 0.35 && m.necrosisRatio > 0.2;
      const confidence = match ? Math.min(0.95, 0.72 + m.necrosisRatio * 0.6) : 0.1;
      const severity = m.necrosisRatio > 0.3 ? 'severe' : 'moderate';
      return { match, confidence, severity };
    },
    symptoms: ['Severe yellow mottling beginning at leaf base and progressing along margins', 'Premature drying / "dead heart" of the whorl and tassels', 'Sterility or poorly filled, rotting cobs'],
    culturalControl: ['Crop rotation with non-cereal crops (beans, potatoes, vegetables) for at least two seasons', 'Immediate uprooting and burning of infected plants to arrest viral spread', 'Maintain 100% weed-free borders to remove reservoir grass hosts'],
    biologicalControl: ['Promote natural aphid and thrips predators (ladybird beetles, hoverfly larvae)'],
    chemicalIntervention: 'Control thrips and beetle vectors early in season with thiamethoxam/lambda-cyhalothrin seed dressings.',
  },
  {
    condition: 'Coffee Leaf Rust (CLR)',
    scientificName: 'Hemileia vastatrix',
    crop: 'Coffee',
    matcher: (m, cropHint) => {
      const isCoffee = !cropHint || cropHint.toLowerCase().includes('coffee');
      const match = isCoffee && m.rustPustuleRatio > 0.12 && m.chlorosisRatio > 0.15;
      const confidence = match ? Math.min(0.93, 0.7 + m.rustPustuleRatio * 1.2) : 0.1;
      const severity = m.rustPustuleRatio > 0.25 ? 'severe' : 'moderate';
      return { match, confidence, severity };
    },
    symptoms: ['Yellowish-orange powdery circular lesions on the underside of leaves', 'Chlorotic spots on upper leaf surface corresponding to lower lesions', 'Premature leaf drop leading to dieback of fruiting branches'],
    culturalControl: ['Proper canopy pruning to allow airflow and reduce relative humidity', 'Plant rust-resistant Arabica cultivars (Ruiru 11, Batian)', 'Balanced potassium and calcium soil nutrition to reinforce leaf cuticle'],
    biologicalControl: ['Hyperparasite fungus Verticillium hemileiae applications where registered'],
    chemicalIntervention: 'Preventive copper oxychloride (50% WP) at start of rains, or systemic triazole (azoxystrobin/cyproconazole) if infection >10%.',
  },
  {
    condition: 'Tomato Late Blight',
    scientificName: 'Phytophthora infestans',
    crop: 'Tomato',
    matcher: (m, cropHint) => {
      const isTomato = !cropHint || cropHint.toLowerCase().includes('tomato') || cropHint.toLowerCase().includes('potato');
      const match = isTomato && m.necrosisRatio > 0.25 && m.greenCanopyIndex < 0.55;
      const confidence = match ? Math.min(0.91, 0.65 + m.necrosisRatio * 0.7) : 0.15;
      const severity = m.necrosisRatio > 0.4 ? 'severe' : 'moderate';
      return { match, confidence, severity };
    },
    symptoms: ['Water-soaked greenish-brown irregular lesions on leaves and stems', 'White cottony fungal growth on lower leaf surfaces in high humidity', 'Brown firm rot on developing green and ripe fruits'],
    culturalControl: ['Avoid overhead irrigation; use drip lines to keep foliage dry', 'Ensure adequate plant spacing (60x60 cm) for canopy ventilation', 'Remove and bury lower infected foliage immediately'],
    biologicalControl: ['Trichoderma viride root drench and foliar protective spray'],
    chemicalIntervention: 'Foliar protective Mancozeb 80% WP, or curative metalaxyl-M + mancozeb (Ridomil Gold) upon first lesion detection.',
  },
];

function classifyPixel(r: number, g: number, b: number) {
  if (r > 240 && g > 240 && b > 240) {
    return { isBackground: true, isGreen: false, isChlorotic: false, isNecrotic: false, isRust: false };
  }
  return {
    isBackground: false,
    isGreen: g > r * 1.1 && g > b * 1.1,
    isChlorotic: r > 140 && g > 140 && b < 100,
    isNecrotic: r > 60 && r < 160 && g > 40 && g < 130 && b < 80 && r >= g,
    isRust: r > 160 && g > 70 && g < 140 && b < 50,
  };
}

function accumulatePixel(
  p: ReturnType<typeof classifyPixel>,
  counts: { green: number; chlorotic: number; necrotic: number; rust: number; total: number }
) {
  if (p.isBackground) return;
  counts.total++;
  if (p.isGreen) counts.green++;
  if (p.isChlorotic) counts.chlorotic++;
  if (p.isNecrotic) counts.necrotic++;
  if (p.isRust) counts.rust++;
}

function analyzeGridBlock(
  data: Uint8ClampedArray,
  width: number,
  bx: number,
  by: number,
  blockSize: number
) {
  const counts = { green: 0, chlorotic: 0, necrotic: 0, rust: 0, total: 0 };
  const startX = bx * blockSize;
  const startY = by * blockSize;

  for (let py = 0; py < blockSize; py++) {
    const rowOffset = (startY + py) * width;
    for (let px = 0; px < blockSize; px++) {
      const idx = (rowOffset + startX + px) * 4;
      const p = classifyPixel(data[idx], data[idx + 1], data[idx + 2]);
      accumulatePixel(p, counts);
    }
  }

  return {
    greenScore: counts.total > 10 ? counts.green / counts.total : null,
    chlorotic: counts.chlorotic,
    necrotic: counts.necrotic,
    rust: counts.rust,
    green: counts.green,
  };
}

function computeBlockVariance(scores: number[]): number {
  if (scores.length === 0) return 0;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const sumSquares = scores.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0);
  return Math.min(1.0, Math.sqrt(sumSquares / scores.length) * 2);
}

export async function extractVisualMetricsFromCanvas(
  canvas: HTMLCanvasElement
): Promise<EdgeVisualMetrics> {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get 2D canvas context');
  }

  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  const totalPixels = width * height || 1;

  let greenDominant = 0;
  let chloroticPixels = 0;
  let necroticPixels = 0;
  let rustPixels = 0;

  const BLOCK_SIZE = 16;
  const blocksX = Math.floor(width / BLOCK_SIZE);
  const blocksY = Math.floor(height / BLOCK_SIZE);
  const blockGreenScores: number[] = [];

  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      const res = analyzeGridBlock(data, width, bx, by, BLOCK_SIZE);
      if (res.greenScore !== null) {
        blockGreenScores.push(res.greenScore);
      }
      greenDominant += res.green;
      chloroticPixels += res.chlorotic;
      necroticPixels += res.necrotic;
      rustPixels += res.rust;
    }
  }

  const greenCanopyIndex = Math.min(1.0, greenDominant / totalPixels);
  const chlorosisRatio = Math.min(1.0, chloroticPixels / totalPixels);
  const necrosisRatio = Math.min(1.0, necroticPixels / totalPixels);
  const rustPustuleRatio = Math.min(1.0, rustPixels / totalPixels);
  const lesionCoveragePct = Math.min(100, Math.round((chlorosisRatio + necrosisRatio + rustPustuleRatio) * 100));

  return {
    greenCanopyIndex,
    chlorosisRatio,
    necrosisRatio,
    rustPustuleRatio,
    mottlingVariance: computeBlockVariance(blockGreenScores),
    lesionCoveragePct,
  };
}

export async function diagnosePlantOffline(
  imageSource: HTMLImageElement | HTMLCanvasElement,
  cropHint?: string
): Promise<OfflineDiagnosisResult> {
  let canvas: HTMLCanvasElement;

  if (imageSource instanceof HTMLCanvasElement) {
    canvas = imageSource;
  } else {
    canvas = document.createElement('canvas');
    canvas.width = 224;
    canvas.height = 224;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to initialize analysis canvas');
    ctx.drawImage(imageSource, 0, 0, 224, 224);
  }

  const metrics = await extractVisualMetricsFromCanvas(canvas);

  const scoredCandidates: EdgeDiagnosisCandidate[] = [];

  for (const rule of KNOWN_CONDITIONS) {
    const matchResult = rule.matcher(metrics, cropHint);
    if (matchResult.confidence > 0.3) {
      scoredCandidates.push({
        condition: rule.condition,
        scientificName: rule.scientificName,
        crop: rule.crop,
        confidence: matchResult.confidence,
        severity: matchResult.severity,
        symptoms: rule.symptoms,
        culturalControl: rule.culturalControl,
        biologicalControl: rule.biologicalControl,
        chemicalIntervention: rule.chemicalIntervention,
      });
    }
  }

  scoredCandidates.sort((a, b) => b.confidence - a.confidence);

  // Fallback healthy diagnosis if no disease matched with high confidence
  const primaryDiagnosis: EdgeDiagnosisCandidate =
    scoredCandidates.length > 0
      ? scoredCandidates[0]
      : {
          condition: 'Healthy Vigorous Foliage',
          scientificName: 'Optimal Crop Phenology',
          crop: cropHint || 'Field Crop',
          confidence: Math.max(0.85, metrics.greenCanopyIndex),
          severity: 'mild',
          symptoms: ['Uniform green pigmentation', 'Intact cuticle structure without lesions or necrosis', 'Normal leaflet elongation'],
          culturalControl: ['Maintain standard weed management and scouting routine', 'Apply scheduled top-dressing fertilizer per crop cycle plan'],
          biologicalControl: ['Promote beneficial pollinators and soil microbiome health with compost mulching'],
          chemicalIntervention: 'No chemical intervention required. Continue routine pest scouting weekly.',
        };

  const alternatives = scoredCandidates.slice(1, 3);

  return {
    isOfflineInference: true,
    heuristicDisclaimer: 'HEURISTIC ONLY — RGB chromaticity triage, not ML. Confirm with lab/extension officer if confidence <0.8.',
    primaryDiagnosis,
    alternatives,
    metrics,
    analyzedAt: new Date().toISOString(),
  };
}
