/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '@/utils/logger';
import { AIProviderFactory, AIRouter } from '@/services/aiProvider/aiProvider';

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
  'General guidance only. Confirm the diagnosis with a qualified agronomist and follow locally approved product labels before treatment.';

function normalizeConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const normalized = value > 1 ? value / 100 : value;
  return Math.max(0, Math.min(1, normalized));
}

function getReviewStatus(confidence: number): DiagnosticReviewStatus {
  return normalizeConfidence(confidence) >= DIAGNOSTIC_REVIEW_THRESHOLD ? 'ready' : 'needs_expert_review';
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
      treatment: ['Apply copper-based fungicide immediately', 'Remove and destroy infected plant parts', 'Apply mancozeb as preventive spray', 'Ensure proper spacing for air circulation'],
      prevention: ['Use resistant varieties', 'Avoid overhead irrigation', 'Rotate crops every 3 years', 'Apply preventive fungicide during humid weather'],
      description: 'Late blight (Phytophthora infestans) is a devastating disease affecting tomatoes and potatoes. It spreads rapidly in cool, wet conditions.',
      susceptibleCrops: ['tomato', 'potato', 'solanaceae'],
    },
    'powdery_mildew': {
      symptoms: ['White powdery coating on leaves', 'Yellowing leaves', 'Distorted new growth', 'Premature leaf drop'],
      treatment: ['Apply sulfur-based fungicide', 'Use neem oil spray (2ml/L water)', 'Apply potassium bicarbonate solution', 'Remove severely infected leaves'],
      prevention: ['Ensure good air circulation', 'Avoid overhead watering', 'Plant resistant varieties', 'Apply preventive sulfur spray'],
      description: 'Powdery mildew is a common fungal disease that affects many crops. It thrives in warm, dry conditions with high humidity at night.',
      susceptibleCrops: ['cucurbits', 'squash', 'grapes', 'apple', 'pea', 'tomato', 'general'],
    },
    'bacterial_wilt': {
      symptoms: ['Sudden wilting of entire plant', 'Yellowing of lower leaves', 'Brown discoloration in stem vascular tissue', 'Plant death within days'],
      treatment: ['No effective chemical treatment available', 'Remove and destroy infected plants', 'Apply copper sulfate to surrounding soil', 'Solarize soil in affected area'],
      prevention: ['Use resistant varieties', 'Rotate crops', 'Ensure well-drained soil', 'Avoid planting in previously infected areas'],
      description: 'Bacterial wilt (Ralstonia solanacearum) causes sudden wilting and death. It persists in soil for years and spreads through water and contaminated tools.',
      susceptibleCrops: ['tomato', 'potato', 'banana', 'eggplant', 'pepper'],
    },
    'leaf_spot': {
      symptoms: ['Circular brown spots on leaves', 'Yellow halos around spots', 'Spots may merge causing leaf death', 'Premature defoliation'],
      treatment: ['Apply chlorothalonil fungicide', 'Remove infected leaves', 'Apply copper-based spray', 'Improve air circulation'],
      prevention: ['Avoid overhead irrigation', 'Space plants properly', 'Remove plant debris', 'Use disease-free seeds'],
      description: 'Leaf spot diseases are caused by various fungi and bacteria. They reduce photosynthetic area and can significantly impact yield.',
      susceptibleCrops: ['bean', 'groundnut', 'maize', 'cabbage', 'general'],
    },
    'rust': {
      symptoms: ['Orange-brown pustules on leaf undersides', 'Yellow spots on upper leaf surface', 'Premature leaf drop', 'Reduced yield'],
      treatment: ['Apply triazole fungicide', 'Remove infected leaves', 'Apply sulfur spray', 'Use systemic fungicide for severe cases'],
      prevention: ['Plant resistant varieties', 'Ensure proper spacing', 'Avoid excessive nitrogen', 'Monitor fields regularly'],
      description: 'Rust diseases affect many cereal and legume crops. They reduce photosynthetic capacity and can cause significant yield losses.',
      susceptibleCrops: ['maize', 'beans', 'wheat', 'coffee', 'sorghum'],
    },
    'mosaic_virus': {
      symptoms: ['Mottled yellow-green pattern on leaves', 'Stunted growth', 'Distorted leaves', 'Reduced fruit size'],
      treatment: ['No cure for viral diseases', 'Remove and destroy infected plants', 'Control insect vectors (aphids)', 'Use virus-free seeds'],
      prevention: ['Use certified virus-free seeds', 'Control aphid populations', 'Practice good hygiene', 'Remove weeds that host viruses'],
      description: 'Mosaic viruses are spread by insects and contaminated tools. Once infected, plants cannot be cured and must be removed.',
      susceptibleCrops: ['cassava', 'maize', 'tomato', 'tobacco', 'cucumber'],
    },
    'fall_armyworm': {
      symptoms: ['Window-pane feeding marks on leaf whorls', 'Ragged holes in leaves with sawdust-like frass', 'Caterpillar inside vegetative whorl', 'Destroyed tassel or ear'],
      treatment: ['Apply emamectin benzoate or chlorantraniliprole', 'Apply neem seed kernel extract (NSKE 5%)', 'Handpick egg masses and larvae in early stages', 'Apply sand or wood ash into leaf whorls'],
      prevention: ['Plant early with first rains', 'Intercrop maize with desmodium or legumes', 'Push-pull technology using Napier grass', 'Monitor field weekly for egg batches'],
      description: 'Fall armyworm (Spodoptera frugiperda) is an invasive Lepidopteran pest causing severe defoliation in cereals across Africa and Asia.',
      susceptibleCrops: ['maize', 'sorghum', 'millet', 'rice', 'sugarcane'],
    },
    'maize_lethal_necrosis': {
      symptoms: ['Severe chlorotic mottle and mosaic on leaves', 'Drying of leaf margins progressing to whole leaf necrosis', 'Premature plant death and dead heart', 'Small deformed cobs with no grain set'],
      treatment: ['No curative chemical treatment', 'Immediate uprooting and rogueing of infected plants', 'Control insect vectors (thrips and chrysomelid beetles) with approved pyrethroids', 'Enforce strict field quarantine'],
      prevention: ['Plant certified disease-free hybrid seed', 'Observe maize-free break seasons', 'Rotate with non-cereal crops such as cassava or legumes', 'Do not recycle grain as seed'],
      description: 'Maize Lethal Necrosis Disease (MLND) is a devastating synergistic coinfection of Maize Chlorotic Mottle Virus (MCMV) with a potyvirus (SCMV), regulated as a biosecurity quarantine priority.',
      susceptibleCrops: ['maize'],
    },
    'maize_streak_virus': {
      symptoms: ['Continuous narrow chlorotic streaks along leaf veins', 'Stunted growth and internode shortening', 'Failure of tassel emergence', 'Sterile or poorly formed cobs'],
      treatment: ['No cure once plants are infected', 'Rogue infected seedlings early', 'Spray approved systemic insecticides for leafhopper vectors if threshold exceeded'],
      prevention: ['Plant streak-resistant seed varieties', 'Treat seed with imidacloprid before planting', 'Eliminate grassy weeds around field borders', 'Avoid late staggered plantings'],
      description: 'Maize Streak Virus (MSV) is transmitted by leafhoppers (Cicadulina mbila) and is one of the most widespread viral constraints to African maize production.',
      susceptibleCrops: ['maize', 'wheat', 'barley'],
    },
    'gray_leaf_spot': {
      symptoms: ['Rectangular necrotic lesions delimited by leaf veins', 'Tan to grayish lesions on lower leaves', 'Premature blighting of canopy', 'Stalk rot and lodging'],
      treatment: ['Apply azoxystrobin or pyraclostrobin strobilurin fungicide', 'Apply triazole (propiconazole) at tasseling stage if lesions reach ear leaf', 'Remove infected lower leaves in small plots'],
      prevention: ['Plow under crop residue to accelerate decomposition', 'Select resistant hybrids', 'Rotate with non-grass crops', 'Avoid high plant densities'],
      description: 'Gray Leaf Spot (Cercospora zeae-maydis) causes rectangular foliar lesions that coalesce, causing rapid blighting during warm, humid conditions.',
      susceptibleCrops: ['maize'],
    },
    'rice_blast': {
      symptoms: ['Spindle-shaped elliptical lesions with gray centers and brown margins on leaves', 'Rotten neck where panicle node turns black and breaks', 'White empty panicles', 'Collar rot'],
      treatment: ['Apply tricyclazole or isoprothiolane fungicide', 'Apply azoxystrobin at early heading', 'Drain standing water temporarily in flooded paddies'],
      prevention: ['Use blast-resistant certified cultivars', 'Avoid excessive nitrogenous fertilizer application', 'Treat seed with fungicide before sowing', 'Maintain balanced potassium nutrition'],
      description: 'Rice Blast (Magnaporthe oryzae) is the most destructive disease of cultivated rice worldwide, attacking foliage, stems, nodes, and panicles.',
      susceptibleCrops: ['rice', 'paddy'],
    },
    'rice_bacterial_blight': {
      symptoms: ['Water-soaked lesions on leaf margins turning wavy yellow-white stripes', 'Bacterial ooze droplets on young lesions in morning', 'Kresek wilt in young seedlings', 'Premature grain sterility'],
      treatment: ['No effective chemical cure; copper bactericides give limited suppression', 'Drain deep standing water', 'Avoid field-to-field irrigation flow from diseased fields'],
      prevention: ['Plant resistant rice varieties carrying Xa genes', 'Ensure balanced NPK fertilization avoiding nitrogen excess', 'Keep field borders clear of wild host grasses', 'Dry seeds thoroughly'],
      description: 'Bacterial Blight of Rice (Xanthomonas oryzae pv. oryzae) enters leaves through hydathodes or wounds, causing severe vascular scorch in irrigated lowlands.',
      susceptibleCrops: ['rice', 'paddy'],
    },
    'sorghum_anthracnose': {
      symptoms: ['Circular to elliptical red, orange, or black lesions on foliage', 'Black fruiting bodies (acervuli) inside lesions', 'Stalk rot and peduncle breakage', 'Grain discoloration'],
      treatment: ['Apply azoxystrobin or tebuconazole spray if economic threshold met', 'Harvest early if stalk rot threatens lodging'],
      prevention: ['Plant certified disease-free resistant seed', 'Deep plow infected crop residue', 'Rotate with cotton, groundnut, or cowpea', 'Avoid continuous sorghum cultivation'],
      description: 'Sorghum Anthracnose (Colletotrichum sublineolum) infects leaves, stalks, and panicles in warm, humid sorghum-producing zones.',
      susceptibleCrops: ['sorghum', 'millet'],
    },
    'bean_anthracnose': {
      symptoms: ['Dark brick-red to black sunken lesions along leaf veins on undersides', 'Sunken circular cankers with raised reddish borders on pods', 'Salmon-colored spore masses in moist weather', 'Seed discoloration'],
      treatment: ['Spray copper hydroxide or chlorothalonil fungicide', 'Remove and burn severely infected plants', 'Avoid entering fields when foliage is wet'],
      prevention: ['Use certified disease-free seed', 'Implement 2- to 3-year crop rotations with maize or sweet potato', 'Plow under bean stubble after harvest', 'Use resistant common bean varieties'],
      description: 'Bean Anthracnose (Colletotrichum lindemuthianum) is a seed-borne fungal pathogen causing devastating losses in humid, cool bean-growing regions.',
      susceptibleCrops: ['bean', 'legumes'],
    },
    'groundnut_rosette': {
      symptoms: ['Extreme bushiness and stunting of plant', 'Chlorotic yellowing or dark-green mottling on leaves', 'Thickened curled leaflets', 'Severely reduced pod set and aborted kernels'],
      treatment: ['No chemical cure for viral rosette complex', 'Rogue out chlorotic or stunted seedlings within first 45 days', 'Spray systemic insecticides for aphid control if vector swarms appear'],
      prevention: ['Plant early at close spacing (high plant density) to suppress aphid vector landings', 'Plant rosette-resistant groundnut varieties', 'Control groundnut volunteer plants'],
      description: 'Groundnut Rosette Disease (GRD) is a tripartite viral complex transmitted by the cowpea aphid (Aphis craccivora), causing catastrophic yield collapse.',
      susceptibleCrops: ['groundnut', 'peanut'],
    },
    'common_bacterial_blight': {
      symptoms: ['Small water-soaked spots on leaves expanding into large brown necrotic areas', 'Bright lemon-yellow halos around leaf lesions', 'Greasy circular water-soaked sunken spots on bean pods', 'Stem girdling'],
      treatment: ['Apply copper bactericide sprays at 7-10 day intervals', 'Do not cultivate or harvest while plants are wet with dew or rain'],
      prevention: ['Plant certified pathogen-free bean seeds', 'Rotate with non-host crops for at least 2 seasons', 'Destroy volunteer legumes and infected crop residues'],
      description: 'Common Bacterial Blight (Xanthomonas axonopodis pv. phaseoli) is a major seed-borne bacterial threat to common bean production in warm tropical climates.',
      susceptibleCrops: ['bean', 'legumes'],
    },
    'cassava_brown_streak': {
      symptoms: ['Feathery chlorosis and yellow vein-banding on mature lower leaves', 'Brown necrotic streaks on green stem surfaces', 'Dry brown-black corky rot inside storage roots', 'Root constriction and cracking'],
      treatment: ['No chemical cure', 'Immediate rogueing and destruction of infected plants', 'Harvest early before root necroses progress completely across storage tissue'],
      prevention: ['Use virus-indexed clean stem cuttings from certified tissue culture nurseries', 'Control whitefly populations with biocontrol or selective insecticides', 'Plant CBSD-tolerant clones'],
      description: 'Cassava Brown Streak Disease (CBSD), caused by ipomoviruses and vectored by Bemisia tabaci whiteflies, produces hidden root necrosis destroying food and processing value.',
      susceptibleCrops: ['cassava'],
    },
    'early_blight': {
      symptoms: ['Concentric dark rings (target board pattern) on older leaves', 'Yellowing of tissue surrounding concentric spots', 'Stem collar rot on seedlings', 'Dark leathery sunken spots on fruit'],
      treatment: ['Apply chlorothalonil, mancozeb, or difenoconazole fungicide', 'Remove lower blighted leaves to prevent splash dispersion', 'Ensure drip irrigation instead of overhead watering'],
      prevention: ['Practice minimum 3-year solanaceous crop rotation', 'Stake and trellis plants to elevate foliage', 'Mulch soil surface around base', 'Use certified disease-free seedlings'],
      description: 'Early Blight (Alternaria solani) attacks older senescing leaves first in tomatoes and potatoes, producing characteristic concentric target-board lesions.',
      susceptibleCrops: ['tomato', 'potato', 'solanaceae'],
    },
    'banana_xanthomonas_wilt': {
      symptoms: ['Progressive yellowing and wilting of leaves resembling scald', 'Premature uneven ripening and internal brown rot of fruit bunches', 'Bacterial yellow ooze from cut pseudostem or floral stalk', 'Wilting and blackening of male flower bud'],
      treatment: ['Debudding male flower using a forked stick (Single Diseased Stem Removal - SDSR)', 'Disinfect pruning tools with bleach (1:5 dilution) or fire', 'Do not transport banana suckers or fruit from infected zones'],
      prevention: ['Remove male buds immediately after last hand forms', 'Use clean planting suckers or tissue culture plantlets', 'Fence orchards to keep livestock out'],
      description: 'Banana Xanthomonas Wilt (BXW), caused by Xanthomonas vasicola pv. musacearum, is a high-consequence quarantine bacterial wilt decimating East African highland banana systems.',
      susceptibleCrops: ['banana', 'plantain', 'enset'],
    },
    'fusarium_tr4': {
      symptoms: ['Yellowing of lower leaf margins progressing inward toward midrib', 'Splitting of pseudostem base near soil line', 'Dark brown to black vascular discoloration in internal corm tissue', 'Complete skirt collapse of dead leaves hanging around pseudostem'],
      treatment: ['No chemical or biological cure exists', 'Immediate strict quarantine containment: fence off site, burn infected stool in situ, treat soil with lime or urea'],
      prevention: ['Never import planting material from TR4-infested regions', 'Use verified tissue-culture plantlets', 'Clean and disinfect all footwear, vehicle tires, and tools with quaternary ammonium compounds'],
      description: 'Fusarium Wilt Tropical Race 4 (Fusarium oxysporum f. sp. cubense TR4) is an existential sovereign biosecurity pathogen that kills Cavendish bananas and persists in soil for decades.',
      susceptibleCrops: ['banana', 'plantain'],
    },
    'black_sigatoka': {
      symptoms: ['Small reddish-brown streaks parallel to leaf veins on underside', 'Streaks enlarge into dark brown to black elliptical spots with gray depressed centers', 'Coalescing lesions cause extensive leaf blade death', 'Premature ripening of bunches'],
      treatment: ['Apply triazole, strobilurin, or mineral oil fungicides according to resistance management schedules', 'Deleafing: prune out infected leaves and place them upside down on soil'],
      prevention: ['Improve drainage to reduce humidity', 'Plant Sigatoka-resistant hybrid cultivars', 'Ensure wider spacing for maximum airflow through canopy'],
      description: 'Black Sigatoka (Pseudocercospora fijiensis) is the most destructive foliar fungal pathogen of bananas and plantains worldwide, significantly reducing photosynthetic green life.',
      susceptibleCrops: ['banana', 'plantain'],
    },
    'coffee_leaf_rust': {
      symptoms: ['Powdery orange-yellow spore pustules on leaf undersides', 'Chlorotic pale-yellow spots on upper leaf surfaces matching pustules', 'Premature heavy defoliation and branch dieback', 'Drastic yield loss in subsequent seasons'],
      treatment: ['Apply copper oxychloride preventive sprays at beginning of rainy season', 'Apply systemic triazole fungicides (cyproconazole, triadimefon) during active infection', 'Prune dead coffee branches'],
      prevention: ['Plant rust-resistant cultivars (e.g. Ruiru 11, Batian, Catimor)', 'Ensure adequate shade management avoiding dense humidity', 'Apply balanced potassium and organic fertilizer'],
      description: 'Coffee Leaf Rust (Hemileia vastatrix) is the premier global threat to Arabica coffee cultivation, causing catastrophic defoliation under humid mid-altitude conditions.',
      susceptibleCrops: ['coffee', 'arabica', 'robusta'],
    },
    'coffee_berry_disease': {
      symptoms: ['Dark brown sunken lesions on green expanding coffee berries', 'Mummification of green berries turning them hard, black, and shriveled', 'Premature berry drop leaving barren branches', 'Anthracnose lesions on young green twigs'],
      treatment: ['Spray copper-based fungicides or pyraclostrobin at 4-week intervals starting at flowering through pinhead stage', 'Strip mummified berries from trees and ground after harvest'],
      prevention: ['Plant CBD-resistant Arabica varieties (Ruiru 11, Batian)', 'Prune coffee bushes annually to allow rapid drying of berry clusters after rain', 'Avoid overhead sprinkler irrigation'],
      description: 'Coffee Berry Disease (Colletotrichum kahawae) attacks juvenile green berries directly, converting developing beans into hollow, black mummified husks.',
      susceptibleCrops: ['coffee', 'arabica'],
    },
    'cocoa_swollen_shoot': {
      symptoms: ['Swelling on green stems, chupons, and tap roots', 'Red vein-banding and chlorotic flecking along leaf veins of flush leaves', 'Small rounded pods with smoothed surfaces and chlorotic blotches', 'Gradual dieback and death within 2 to 3 years'],
      treatment: ['No curative chemical treatment exists', 'Cordon sanitaire eradication: cut out infected tree and immediate contact barrier trees, treating stumps with arboricide'],
      prevention: ['Plant CSSVD-tolerant cocoa hybrids', 'Control mealybug vectors and attend ant colonies', 'Plant protective barrier borders of oil palm or citrus around cocoa plantations'],
      description: 'Cocoa Swollen Shoot Virus Disease (CSSVD), transmitted by mealybugs, is a premier threat to West African cocoa production that requires systematic eradication.',
      susceptibleCrops: ['cocoa', 'cacao'],
    },
    'citrus_greening': {
      symptoms: ['Asymmetrical blotchy mottle chlorosis on leaves across veins', 'Yellow shoots appearing in canopy (yellow dragon)', 'Small, lopsided, hard bitter fruit with dark aborted seeds', 'Fruit remains green at stylar end (inversion of color break)'],
      treatment: ['No cure for infected trees; immediate tree removal and destruction to prevent vector acquisition', 'Aggressive suppression of Asian citrus psyllid (Diaphorina citri) with systemic neonicotinoids'],
      prevention: ['Plant only certified disease-free nursery stock from insect-proof screenhouses', 'Monitor citrus groves with yellow sticky traps for psyllid vectors', 'Enforce strict regional quarantine'],
      description: 'Citrus Greening or Huanglongbing (HLB), caused by Candidatus Liberibacter and spread by psyllids, ruins fruit quality and causes orchard decline.',
      susceptibleCrops: ['citrus', 'orange', 'lemon'],
    },
    'tomato_yellow_leaf_curl': {
      symptoms: ['Upward curling and cupping of leaflet margins', 'Prominent chlorosis and yellowing of leaf edges', 'Stunting of plants with bushy upright habit', 'Heavy flower drop and failure to set fruit'],
      treatment: ['No curative chemical treatment for begomoviruses', 'Remove and bag infected plants early to suppress virus reservoirs', 'Apply selective insecticides (spirotetramat, acetamiprid) for whitefly control'],
      prevention: ['Use insect-proof netting (50-mesh) over nursery beds', 'Plant TYLCV-resistant hybrid tomato cultivars', 'Maintain a minimum 2-month tomato-free period in production valleys'],
      description: 'Tomato Yellow Leaf Curl Virus (TYLCV), spread by the sweetpotato whitefly (Bemisia tabaci), causes severe foliar curling and complete blossom drop.',
      susceptibleCrops: ['tomato', 'solanaceae'],
    },
    'desert_locust': {
      symptoms: ['Total defoliation of crop canopy overnight', 'Stripped bark and severed flower stalks', 'Dense swarms or hopper bands present on field vegetation', 'Chewed grain heads and stripped leaves leaving bare stems'],
      treatment: ['Report immediately to national Locust Control Unit / FAO DLIS', 'Coordinated aerial and ultra-low-volume (ULV) spraying with biopesticides (Metarhizium acridum) or approved insecticides (chlorpyrifos, deltamethrin)', 'Community mechanical trenching for non-flying hopper bands'],
      prevention: ['Regional satellite weather monitoring for soil moisture and green vegetation in desert breeding zones', 'Early warning reporting via eLocust3'],
      description: 'Desert Locust (Schistocerca gregaria) is a devastating transboundary migratory pest capable of consuming its own body weight in fresh vegetation daily.',
      susceptibleCrops: ['general', 'maize', 'sorghum', 'millet'],
    },
    'striga_weed': {
      symptoms: ['Host crop severe stunting, chlorosis, and drought-like wilting despite moist soil', 'Clusters of bright pink, purple, or red flowered parasitic plants emerging at base of cereal stalks', 'Massive yield collapse before weed even flowers'],
      treatment: ['Hand-pull and burn Striga plants before seed set', 'Apply imazapyr herbicide as seed coating on resistant maize (IR-maize / StrigAway)', 'Soil application of 2,4-D amine spray to kill emerged weeds'],
      prevention: ['Adopt Push-Pull technology: intercrop cereal with Silverleaf Desmodium (produces allelochemical suicidal germination)', 'Rotate with non-host trap crops (soybean, cotton, cowpea)', 'Increase soil organic matter and nitrogen fertility'],
      description: 'Striga (Striga hermonthica / Witchweed) is an obligate root-parasitic plant that attaches to cereal roots via haustoria, siphoning water and nutrients.',
      susceptibleCrops: ['maize', 'sorghum', 'millet', 'sugarcane'],
    },
    'anthracnose_mango': {
      symptoms: ['Small dark brown to black irregular spots on young leaves and blossoms', 'Blossom blight causing flower drop and aborted fruit set', 'Sunken black circular lesions on maturing fruit with tear-stain streaks', 'Post-harvest rapid rot in storage'],
      treatment: ['Apply copper-based fungicides at blossom swelling and fruit set', 'Post-harvest hot water treatment of fruit (48°C for 20 minutes) to eliminate latent infections', 'Prune out dead diseased twigs before rainy season'],
      prevention: ['Ensure open canopy pruning for air circulation and sunlight penetration', 'Avoid sprinkler irrigation hitting canopy', 'Harvest with clean shears leaving short stems'],
      description: 'Mango Anthracnose (Colletotrichum gloeosporioides) attacks blossoms, leaves, and fruit, remaining latent until fruit ripening.',
      susceptibleCrops: ['mango', 'avocado', 'papaya'],
    },
    'downy_mildew': {
      symptoms: ['Chlorotic pale yellow stripes on leaves extending from base', 'Downy white-gray fungal growth on underside of leaves in cool, humid mornings', 'Crazy top: proliferation of vegetative leafy structures in tassel or ear', 'Stunting and sterility'],
      treatment: ['Apply metalaxyl-M or dimethomorph systemic fungicides as seed treatment or foliar spray', 'Rogue out chlorotic and crazy-top infected plants before downy sporulation'],
      prevention: ['Use certified metalaxyl-treated seed', 'Plant downy mildew-resistant cultivars', 'Ensure well-drained soil and avoid waterlogging', 'Avoid continuous cereal rotations'],
      description: 'Downy Mildew (Peronosclerospora / Pseudoperonospora spp.) causes systemic foliar chlorosis and bizarre vegetative phyllody in cereals and vegetables.',
      susceptibleCrops: ['maize', 'sorghum', 'cucurbits', 'onion'],
    },
  };

  async analyzeImage(imageData: string | Buffer): Promise<PlantImageAnalysis> {
    try {
      let base64Image: string;
      if (Buffer.isBuffer(imageData)) {
        base64Image = imageData.toString('base64');
      } else if (typeof imageData === 'string' && imageData.startsWith('data:image/')) {
        base64Image = imageData.split(',')[1];
      } else {
        base64Image = imageData as string;
      }

      const prompt = `You are a professional agricultural plant pathologist. Analyze this plant leaf image.
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
IMPORTANT: Return ONLY the JSON object, surrounded by \`\`\`json and \`\`\`. Do not write any conversational text.`;

      const result = await AIRouter.routeRequest('vision', {
        imageData: base64Image,
        prompt,
        options: { temperature: 0.2 },
      });
      const generatedAt = new Date().toISOString();
      const provenance = createProvenance('AI vision analysis via AIRouter', generatedAt, {
        provider: result?.provider || 'multimodal_vision_router',
        model: result?.model || 'vision_llm',
      });
      const rawAnalysis = typeof result === 'string' ? result : (result?.analysis || JSON.stringify(result));
      const parsed = this.parseJSONResponse<PlantImageAnalysis>(rawAnalysis);

      if (parsed) {
        return this.normalizeImageAnalysis(parsed, provenance);
      }

      return this.generateFallbackAnalysis('Failed to parse LLM vision analysis', provenance);
    } catch (error) {
      logger.error('Plant disease analysis failed:', error);
      return this.generateFallbackAnalysis(
        error instanceof Error ? error.message : 'Unknown error',
        createProvenance('AI vision analysis unavailable; no verified source', new Date().toISOString())
      );
    }
  }

  /** Alias for analyzeImage for contract compatibility */
  async analyzePlantImage(imageData: string | Buffer): Promise<PlantImageAnalysis> {
    return this.analyzeImage(imageData);
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
        options: { temperature: 0.2 },
      });
      const generatedAt = new Date().toISOString();
      const provenance = createProvenance('AI soil image analysis via AIRouter', generatedAt, {
        provider: result?.provider || 'multimodal_vision_router',
        model: result?.model || 'vision_llm',
      });
      const rawAnalysis = typeof result === 'string' ? result : (result?.analysis || JSON.stringify(result));
      const parsed = this.parseJSONResponse<SoilAnalysisResult>(rawAnalysis);

      if (parsed) {
        return this.normalizeSoilAnalysis(parsed, provenance);
      }

      return this.generateFallbackSoilAnalysis('Failed to parse LLM soil analysis', provenance);
    } catch (error) {
      logger.error('Soil analysis failed:', error);
      return this.generateFallbackSoilAnalysis(
        error instanceof Error ? error.message : 'Unknown error',
        createProvenance('AI soil image analysis unavailable; no verified source', new Date().toISOString())
      );
    }
  }

  private normalizeImageAnalysis(
    analysis: PlantImageAnalysis,
    provenance: DiagnosticProvenance
  ): PlantImageAnalysis {
    const confidence = normalizeConfidence(analysis.confidence);
    const reviewStatus = getReviewStatus(confidence);
    return {
      ...analysis,
      confidence,
      reviewStatus,
      provenance,
      diseases: (analysis.diseases ?? []).map(disease => {
        const diseaseConfidence = normalizeConfidence(disease.confidence);
        return {
          ...disease,
          confidence: diseaseConfidence,
          reviewStatus: getReviewStatus(diseaseConfidence),
          provenance,
          safetyNotice: disease.safetyNotice ?? DIAGNOSTIC_SAFETY_NOTICE,
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
      reviewStatus: getReviewStatus(confidence),
      provenance,
      npkDeficiencies: {
        nitrogen: analysis.npkDeficiencies?.nitrogen ?? 'unknown',
        phosphorus: analysis.npkDeficiencies?.phosphorus ?? 'unknown',
        potassium: analysis.npkDeficiencies?.potassium ?? 'unknown',
      },
    };
  }

  private parseJSONResponse<T>(content: string): T | null {
    try {
      let rawJson = content;
      const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/;
      const match = content.match(jsonBlockRegex);
      if (match && match[1]) {
        rawJson = match[1];
      } else {
        rawJson = content.replace(/```/g, '').trim();
      }
      return JSON.parse(rawJson) as T;
    } catch (e) {
      logger.error('JSON parsing from vision provider response failed. Content:', content, e);
      return null;
    }
  }

  private generateFallbackSoilAnalysis(
    error: string,
    provenance: DiagnosticProvenance
  ): SoilAnalysisResult {
    return {
      overallHealthScore: null,
      texture: 'Unavailable',
      estimatedMoisture: 'Unavailable',
      drainageClass: 'Unavailable',
      colorDiscoloration: `Analysis unavailable: ${error}`,
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
      if (normalizedCrop) {
        const isCompatible = diseaseInfo.susceptibleCrops.some(c =>
          c === 'general' || normalizedCrop.includes(c) || c.includes(normalizedCrop)
        );
        if (!isCompatible) continue;
      }

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
          reviewStatus: getReviewStatus(confidence),
          provenance,
          safetyNotice: DIAGNOSTIC_SAFETY_NOTICE,
          severity: similarity > 0.7 ? 'severe' : similarity > 0.4 ? 'moderate' : 'mild',
          description: diseaseInfo.description,
          symptoms: matchedSymptoms.length > 0 ? matchedSymptoms : [diseaseInfo.symptoms[0]],
          treatment: diseaseInfo.treatment,
          prevention: diseaseInfo.prevention,
        });
      }
    }

    diagnoses.sort((a, b) => b.confidence - a.confidence);
    return diagnoses.slice(0, 3);
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
    return { disease: PlantDiseaseService.prettifyDiseaseId(key), ...entry };
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
    error: string,
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
      provenance: {
        ...provenance,
        source: `${provenance.source} (${error})`,
      },
    };
  }
}

export const plantDiseaseService = new PlantDiseaseService();
/** Size of the internal symptom corpus — surfaced to callers so heuristic scope is explicit. */
export const PLANT_DISEASE_CORPUS_SIZE = Object.keys((PlantDiseaseService as unknown as { DISEASE_DATABASE: Record<string, unknown> }).DISEASE_DATABASE).length;
