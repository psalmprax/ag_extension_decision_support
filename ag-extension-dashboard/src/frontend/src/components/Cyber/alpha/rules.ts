// Canvas-selection rules moved verbatim from components/Cyber/AlphaAI.tsx (pure move).

export type CanvasViewType =
  | 'soil_heatmap'
  | 'disease_saliency'
  | 'agro_scrubber'
  | 'rag_graph'
  | 'telemetry_radar';

export interface CanvasSelection {
  view: CanvasViewType;
  label: string;
}

export const CATEGORY_CANVAS_RULES: Array<{ terms: string[] } & CanvasSelection> = [
  { terms: ['pest', 'disease', 'path'], view: 'disease_saliency', label: 'Disease Saliency Scanner' },
  { terms: ['soil'], view: 'soil_heatmap', label: 'Soil Diagnostic Grid' },
  { terms: ['clim', 'yield', 'water'], view: 'agro_scrubber', label: 'Agro-Ecosystem Scrubber' },
  { terms: ['research', 'manual'], view: 'rag_graph', label: 'RAG Knowledge Graph' },
];

export const KEYWORD_CANVAS_RULES: Array<{ terms: string[] } & CanvasSelection> = [
  { terms: ['pest', 'rust', 'leaf', 'disease', 'spot'], view: 'disease_saliency', label: 'Disease Saliency Scanner' },
  { terms: ['rain', 'weather', 'season', 'yield', 'water'], view: 'agro_scrubber', label: 'Agro-Ecosystem Scrubber' },
  { terms: ['fao', 'research', 'manual', 'guide'], view: 'rag_graph', label: 'RAG Knowledge Graph' },
];

export function matchCanvasRule(haystack: string, rules: typeof CATEGORY_CANVAS_RULES): CanvasSelection | null {
  const rule = rules.find(r => r.terms.some(term => haystack.includes(term)));
  return rule ? { view: rule.view, label: rule.label } : null;
}

export function selectCanvasForQuery(query: string, ragCategories?: string[]): CanvasSelection {
  // Prefer semantic RAG categories when available; fall back to lightweight keyword heuristic
  const cats = (ragCategories || []).join(' ').toLowerCase();
  if (cats) {
    const byCategory = matchCanvasRule(cats, CATEGORY_CANVAS_RULES);
    if (byCategory) return byCategory;
  }
  return matchCanvasRule(query.toLowerCase(), KEYWORD_CANVAS_RULES)
    ?? { view: 'soil_heatmap', label: 'Soil Diagnostic Grid' };
}
