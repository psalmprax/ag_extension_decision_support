// Lives in its own module so EdgeVisionScannerModal exports only components
// (keeps React Fast Refresh working for that file).
export const CROP_PRESETS = [
  { id: 'Maize', label: 'Maize', emoji: '🌽', alt: 'Corn' },
  { id: 'Cassava', label: 'Cassava', emoji: '🌿', alt: 'Manioc' },
  { id: 'Tomato', label: 'Tomato', emoji: '🍅', alt: 'Solanum' },
  { id: 'Coffee', label: 'Coffee', emoji: '☕', alt: 'Arabica' },
  { id: 'Banana', label: 'Banana', emoji: '🍌', alt: 'Musa' },
  { id: 'Legumes', label: 'Legumes', emoji: '🫘', alt: 'Beans' },
] as const;
