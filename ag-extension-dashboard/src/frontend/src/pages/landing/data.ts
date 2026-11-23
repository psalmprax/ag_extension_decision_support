
// Data moved verbatim from pages/LandingPage.tsx (pure move).

/** "How it works": translation keys (English in public/locales/en.json). */
export const steps = [1, 2, 3].map(n => ({ num: `0${n}`, title: `landing_how_step_${n}_title`, desc: `landing_how_step_${n}_desc` }));

export const globalTelemetryNodes = [
  { x: 51, y: 48, label: 'Nairobi, Kenya', region: 'East Africa' },
  { x: 44, y: 45, label: 'Lagos, Nigeria', region: 'West Africa' },
  { x: 48, y: 43, label: 'Kampala, Uganda', region: 'East Africa' },
  { x: 38, y: 44, label: 'Accra, Ghana', region: 'West Africa' },
  { x: 67, y: 36, label: 'New Delhi, India', region: 'South Asia' },
  { x: 76, y: 42, label: 'Hanoi, Vietnam', region: 'Southeast Asia' },
  { x: 29, y: 64, label: 'São Paulo, Brazil', region: 'Latin America' },
  { x: 23, y: 26, label: 'Saskatoon, Canada', region: 'North America' },
  { x: 53, y: 32, label: 'Cairo, Egypt', region: 'North Africa' },
  { x: 54, y: 55, label: 'Lusaka, Zambia', region: 'Southern Africa' },
];

/** The FAQ: translation keys (English in public/locales/en.json). */
export const faqItems = [1, 2, 3, 4, 5, 6].map(n => ({ question: `landing_faq_${n}_question`, answer: `landing_faq_${n}_answer` }));
