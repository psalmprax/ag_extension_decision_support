// Lives in its own module so EdgeVisionScannerModal exports only components
// (keeps React Fast Refresh working for that file).
export const CROP_PRESETS = [
  { id: 'Maize', label: 'Maize', alt: 'Corn' },
  { id: 'Cassava', label: 'Cassava', alt: 'Manioc' },
  { id: 'Tomato', label: 'Tomato', alt: 'Solanum' },
  { id: 'Coffee', label: 'Coffee', alt: 'Arabica' },
  { id: 'Banana', label: 'Banana', alt: 'Musa' },
  { id: 'Legumes', label: 'Legumes', alt: 'Beans' },
] as const;
