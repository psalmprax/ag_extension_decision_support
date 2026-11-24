/**
 * Reading the on-device disease model's labels.
 *
 * The training script (scripts/ml/train_disease_classifier.py) names each output
 * "<crop>___<disease>" in snake case, e.g. "corn___streak_virus" or "bean___healthy".
 */

export function cropOfLabel(label: string): string {
  return label.split('___', 1)[0] ?? label;
}

export function diseaseOfLabel(label: string): string {
  const index = label.indexOf('___');
  return index === -1 ? label : label.slice(index + 3);
}

export function isHealthyLabel(label: string): boolean {
  return diseaseOfLabel(label).startsWith('healthy');
}

/**
 * Labels whose crop and disease both match an entry in the app's list of known conditions.
 * Anything else is shown by its own name. Labels that do not say which pathogen (maize "rust"
 * may be common or southern rust; maize "leaf blight" may be northern or southern) are not
 * matched to a specific one.
 */
export const LABEL_CONDITIONS: Readonly<Record<string, string>> = {
  tomato___late_blight: 'Tomato Late Blight',
  tomato___early_blight: 'Tomato Early Blight',
  potato___early_blight: 'Potato Early Blight',
  potato___late_blight: 'Potato Late Blight',
  corn___lethal_necrosis: 'Maize Lethal Necrosis Disease (MLND)',
  corn___fall_armyworm: 'Fall Armyworm (FAW) Infestation',
  bean___angular_leaf_spot: 'Bean Angular Leaf Spot',
  coffee___leaf_rust: 'Coffee Leaf Rust (CLR)',
  cassava___mosaic: 'Cassava Mosaic Disease (CMD)',
  cassava___brown_streak: 'Cassava Brown Streak Disease (CBSD)',
  banana___xanthomonas_wilt: 'Banana Xanthomonas Wilt (BXW)',
};

const CROP_NAMES: Readonly<Record<string, string>> = {
  corn: 'Maize',
  bell_pepper: 'Bell pepper',
  soybean: 'Soybean',
};

/**
 * Other words people use for a crop, beside its display name and label name. Only names that
 * mean the same crop: "pepper" is the model's own Capsicum crop, so bell pepper and chili keep theirs.
 */
const CROP_ALIASES: Readonly<Record<string, string[]>> = {
  corn: ['maize', 'corn'],
  soybean: ['soybean', 'soyabean', 'soya', 'soy'],
  bean: ['bean', 'common bean'],
  bell_pepper: ['bell pepper'],
  pepper: ['pepper', 'capsicum', 'sweet pepper'],
  chili: ['chili', 'chilli', 'chile', 'hot pepper'],
  rice: ['rice', 'paddy'],
  groundnut: ['groundnut', 'peanut'],
  eggplant: ['eggplant', 'brinjal', 'aubergine'],
  papaya: ['papaya', 'pawpaw'],
  sugarcane: ['sugarcane', 'sugar cane'],
  black_gram: ['black gram', 'urad'],
  date_palm: ['date palm'],
  cassava: ['cassava', 'manioc'],
};

// Genus, place and disease names that keep a capital letter.
const PROPER_NAMES = new Set([
  'fusarium', 'sigatoka', 'xanthomonas', 'cercospora', 'septoria', 'phoma', 'alternaria', 'tuta', 'helicoverpa', 'curvularia',
  'phyllosticta', 'ascochyta', 'helopeltis', 'parlatoria', 'iris', 'texas', 'pokkah',
]);

function words(snake: string): string {
  return snake.split('_').filter(Boolean).map(word => (PROPER_NAMES.has(word) ? word[0].toUpperCase() + word.slice(1) : word)).join(' ');
}

export function cropDisplayName(crop: string): string {
  const name = CROP_NAMES[crop] ?? words(crop);
  return name ? name[0].toUpperCase() + name.slice(1) : crop;
}

/** "bean___rust" → "Bean rust"; "corn___healthy" → "Healthy maize leaf". */
export function labelDisplayName(label: string): string {
  const crop = cropDisplayName(cropOfLabel(label));
  const disease = diseaseOfLabel(label);
  if (disease === 'healthy') return `Healthy ${crop.toLowerCase()} leaf`;
  if (disease.startsWith('healthy_')) return `Healthy ${crop.toLowerCase()} ${words(disease.slice('healthy_'.length))}`;
  return `${crop} ${words(disease)}`;
}

/**
 * The crop, among the model's crops, that the person typed ("Maize", "beans", "my coffee
 * plot"). Null when the text names none of them, including crops the model was not trained on.
 */
export function matchCrop(text: string | undefined, crops: Iterable<string>): string | null {
  const typed = ` ${(text ?? '').toLowerCase().replace(/[^a-z]+/g, ' ').trim()} `;
  if (!typed.trim()) return null;
  let best: { crop: string; length: number } | null = null;
  for (const crop of crops) {
    const names = new Set([...(CROP_ALIASES[crop] ?? []), crop.replace(/_/g, ' '), cropDisplayName(crop).toLowerCase()]);
    for (const name of names) {
      // Whole words, with an optional plural "s": "beans" names bean, "soybeans" names soybean only.
      if (new RegExp(` ${name}s? `).test(typed) && (!best || name.length > best.length)) best = { crop, length: name.length };
    }
  }
  return best?.crop ?? null;
}

export function modelCrops(labels: string[]): string[] {
  return [...new Set(labels.map(cropOfLabel))];
}
