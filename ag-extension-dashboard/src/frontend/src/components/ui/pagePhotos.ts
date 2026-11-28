/**
 * Field photos for page headers, from the landing page set. Two landing photos are left out on
 * purpose: one shows another company's app on a phone, and the manager's office is not a field.
 * `position` is the CSS object-position that keeps the subject in view in a wide, short band.
 */
export const PAGE_PHOTOS = {
  fieldSunrise: { src: '/images/landing/maize-field-sunrise.webp', width: 1319, height: 860, position: 'center 65%' },
  aerialFarmland: { src: '/images/landing/hero-aerial.webp', width: 1376, height: 768, position: 'center 60%' },
  leafCloseUp: { src: '/images/landing/maize-leaf-diagnostics.webp', width: 1200, height: 896, position: '60% 45%' },
  farmerInspecting: { src: '/images/landing/farmer-inspecting-ear.webp', width: 999, height: 666, position: '45% 30%' },
  farmerWithPhone: { src: '/images/landing/farmer-in-field-phone.webp', width: 1200, height: 623, position: '45% 25%' },
  officerWithFarmer: { src: '/images/landing/officer-farmer-hero-1024.webp', width: 1024, height: 576, position: '40% 35%' },
  officerScanning: { src: '/images/landing/persona-officer.webp', width: 1200, height: 896, position: '60% 30%' },
} as const;

export type PagePhoto = keyof typeof PAGE_PHOTOS;
