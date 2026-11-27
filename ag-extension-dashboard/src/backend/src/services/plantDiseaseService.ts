/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '@/utils/logger';
import { AIRouter } from '@/services/aiProvider/aiProvider';
import { agronomicSafetyGuard } from '@/services/security/agronomicSafetyGuard';

// NOTE: A backend ONNX inference path was removed during the truthfulness remediation:
// it fed a uniform tensor derived from the first byte of the JPEG header into an
// untrained surrogate model and stamped healthy outputs as `verified_source`.
// Image diagnosis goes through the LLM vision provider below until a trained
// on-device model is wired with real pixel decoding (see the frontend classifier).

export type DiagnosticEvidenceStatus = 'verified_source' | 'no_verified_source';
export type DiagnosticReviewStatus = 'ready' | 'needs_expert_review';

export interface DiagnosticProvenance {
  evidenceStatus: DiagnosticEvidenceStatus;
  source: string;
  sourceUrl: string | null;
  sourceTimestamp: string | null;
  provider: string | null;
  model: string | null;
  generatedAt: string;
}

export interface DiseaseDiagnosis {
  disease: string;
  confidence: number;
  reviewStatus: DiagnosticReviewStatus;
  provenance: DiagnosticProvenance;
  safetyNotice: string;
  severity: 'mild' | 'moderate' | 'severe';
  description: string;
  symptoms: string[];
  treatment: string[];
  prevention: string[];
  imageUrl?: string;
}

export interface PlantImageAnalysis {
  overallHealth: 'healthy' | 'stressed' | 'diseased' | 'unknown';
  diseases: DiseaseDiagnosis[];
  nutrientDeficiencies: string[];
  recommendations: string[];
  confidence: number;
  reviewStatus: DiagnosticReviewStatus;
  provenance: DiagnosticProvenance;
}

export interface SoilAnalysisResult {
  overallHealthScore: number | null;
  texture: string;
  estimatedMoisture: string;
  drainageClass: string;
  colorDiscoloration: string;
  npkDeficiencies: {
    nitrogen: 'low' | 'optimal' | 'high' | 'unknown';
    phosphorus: 'low' | 'optimal' | 'high' | 'unknown';
    potassium: 'low' | 'optimal' | 'high' | 'unknown';
  };
  recommendations: string[];
  cropSuitability: string[];
  confidence: number;
  reviewStatus: DiagnosticReviewStatus;
  provenance: DiagnosticProvenance;
}

const DIAGNOSTIC_REVIEW_THRESHOLD = 0.75;
const DIAGNOSTIC_SAFETY_NOTICE =
  'This is a starting point, not a diagnosis. Ask your extension officer or an agronomist to confirm it, and follow the product label approved in your country before you treat.';
const WITHHELD_TREATMENT =
  'We do not suggest a treatment until a local expert has confirmed what it is and which products are allowed where you farm.';
const GENERAL_PREVENTION = [
  'Monitor the affected plants and the ones around them for changes. Photograph both sides of the leaves and the whole plant.',
  'Do not move plants or plant parts from this field to other fields until you know what it is.',
];
const IMAGE_REVIEW_GUIDANCE = [
  ...GENERAL_PREVENTION,
  'Record the crop, growth stage, where in the field you see it, when it started and any recent rain or watering. Share this with your extension officer.',
  'Do not choose a pesticide or fertilizer from a photo alone. First find the cause, and which products are allowed where you farm.',
];
const STRESS_REVIEW_GUIDANCE = [
  'Check soil moisture and drainage before changing irrigation; discoloration can have several causes.',
  'A photograph cannot confirm a nutrient deficiency. Use an appropriate soil or leaf-tissue test before choosing fertilizer.',
];
const SOIL_REVIEW_GUIDANCE = [
  'Obtain a laboratory soil test before choosing fertilizer or lime; a photograph cannot establish nutrient levels or pH.',
  'Record recent rainfall or irrigation and inspect moisture and drainage in the field.',
  'Share the crop, field location and test results with a local extension officer for field-specific advice.',
];

function screenObservation(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return agronomicSafetyGuard.scanGeneratedAdvice(value).violations.length > 0
    ? WITHHELD_TREATMENT
    : value;
}

function normalizeConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const normalized = value > 1 ? value / 100 : value;
  return Math.max(0, Math.min(1, normalized));
}

function getReviewStatus(confidence: number, evidenceStatus: DiagnosticEvidenceStatus): DiagnosticReviewStatus {
  return evidenceStatus === 'verified_source' && normalizeConfidence(confidence) >= DIAGNOSTIC_REVIEW_THRESHOLD
    ? 'ready' : 'needs_expert_review';
}

function createProvenance(
  source: string,
  generatedAt: string,
  options: Partial<Pick<DiagnosticProvenance, 'evidenceStatus' | 'sourceUrl' | 'sourceTimestamp' | 'provider' | 'model'>> = {}
): DiagnosticProvenance {
  return {
    evidenceStatus: options.evidenceStatus ?? 'no_verified_source',
    source,
    sourceUrl: options.sourceUrl ?? null,
    sourceTimestamp: options.sourceTimestamp ?? null,
    provider: options.provider ?? null,
    model: options.model ?? null,
    generatedAt,
  };
}

function resolveVisionProvider(provider?: string | null): string {
  if (!provider || provider === 'multimodal_vision_router') {
    return 'AIMixHub';
  }
  if (provider.toLowerCase() === 'aihubmix' || provider.toLowerCase() === 'aimixhub') {
    return 'AIMixHub';
  }
  return provider;
}

class PlantDiseaseService {
  private static readonly DISEASE_DATABASE: Record<string, {
    symptoms: string[];
    treatment: string[];
    prevention: string[];
    description: string;
    susceptibleCrops: string[];
  }> = {
    'late_blight': {
      symptoms: ['Dark water-soaked lesions on leaves', 'White fungal growth on leaf undersides', 'Brown lesions on stems', 'Rapid leaf death'],
      treatment: ['Apply a fungicide registered for this disease on your crop in your country, at the label rate and interval', 'Remove and destroy infected plant parts', 'Ensure proper spacing for air circulation'],
      prevention: ['Use resistant varieties', 'Avoid overhead irrigation', 'Rotate away from tomato and potato', 'If the weather favours the disease, a protective fungicide registered for your crop, applied as its label says'],
      description: 'Late blight (Phytophthora infestans) is a serious disease of tomatoes and potatoes. It spreads fast in cool, wet weather.',
      susceptibleCrops: ['tomato', 'potato', 'solanaceae'],
    },
    'powdery_mildew': {
      symptoms: ['White powdery coating on leaves', 'Yellowing leaves', 'Distorted new growth', 'Premature leaf drop'],
      treatment: ['Apply a fungicide registered for this disease on your crop in your country, at the label rate and interval', 'Neem or potassium bicarbonate sprays can help on small plots; follow the product label', 'Remove severely infected leaves'],
      prevention: ['Ensure good air circulation', 'Avoid overhead watering', 'Plant resistant varieties', 'If the weather favours the disease, a protective fungicide registered for your crop, applied as its label says'],
      description: 'Powdery mildew is a common fungal disease of many crops. It does well in warm, dry weather with damp nights.',
      susceptibleCrops: ['cucurbits', 'squash', 'grapes', 'apple', 'pea', 'tomato', 'general'],
    },
    'bacterial_wilt': {
      symptoms: ['Sudden wilting of entire plant', 'Yellowing of lower leaves', 'Brown discoloration in stem vascular tissue', 'Plant death within days'],
      treatment: ['No effective chemical treatment available', 'Remove and destroy infected plants', 'Heat the affected soil under clear plastic in the hot season (soil solarisation)'],
      prevention: ['Use resistant varieties', 'Rotate crops', 'Ensure well-drained soil', 'Avoid planting in previously infected areas'],
      description: 'Bacterial wilt (Ralstonia solanacearum) makes plants wilt suddenly and die. It stays in the soil for years and spreads through water and dirty tools.',
      susceptibleCrops: ['tomato', 'potato', 'banana', 'eggplant', 'pepper'],
    },
    'leaf_spot': {
      symptoms: ['Circular brown spots on leaves', 'Yellow halos around spots', 'Spots may merge causing leaf death', 'Premature defoliation'],
      treatment: ['Apply a fungicide registered for this disease on your crop in your country, at the label rate and interval', 'Remove infected leaves', 'Improve air circulation'],
      prevention: ['Avoid overhead irrigation', 'Space plants properly', 'Remove plant debris', 'Use disease-free seeds'],
      description: 'Leaf spots are caused by several fungi and bacteria. The spots take away leaf the plant needs to grow, and can cut the harvest a lot.',
      susceptibleCrops: ['bean', 'groundnut', 'maize', 'cabbage', 'general'],
    },
    'rust': {
      symptoms: ['Orange-brown pustules on leaf undersides', 'Yellow spots on upper leaf surface', 'Premature leaf drop', 'Reduced yield'],
      treatment: ['Apply a fungicide registered for this disease on your crop in your country, at the label rate and interval', 'Remove infected leaves'],
      prevention: ['Plant resistant varieties', 'Ensure proper spacing', 'Avoid excessive nitrogen', 'Monitor fields regularly'],
      description: 'Rust affects many cereals, beans and other legumes. It weakens the leaves and can cut the harvest a lot.',
      susceptibleCrops: ['maize', 'beans', 'wheat', 'coffee', 'sorghum'],
    },
    'mosaic_virus': {
      symptoms: ['Mottled yellow-green pattern on leaves', 'Stunted growth', 'Distorted leaves', 'Reduced fruit size'],
      treatment: ['No cure for viral diseases', 'Remove and destroy infected plants', 'Control the insects that spread it (aphids)', 'Use virus-free seeds'],
      prevention: ['Use certified virus-free seeds', 'Control aphid populations', 'Practice good hygiene', 'Remove weeds that host viruses'],
      description: 'Mosaic viruses are spread by insects and dirty tools. Infected plants cannot be cured.',
      susceptibleCrops: ['cassava', 'maize', 'tomato', 'tobacco', 'cucumber'],
    },
    'fall_armyworm': {
      symptoms: ['Window-pane feeding marks on leaf whorls', 'Ragged holes in leaves with sawdust-like frass', 'Caterpillar inside vegetative whorl', 'Destroyed tassel or ear'],
      treatment: ['As a last resort, past the action threshold in your national or FAO fall armyworm guidance: an insecticide registered for fall armyworm on maize in your country, at the label rate', 'Neem seed kernel extract or Bacillus thuringiensis (Bt) products, following the local recipe or product label', 'Handpick egg masses and larvae in early stages', 'Put sand or wood ash into the leaf funnel (whorl)'],
      prevention: ['Plant early in the season, as your local guide advises', 'Intercrop maize with desmodium or legumes', 'Push-pull technology using Napier grass', 'Check the field every week for egg clusters'],
      description: 'Fall armyworm (Spodoptera frugiperda) is an invasive caterpillar that strips the leaves of cereals across Africa and Asia.',
      susceptibleCrops: ['maize', 'sorghum', 'millet', 'rice', 'sugarcane'],
    },
    'maize_lethal_necrosis': {
      symptoms: ['Severe chlorotic mottle and mosaic on leaves', 'Drying of leaf margins progressing to whole leaf necrosis', 'Premature plant death and dead heart', 'Small deformed cobs with no grain set'],
      treatment: ['No curative chemical treatment', 'Pull out and destroy infected plants straight away', 'Control the insect vectors only where your local guide advises it, with a product registered for your crop, at the label rate', 'Do not move plants, soil or tools out of the field'],
      prevention: ['Plant certified disease-free hybrid seed', 'Leave a season without maize between maize crops', 'Rotate with non-cereal crops such as cassava or legumes', 'Do not recycle grain as seed'],
      description: 'Maize lethal necrosis (MLND) is a serious maize disease caused by two viruses together: maize chlorotic mottle virus (MCMV) and sugarcane mosaic virus (SCMV). Many countries control it by law, so report suspected cases to your plant health authority.',
      susceptibleCrops: ['maize'],
    },
    'maize_streak_virus': {
      symptoms: ['Continuous narrow chlorotic streaks along leaf veins', 'Stunted growth and internode shortening', 'Failure of tassel emergence', 'Sterile or poorly formed cobs'],
      treatment: ['No cure once plants are infected', 'Pull out infected seedlings early', 'Control the insect vectors only where your local guide advises it, with a product registered for your crop, at the label rate'],
      prevention: ['Plant streak-resistant seed varieties', 'Where your local guide advises it, a seed treatment registered against the leafhopper vector', 'Clear grassy weeds around the field edges', 'Avoid late staggered plantings'],
      description: 'Maize streak virus (MSV) is spread by leafhoppers (Cicadulina mbila). It is one of the most common virus problems of maize in Africa.',
      susceptibleCrops: ['maize', 'wheat', 'barley'],
    },
    'gray_leaf_spot': {
      symptoms: ['Rectangular necrotic lesions delimited by leaf veins', 'Tan to grayish lesions on lower leaves', 'Premature blighting of canopy', 'Stalk rot and lodging'],
      treatment: ['If lesions are spreading towards the ear leaf around tasselling: apply a fungicide registered for this disease on your crop in your country, at the label rate and interval', 'Remove infected lower leaves in small plots'],
      prevention: ['Plow under crop residue to accelerate decomposition', 'Select resistant hybrids', 'Rotate with non-grass crops', 'Avoid high plant densities'],
      description: 'Gray leaf spot (Cercospora zeae-maydis) makes long, rectangular grey spots on maize leaves. In warm, humid weather the spots join up and the leaves die fast.',
      susceptibleCrops: ['maize'],
    },
    'rice_blast': {
      symptoms: ['Spindle-shaped elliptical lesions with gray centers and brown margins on leaves', 'Rotten neck where panicle node turns black and breaks', 'White empty panicles', 'Collar rot'],
      treatment: ['Apply a fungicide registered for this disease on your crop in your country, at the label rate and interval, timed as the label and the local blast forecast advise', 'Drain standing water temporarily in flooded paddies'],
      prevention: ['Use blast-resistant certified cultivars', 'Avoid excessive nitrogenous fertilizer application', 'Use seed treated with a product registered for rice', 'Maintain balanced potassium nutrition'],
      description: 'Rice blast (Magnaporthe oryzae) is the most damaging rice disease worldwide. It attacks the leaves, stems, stem joints (nodes) and the grain heads (panicles).',
      susceptibleCrops: ['rice', 'paddy'],
    },
    'rice_bacterial_blight': {
      symptoms: ['Water-soaked lesions on leaf margins turning wavy yellow-white stripes', 'Bacterial ooze droplets on young lesions in morning', 'Kresek wilt in young seedlings', 'Premature grain sterility'],
      treatment: ['No effective chemical cure', 'Drain deep standing water', 'Avoid field-to-field irrigation flow from diseased fields'],
      prevention: ['Plant resistant rice varieties carrying Xa genes', 'Ensure balanced NPK fertilization avoiding nitrogen excess', 'Keep field borders clear of wild host grasses', 'Dry seeds thoroughly'],
      description: 'Bacterial blight of rice (Xanthomonas oryzae pv. oryzae) gets into leaves through their tips and edges or through wounds, and makes them dry out as if scorched. It is worst in irrigated lowland rice.',
      susceptibleCrops: ['rice', 'paddy'],
    },
    'sorghum_anthracnose': {
      symptoms: ['Circular to elliptical red, orange, or black lesions on foliage', 'Black fruiting bodies (acervuli) inside lesions', 'Stalk rot and peduncle breakage', 'Grain discoloration'],
      treatment: ['Apply a fungicide registered for this disease on your crop in your country, at the label rate and interval', 'Harvest early if stalk rot threatens lodging'],
      prevention: ['Plant certified disease-free resistant seed', 'Deep plow infected crop residue', 'Rotate with cotton, groundnut, or cowpea', 'Avoid continuous sorghum cultivation'],
      description: 'Sorghum anthracnose (Colletotrichum sublineolum) infects the leaves, stalks and grain heads of sorghum in warm, humid areas.',
      susceptibleCrops: ['sorghum', 'millet'],
    },
    'bean_anthracnose': {
      symptoms: ['Dark brick-red to black sunken lesions along leaf veins on undersides', 'Sunken circular cankers with raised reddish borders on pods', 'Salmon-colored spore masses in moist weather', 'Seed discoloration'],
      treatment: ['Apply a fungicide registered for this disease on your crop in your country, at the label rate and interval', 'Remove and burn severely infected plants', 'Avoid entering fields when foliage is wet'],
      prevention: ['Use certified disease-free seed', 'Rotate with maize or sweet potato', 'Plow under bean stubble after harvest', 'Use resistant common bean varieties'],
      description: 'Bean anthracnose (Colletotrichum lindemuthianum) is a fungal disease carried in bean seed. It can destroy much of the crop where the weather is cool and humid.',
      susceptibleCrops: ['bean', 'legumes'],
    },
    'groundnut_rosette': {
      symptoms: ['Extreme bushiness and stunting of plant', 'Chlorotic yellowing or dark-green mottling on leaves', 'Thickened curled leaflets', 'Severely reduced pod set and aborted kernels'],
      treatment: ['No chemical cure for viral rosette complex', 'Rogue out chlorotic or stunted seedlings early', 'Control the insect vectors only where your local guide advises it, with a product registered for your crop, at the label rate'],
      prevention: ['Plant early at close spacing (high plant density) to suppress aphid vector landings', 'Plant rosette-resistant groundnut varieties', 'Control groundnut volunteer plants'],
      description: 'Groundnut rosette disease (GRD) is caused by three viruses working together and is spread by the cowpea aphid (Aphis craccivora). It can wipe out most of the harvest.',
      susceptibleCrops: ['groundnut', 'peanut'],
    },
    'common_bacterial_blight': {
      symptoms: ['Small water-soaked spots on leaves expanding into large brown necrotic areas', 'Bright lemon-yellow halos around leaf lesions', 'Greasy circular water-soaked sunken spots on bean pods', 'Stem girdling'],
      treatment: ['A bactericide registered for beans in your country can slow spread; follow its label', 'Do not cultivate or harvest while plants are wet with dew or rain'],
      prevention: ['Plant certified pathogen-free bean seeds', 'Rotate with non-host crops', 'Destroy volunteer legumes and infected crop residues'],
      description: 'Common bacterial blight (Xanthomonas axonopodis pv. phaseoli) is a serious bacterial disease of beans, carried in seed. It is worst in warm tropical weather.',
      susceptibleCrops: ['bean', 'legumes'],
    },
    'cassava_brown_streak': {
      symptoms: ['Feathery chlorosis and yellow vein-banding on mature lower leaves', 'Brown necrotic streaks on green stem surfaces', 'Dry brown-black corky rot inside storage roots', 'Root constriction and cracking'],
      treatment: ['No chemical cure', 'Immediate rogueing and destruction of infected plants', 'Harvest early before root necroses progress completely across storage tissue'],
      prevention: ['Use virus-indexed clean stem cuttings from certified tissue culture nurseries', 'Control whitefly populations with biocontrol or selective insecticides', 'Plant CBSD-tolerant clones'],
      description: 'Cassava brown streak disease (CBSD) is caused by viruses spread by whiteflies (Bemisia tabaci). It rots the roots from inside, often with little sign above ground, so the roots cannot be eaten or sold.',
      susceptibleCrops: ['cassava'],
    },
    'early_blight': {
      symptoms: ['Concentric dark rings (target board pattern) on older leaves', 'Yellowing of tissue surrounding concentric spots', 'Stem collar rot on seedlings', 'Dark leathery sunken spots on fruit'],
      treatment: ['Apply a fungicide registered for this disease on your crop in your country, at the label rate and interval; alternate modes of action', 'Remove lower blighted leaves to prevent splash dispersion', 'Ensure drip irrigation instead of overhead watering'],
      prevention: ['Rotate away from tomato, potato and other solanaceous crops', 'Stake and trellis plants to elevate foliage', 'Mulch soil surface around base', 'Use certified disease-free seedlings'],
      description: 'Early blight (Alternaria solani) attacks the older, lower leaves of tomatoes and potatoes first. Its brown spots have rings inside, like a target.',
      susceptibleCrops: ['tomato', 'potato', 'solanaceae'],
    },
    'banana_xanthomonas_wilt': {
      symptoms: ['Progressive yellowing and wilting of leaves resembling scald', 'Premature uneven ripening and internal brown rot of fruit bunches', 'Bacterial yellow ooze from cut pseudostem or floral stalk', 'Wilting and blackening of male flower bud'],
      treatment: ['Debudding male flower using a forked stick (Single Diseased Stem Removal - SDSR)', 'Disinfect tools between plants, by flaming or with a disinfectant your extension officer recommends', 'Do not transport banana suckers or fruit from infected zones'],
      prevention: ['Remove male buds immediately after last hand forms', 'Use clean planting suckers or tissue culture plantlets', 'Fence orchards to keep livestock out'],
      description: 'Banana Xanthomonas wilt (BXW), caused by the bacterium Xanthomonas vasicola pv. musacearum, kills banana plants and has destroyed many highland banana farms in East Africa. Many countries control it by law, so report suspected cases.',
      susceptibleCrops: ['banana', 'plantain', 'enset'],
    },
    'fusarium_tr4': {
      symptoms: ['Yellowing of lower leaf margins progressing inward toward midrib', 'Splitting of pseudostem base near soil line', 'Dark brown to black vascular discoloration in internal corm tissue', 'Complete skirt collapse of dead leaves hanging around pseudostem'],
      treatment: ['No chemical or biological cure exists', 'Immediate strict quarantine containment: fence off site, burn infected stool in situ, treat soil with lime or urea'],
      prevention: ['Never import planting material from TR4-infested regions', 'Use verified tissue-culture plantlets', 'Clean and disinfect all footwear, vehicle tires, and tools with quaternary ammonium compounds'],
      description: 'Fusarium wilt Tropical Race 4 (Fusarium oxysporum f. sp. cubense TR4) kills Cavendish bananas and stays in the soil for decades. Many countries control it by law, so report suspected cases straight away.',
      susceptibleCrops: ['banana', 'plantain'],
    },
    'black_sigatoka': {
      symptoms: ['Small reddish-brown streaks parallel to leaf veins on underside', 'Streaks enlarge into dark brown to black elliptical spots with gray depressed centers', 'Coalescing lesions cause extensive leaf blade death', 'Premature ripening of bunches'],
      treatment: ['Apply a fungicide registered for this disease on your crop in your country, at the label rate and interval; rotate modes of action', 'Deleafing: prune out infected leaves and place them upside down on soil'],
      prevention: ['Improve drainage to reduce humidity', 'Plant Sigatoka-resistant hybrid cultivars', 'Ensure wider spacing for maximum airflow through canopy'],
      description: 'Black Sigatoka (Pseudocercospora fijiensis) is the most damaging leaf disease of bananas and plantains worldwide. It kills the green leaf the plant needs to fill its bunches.',
      susceptibleCrops: ['banana', 'plantain'],
    },
    'coffee_leaf_rust': {
      symptoms: ['Powdery orange-yellow spore pustules on leaf undersides', 'Chlorotic pale-yellow spots on upper leaf surfaces matching pustules', 'Premature heavy defoliation and branch dieback', 'Drastic yield loss in subsequent seasons'],
      treatment: ['Apply a fungicide registered for this disease on your crop in your country, at the label rate and interval, as your national coffee guide advises (usually protective, at the start of the rains)', 'Prune dead coffee branches'],
      prevention: ['Plant rust-resistant varieties recommended by your national coffee research institute', 'Ensure adequate shade management avoiding dense humidity', 'Apply balanced potassium and organic fertilizer'],
      description: 'Coffee leaf rust (Hemileia vastatrix) is the biggest disease threat to Arabica coffee worldwide. In humid, mid-altitude areas it can strip the trees of their leaves.',
      susceptibleCrops: ['coffee', 'arabica', 'robusta'],
    },
    'coffee_berry_disease': {
      symptoms: ['Dark brown sunken lesions on green expanding coffee berries', 'Mummification of green berries turning them hard, black, and shriveled', 'Premature berry drop leaving barren branches', 'Anthracnose lesions on young green twigs'],
      treatment: ['Apply a fungicide registered for this disease on your crop in your country, at the label rate and interval, from flowering as your national coffee guide advises', 'Strip mummified berries from trees and ground after harvest'],
      prevention: ['Plant CBD-resistant Arabica varieties recommended by your national coffee research institute', 'Prune coffee bushes annually to allow rapid drying of berry clusters after rain', 'Avoid overhead sprinkler irrigation'],
      description: 'Coffee berry disease (Colletotrichum kahawae) attacks young green berries and turns them into hollow, black, dried-up husks.',
      susceptibleCrops: ['coffee', 'arabica'],
    },
    'cocoa_swollen_shoot': {
      symptoms: ['Swelling on green stems, chupons, and tap roots', 'Red vein-banding and chlorotic flecking along leaf veins of flush leaves', 'Small rounded pods with smoothed surfaces and chlorotic blotches', 'Gradual dieback and death within 2 to 3 years'],
      treatment: ['No curative chemical treatment exists', 'Cut out infected trees and the trees touching them, as your national cocoa board directs'],
      prevention: ['Plant CSSVD-tolerant cocoa hybrids', 'Control mealybug vectors and attend ant colonies', 'Plant protective barrier borders of oil palm or citrus around cocoa plantations'],
      description: 'Cocoa swollen shoot virus disease (CSSVD) is spread by mealybugs and is a major threat to cocoa in West Africa. Infected trees have to be cut out to stop it spreading.',
      susceptibleCrops: ['cocoa', 'cacao'],
    },
    'citrus_greening': {
      symptoms: ['Asymmetrical blotchy mottle chlorosis on leaves across veins', 'Yellow shoots appearing in canopy (yellow dragon)', 'Small, lopsided, hard bitter fruit with dark aborted seeds', 'Fruit remains green at stylar end (inversion of color break)'],
      treatment: ['No cure for infected trees; immediate tree removal and destruction to prevent vector acquisition', 'Suppress the Asian citrus psyllid (Diaphorina citri) with a product registered for citrus, as your national programme directs'],
      prevention: ['Plant only certified disease-free nursery stock from insect-proof screenhouses', 'Monitor citrus groves with yellow sticky traps for psyllid vectors', 'Enforce strict regional quarantine'],
      description: 'Citrus greening, or Huanglongbing (HLB), is caused by Candidatus Liberibacter bacteria spread by small insects called psyllids. It ruins the fruit and slowly kills the trees.',
      susceptibleCrops: ['citrus', 'orange', 'lemon'],
    },
    'tomato_yellow_leaf_curl': {
      symptoms: ['Upward curling and cupping of leaflet margins', 'Prominent chlorosis and yellowing of leaf edges', 'Stunting of plants with bushy upright habit', 'Heavy flower drop and failure to set fruit'],
      treatment: ['No curative chemical treatment for begomoviruses', 'Remove and bag infected plants early to suppress virus reservoirs', 'Control the insect vectors only where your local guide advises it, with a product registered for your crop, at the label rate'],
      prevention: ['Raise seedlings under insect-proof netting', 'Plant TYLCV-resistant hybrid tomato cultivars', 'Keep a tomato-free break in the area, as your local guide advises'],
      description: 'Tomato yellow leaf curl virus (TYLCV) is spread by whiteflies (Bemisia tabaci). The leaves curl up badly and the flowers drop, so little or no fruit sets.',
      susceptibleCrops: ['tomato', 'solanaceae'],
    },
    'desert_locust': {
      symptoms: ['Total defoliation of crop canopy overnight', 'Stripped bark and severed flower stalks', 'Dense swarms or hopper bands present on field vegetation', 'Chewed grain heads and stripped leaves leaving bare stems'],
      treatment: ['Report immediately to national Locust Control Unit / FAO DLIS', 'Control is run by the national locust unit, with biopesticides (Metarhizium acridum) or products it has approved; do not spray locusts yourself', 'Community mechanical trenching for non-flying hopper bands'],
      prevention: ['Regional satellite weather monitoring for soil moisture and green vegetation in desert breeding zones', 'Early warning reporting through the national locust unit'],
      description: 'The desert locust (Schistocerca gregaria) travels in huge swarms across borders. Each locust can eat its own weight in fresh plants every day.',
      susceptibleCrops: ['general', 'maize', 'sorghum', 'millet'],
    },
    'striga_weed': {
      symptoms: ['Host crop severe stunting, chlorosis, and drought-like wilting despite moist soil', 'Clusters of bright pink, purple, or red flowered parasitic plants emerging at base of cereal stalks', 'Massive yield collapse before weed even flowers'],
      treatment: ['Hand-pull and burn Striga plants before seed set', 'Plant imazapyr-resistant (IR) maize with its herbicide seed coating, where available'],
      prevention: ['Adopt Push-Pull technology: intercrop cereal with Silverleaf Desmodium (produces allelochemical suicidal germination)', 'Rotate with non-host trap crops (soybean, cotton, cowpea)', 'Increase soil organic matter and nitrogen fertility'],
      description: 'Striga, or witchweed (Striga hermonthica), is a weed that can only live on another plant. It attaches to the roots of cereals and steals their water and food.',
      susceptibleCrops: ['maize', 'sorghum', 'millet', 'sugarcane'],
    },
    'anthracnose_mango': {
      symptoms: ['Small dark brown to black irregular spots on young leaves and blossoms', 'Blossom blight causing flower drop and aborted fruit set', 'Sunken black circular lesions on maturing fruit with tear-stain streaks', 'Post-harvest rapid rot in storage'],
      treatment: ['Apply a fungicide registered for this disease on your crop in your country, at the label rate and interval, at flowering and fruit set', 'Post-harvest hot water treatment of fruit, at the temperature and time your national mango guide gives', 'Prune out dead diseased twigs before rainy season'],
      prevention: ['Ensure open canopy pruning for air circulation and sunlight penetration', 'Avoid sprinkler irrigation hitting canopy', 'Harvest with clean shears leaving short stems'],
      description: 'Mango anthracnose (Colletotrichum gloeosporioides) attacks the flowers, leaves and fruit. On fruit it stays hidden until the mango ripens.',
      susceptibleCrops: ['mango', 'avocado', 'papaya'],
    },
    'downy_mildew': {
      symptoms: ['Chlorotic pale yellow stripes on leaves extending from base', 'Downy white-gray fungal growth on underside of leaves in cool, humid mornings', 'Crazy top: proliferation of vegetative leafy structures in tassel or ear', 'Stunting and sterility'],
      treatment: ['Apply a fungicide registered for this disease on your crop in your country, at the label rate and interval, as a seed treatment or spray', 'Rogue out chlorotic and crazy-top infected plants before downy sporulation'],
      prevention: ['Use certified seed treated against downy mildew', 'Plant downy mildew-resistant cultivars', 'Ensure well-drained soil and avoid waterlogging', 'Avoid continuous cereal rotations'],
      description: 'Downy mildew (Peronosclerospora and Pseudoperonospora species) turns leaves pale yellow throughout the plant, and in cereals can make the flower heads grow leaves instead of grain.',
      susceptibleCrops: ['maize', 'sorghum', 'cucurbits', 'onion'],
    },
  };

  async analyzeImage(imageData: string | Buffer, cropType?: string): Promise<PlantImageAnalysis> {
    try {
      let base64Image: string;
      if (Buffer.isBuffer(imageData)) {
        base64Image = imageData.toString('base64');
      } else if (typeof imageData === 'string' && imageData.startsWith('data:image/')) {
        base64Image = imageData.split(',')[1];
      } else {
        base64Image = imageData as string;
      }

      const cropSpecifier = cropType && cropType.trim() && cropType.toLowerCase() !== 'all' && cropType.toLowerCase() !== 'unspecified'
        ? `Target crop identified: ${cropType.trim()}. Focus specifically on known pathology, physiological stress markers, and nutrient dynamics for ${cropType.trim()}.`
        : 'Analyze the specimen leaf image across known crop pathology and plant physiology.';

      const prompt = `You are a professional agricultural plant pathologist and crop extension specialist.
${cropSpecifier}
Provide a diagnostic analysis in JSON format. The JSON MUST strictly match the following schema:
{
  "overallHealth": "healthy" | "stressed" | "diseased",
  "diseases": [
    {
      "disease": "Disease Name",
      "confidence": number (between 0 and 100),
      "severity": "mild" | "moderate" | "severe",
      "description": "Short explanation",
      "symptoms": ["symptom 1", "symptom 2"],
      "treatment": ["treatment 1", "treatment 2"],
      "prevention": ["prevention 1", "prevention 2"]
    }
  ],
  "nutrientDeficiencies": ["Deficiency 1"],
  "recommendations": ["Recommendation 1"],
  "confidence": number (overall analysis confidence, 0 to 100)
}
IMPORTANT GUIDELINES:
- A photograph alone cannot confirm a disease, nutrient deficiency or abiotic stress cause. Describe visible symptoms and label possible causes as unconfirmed; do not infer an exact nutrient deficiency from appearance alone.
- Write "description", "symptoms" and "recommendations" in plain, everyday words a farmer understands: short sentences, and any technical or Latin term followed by a plain explanation.
- Give low-risk observation and prevention steps suited to the target crop. Do not prescribe pesticides, fertilizer, foliar sprays, doses, mixtures or harvest/re-entry intervals. Leave treatment empty pending field confirmation and applicable local authorization.
- Return ONLY the JSON object, surrounded by \`\`\`json and \`\`\`. Do not write any conversational text.`;

      const result = await AIRouter.routeRequest('vision', {
        imageData: base64Image,
        prompt,
        options: { temperature: 0.2, maxTokens: 3000 },
      });
      const generatedAt = new Date().toISOString();
      const providerName = resolveVisionProvider(result?.provider);
      const modelName = result?.model || null;
      const provenance = createProvenance(`AI vision analysis via ${providerName}`, generatedAt, {
        provider: providerName,
        model: modelName,
      });
      const rawAnalysis = typeof result === 'string' ? result : (result?.analysis || JSON.stringify(result));
      const parsed = this.parseJSONResponse<PlantImageAnalysis>(rawAnalysis);

      if (parsed) {
        return this.normalizeImageAnalysis(parsed, provenance);
      }

      return this.generateFallbackAnalysis(provenance);
    } catch (error) {
      logger.error('Plant disease analysis failed:', error);
      return this.generateFallbackAnalysis(
        createProvenance('AI vision analysis unavailable; no verified source', new Date().toISOString())
      );
    }
  }

  /** Alias for analyzeImage for contract compatibility */
  async analyzePlantImage(imageData: string | Buffer, cropType?: string): Promise<PlantImageAnalysis> {
    return this.analyzeImage(imageData, cropType);
  }

  async analyzeSoilImage(imageData: string | Buffer, details?: any): Promise<SoilAnalysisResult> {
    try {
      let base64Image: string;
      if (Buffer.isBuffer(imageData)) {
        base64Image = imageData.toString('base64');
      } else if (typeof imageData === 'string' && imageData.startsWith('data:image/')) {
        base64Image = imageData.split(',')[1];
      } else {
        base64Image = imageData as string;
      }

      const prompt = `You are an expert soil scientist and agronomist. Analyze this soil sample photo.
Optional farm / regional details: ${JSON.stringify(details || {})}
Provide a detailed soil analysis in JSON format. The JSON MUST strictly match the following schema:
{
  "overallHealthScore": number (0 to 100),
  "texture": "Texture class (e.g. Sandy Loam, Clay, Silt, etc.)",
  "estimatedMoisture": "Estimated moisture level (e.g. Optimal, Dry, Waterlogged)",
  "drainageClass": "Drainage class (e.g. Well-drained, Poorly-drained)",
  "colorDiscoloration": "Color and discoloration details",
  "npkDeficiencies": {
    "nitrogen": "low" | "optimal" | "high",
    "phosphorus": "low" | "optimal" | "high",
    "potassium": "low" | "optimal" | "high"
  },
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "cropSuitability": ["Suitable Crop 1", "Suitable Crop 2"],
  "confidence": number (overall analysis confidence, 0 to 100)
}
IMPORTANT: Return ONLY the JSON object, surrounded by \`\`\`json and \`\`\`. Do not write any conversational text.`;

      const result = await AIRouter.routeRequest('vision', {
        imageData: base64Image,
        prompt,
        options: { temperature: 0.2, maxTokens: 3000 },
      });
      const generatedAt = new Date().toISOString();
      const providerName = resolveVisionProvider(result?.provider);
      const modelName = result?.model || null;
      const provenance = createProvenance(`AI soil image analysis via ${providerName}`, generatedAt, {
        provider: providerName,
        model: modelName,
      });
      const rawAnalysis = typeof result === 'string' ? result : (result?.analysis || JSON.stringify(result));
      const parsed = this.parseJSONResponse<SoilAnalysisResult>(rawAnalysis);

      if (parsed) {
        return this.normalizeSoilAnalysis(parsed, provenance);
      }

      return this.generateFallbackSoilAnalysis(provenance);
    } catch (error) {
      logger.error('Soil analysis failed:', error);
      return this.generateFallbackSoilAnalysis(
        createProvenance('AI soil image analysis unavailable; no verified source', new Date().toISOString())
      );
    }
  }

  private normalizeImageAnalysis(
    analysis: PlantImageAnalysis,
    provenance: DiagnosticProvenance
  ): PlantImageAnalysis {
    const confidence = normalizeConfidence(analysis.confidence);
    const reviewStatus = getReviewStatus(confidence, provenance.evidenceStatus);
    const nutrientDeficiencies = (Array.isArray(analysis.nutrientDeficiencies) ? analysis.nutrientDeficiencies : [])
      .map(screenObservation)
      .filter((observation): observation is string => observation !== undefined);
    return {
      ...analysis,
      confidence,
      reviewStatus,
      provenance,
      nutrientDeficiencies,
      recommendations: [
        ...IMAGE_REVIEW_GUIDANCE,
        ...(analysis.overallHealth === 'stressed' || nutrientDeficiencies.length
          ? STRESS_REVIEW_GUIDANCE : []),
      ],
      diseases: (analysis.diseases ?? []).map(disease => {
        const diseaseConfidence = normalizeConfidence(disease.confidence);
        return {
          ...disease,
          description: screenObservation(disease.description) ?? '',
          symptoms: (Array.isArray(disease.symptoms) ? disease.symptoms : [])
            .map(screenObservation)
            .filter((observation): observation is string => observation !== undefined),
          confidence: diseaseConfidence,
          reviewStatus: getReviewStatus(diseaseConfidence, provenance.evidenceStatus),
          provenance,
          safetyNotice: DIAGNOSTIC_SAFETY_NOTICE,
          treatment: [WITHHELD_TREATMENT],
          prevention: [...GENERAL_PREVENTION],
        };
      }),
    };
  }

  private normalizeSoilAnalysis(
    analysis: SoilAnalysisResult,
    provenance: DiagnosticProvenance
  ): SoilAnalysisResult {
    const confidence = normalizeConfidence(analysis.confidence);
    return {
      ...analysis,
      overallHealthScore:
        typeof analysis.overallHealthScore === 'number'
          ? Math.max(0, Math.min(100, analysis.overallHealthScore))
          : null,
      confidence,
      reviewStatus: getReviewStatus(confidence, provenance.evidenceStatus),
      recommendations: [...SOIL_REVIEW_GUIDANCE],
      provenance,
      npkDeficiencies: {
        nitrogen: analysis.npkDeficiencies?.nitrogen ?? 'unknown',
        phosphorus: analysis.npkDeficiencies?.phosphorus ?? 'unknown',
        potassium: analysis.npkDeficiencies?.potassium ?? 'unknown',
      },
    };
  }

  private parseJSONResponse<T>(content: unknown): T | null {
    if (!content) return null;
    if (typeof content === 'object') return content as T;
    if (typeof content !== 'string') return null;

    try {
      let rawJson = content.trim();

      // 1. Try markdown code block with optional json/JSON tag
      const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
      const match = rawJson.match(jsonBlockRegex);
      if (match && match[1]) {
        rawJson = match[1].trim();
      }

      // 2. Extract outermost { ... }
      const firstBrace = rawJson.indexOf('{');
      const lastBrace = rawJson.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        rawJson = rawJson.substring(firstBrace, lastBrace + 1);
      }

      // 3. Clean trailing commas and common comments
      const cleanedJson = rawJson
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/\/\/[^\n\r]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');

      return JSON.parse(cleanedJson) as T;
    } catch (e) {
      logger.error('JSON parsing from vision provider response failed. Content:', content, e);
      try {
        const str = content as string;
        const firstBrace = str.indexOf('{');
        const lastBrace = str.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          return JSON.parse(str.substring(firstBrace, lastBrace + 1)) as T;
        }
      } catch {
        // secondary parse error ignored
      }
      return null;
    }
  }

  private generateFallbackSoilAnalysis(
    provenance: DiagnosticProvenance
  ): SoilAnalysisResult {
    return {
      overallHealthScore: null,
      texture: 'Unavailable',
      estimatedMoisture: 'Unavailable',
      drainageClass: 'Unavailable',
      colorDiscoloration: 'Analysis unavailable',
      npkDeficiencies: {
        nitrogen: 'unknown',
        phosphorus: 'unknown',
        potassium: 'unknown',
      },
      recommendations: [
        'Upload a clearer soil image with even lighting',
        'Use a physical laboratory NPK test for verified soil measurements',
      ],
      cropSuitability: [],
      confidence: 0,
      reviewStatus: 'needs_expert_review',
      provenance,
    };
  }

  private tokenize(text: string): string[] {
    const stopwords = new Set(['on', 'of', 'and', 'the', 'with', 'a', 'or', 'in', 'to', 'for', 'at', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'an']);
    return text
      .toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopwords.has(word));
  }

  private vectorize(tokens: string[], vocab: string[], idf: Record<string, number>): number[] {
    const tf: Record<string, number> = {};
    for (const t of tokens) {
      tf[t] = (tf[t] || 0) + 1;
    }
    return vocab.map(term => {
      const termTf = tf[term] || 0;
      return termTf * (idf[term] || 0);
    });
  }

  private buildTFIDFVectors() {
    const documents = Object.entries(PlantDiseaseService.DISEASE_DATABASE).map(([id, info]) => {
      const tokens = this.tokenize(info.symptoms.join(' ') + ' ' + info.description);
      return { id, tokens, info };
    });

    const vocabularySet = new Set<string>();
    for (const doc of documents) {
      for (const token of doc.tokens) {
        vocabularySet.add(token);
      }
    }
    const vocab = Array.from(vocabularySet);

    const N = documents.length;
    const idf: Record<string, number> = {};
    for (const term of vocab) {
      const df = documents.filter(doc => doc.tokens.includes(term)).length;
      idf[term] = Math.log((N + 1) / (df + 1)) + 1;
    }

    const docVectors: Record<string, number[]> = {};
    for (const doc of documents) {
      docVectors[doc.id] = this.vectorize(doc.tokens, vocab, idf);
    }

    return { vocab, idf, docVectors };
  }

  private cosineSimilarity(v1: number[], v2: number[]): number {
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;
    for (let i = 0; i < v1.length; i++) {
      dotProduct += v1[i] * v2[i];
      mag1 += v1[i] * v1[i];
      mag2 += v2[i] * v2[i];
    }
    if (mag1 === 0 || mag2 === 0) return 0;
    return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
  }

  async diagnoseFromSymptoms(symptoms: string[], cropType?: string): Promise<DiseaseDiagnosis[]> {
    const queryText = symptoms.join(' ');
    const queryTokens = this.tokenize(queryText);
    const normalizedCrop = cropType ? cropType.trim().toLowerCase() : null;
    
    const { vocab, idf, docVectors } = this.buildTFIDFVectors();
    const queryVector = this.vectorize(queryTokens, vocab, idf);

    const diagnoses: DiseaseDiagnosis[] = [];

    for (const [diseaseId, diseaseInfo] of Object.entries(PlantDiseaseService.DISEASE_DATABASE)) {
      if (!this.isCropCompatible(diseaseInfo.susceptibleCrops, normalizedCrop)) continue;

      const docVector = docVectors[diseaseId];
      const similarity = this.cosineSimilarity(queryVector, docVector);

      if (similarity > 0.05) {
        const matchedSymptoms = diseaseInfo.symptoms.filter(symptom => {
          const symptomTokens = this.tokenize(symptom);
          return symptomTokens.some(tok => queryTokens.includes(tok));
        });

        const confidence = normalizeConfidence(similarity);
        const provenance = createProvenance(
          'Internal heuristic knowledge base (TF-IDF symptom keyword matcher) — not a laboratory or field-verified source',
          new Date().toISOString(),
          { evidenceStatus: 'no_verified_source', model: 'tfidf-symptom-matcher' }
        );
        diagnoses.push({
          disease: diseaseId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          confidence,
          reviewStatus: getReviewStatus(confidence, provenance.evidenceStatus),
          provenance,
          safetyNotice: DIAGNOSTIC_SAFETY_NOTICE,
          severity: this.getSymptomSeverity(similarity),
          description: diseaseInfo.description,
          symptoms: matchedSymptoms.length > 0 ? matchedSymptoms : [diseaseInfo.symptoms[0]],
          treatment: [WITHHELD_TREATMENT],
          prevention: [...GENERAL_PREVENTION],
        });
      }
    }

    diagnoses.sort((a, b) => b.confidence - a.confidence);
    return diagnoses.slice(0, 3);
  }

  private getSymptomSeverity(similarity: number): DiseaseDiagnosis['severity'] {
    if (similarity > 0.7) return 'severe';
    return similarity > 0.4 ? 'moderate' : 'mild';
  }

  private isCropCompatible(susceptibleCrops: string[], normalizedCrop: string | null): boolean {
    if (!normalizedCrop) return true;
    return susceptibleCrops.some(c =>
      c === 'general' || normalizedCrop.includes(c) || c.includes(normalizedCrop)
    );
  }

  /** Alias for diagnoseFromSymptoms for caller contract flexibility */
  async diagnosePlant(symptoms: string[], cropType?: string): Promise<DiseaseDiagnosis[]> {
    return this.diagnoseFromSymptoms(symptoms, cropType);
  }

  getDiseaseInfo(diseaseId: string): (typeof PlantDiseaseService.DISEASE_DATABASE[string] & { disease: string }) | null {
    // Accept raw ids ('late_blight') and the prettified names getAllDiseases()
    // emits ('Late Blight') — the HTTP route forwards user-facing names verbatim.
    const key = PlantDiseaseService.DISEASE_DATABASE[diseaseId]
      ? diseaseId
      : diseaseId.toLowerCase().replace(/\s+/g, '_');
    const entry = PlantDiseaseService.DISEASE_DATABASE[key];
    if (!entry) return null;
    return {
      disease: PlantDiseaseService.prettifyDiseaseId(key), ...entry,
      treatment: [WITHHELD_TREATMENT], prevention: [...GENERAL_PREVENTION],
    };
  }

  /** Alias for getDiseaseInfo for caller contract flexibility */
  getDiseaseDetails(diseaseId: string): (typeof PlantDiseaseService.DISEASE_DATABASE[string] & { disease: string }) | null {
    return this.getDiseaseInfo(diseaseId);
  }

  private static prettifyDiseaseId(id: string): string {
    return id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  getAllDiseases(): string[] {
    return Object.keys(PlantDiseaseService.DISEASE_DATABASE).map(id =>
      PlantDiseaseService.prettifyDiseaseId(id)
    );
  }

  private generateFallbackAnalysis(
    provenance: DiagnosticProvenance
  ): PlantImageAnalysis {
    return {
      overallHealth: 'unknown',
      diseases: [],
      nutrientDeficiencies: [],
      recommendations: [
        'Analysis was unavailable; do not treat this as a diagnosis',
        'Provide clear photos of affected plant parts for another attempt',
        'Consider an in-person agronomist or laboratory assessment',
      ],
      confidence: 0,
      reviewStatus: 'needs_expert_review',
      provenance,
    };
  }
}

export const plantDiseaseService = new PlantDiseaseService();
/** Size of the internal symptom corpus — surfaced to callers so heuristic scope is explicit. */
export const PLANT_DISEASE_CORPUS_SIZE = Object.keys((PlantDiseaseService as unknown as { DISEASE_DATABASE: Record<string, unknown> }).DISEASE_DATABASE).length;
