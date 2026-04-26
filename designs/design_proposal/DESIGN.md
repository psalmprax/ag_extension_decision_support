---
name: High-Contrast Glass
colors:
  surface: '#0c1324'
  surface-dim: '#0c1324'
  surface-bright: '#33394c'
  surface-container-lowest: '#070d1f'
  surface-container-low: '#151b2d'
  surface-container: '#191f31'
  surface-container-high: '#23293c'
  surface-container-highest: '#2e3447'
  on-surface: '#dce1fb'
  on-surface-variant: '#b9caca'
  inverse-surface: '#dce1fb'
  inverse-on-surface: '#2a3043'
  outline: '#849495'
  outline-variant: '#3a494a'
  surface-tint: '#00dce5'
  primary: '#e9feff'
  on-primary: '#003739'
  primary-container: '#00f5ff'
  on-primary-container: '#006c71'
  inverse-primary: '#00696e'
  secondary: '#d1bcff'
  on-secondary: '#3c0090'
  secondary-container: '#7000ff'
  on-secondary-container: '#ddcdff'
  tertiary: '#f9fafa'
  on-tertiary: '#2f3131'
  tertiary-container: '#dddddd'
  on-tertiary-container: '#606162'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#63f7ff'
  primary-fixed-dim: '#00dce5'
  on-primary-fixed: '#002021'
  on-primary-fixed-variant: '#004f53'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#d1bcff'
  on-secondary-fixed: '#23005b'
  on-secondary-fixed-variant: '#5700c9'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c7'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#454747'
  background: '#0c1324'
  on-background: '#dce1fb'
  surface-variant: '#2e3447'
typography:
  headline-xl:
    fontFamily: Space Grotesk
    fontSize: 64px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 40px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.1em
  label-sm:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 48px
  xl: 80px
  container-max: 1440px
  gutter: 24px
  margin: 32px
---

## Brand & Style

The design system is built on a foundation of technical precision and premium aesthetics. It targets high-end software environments where data density meets cinematic presentation. The brand personality is "The Professional Futurist"—authoritative, cutting-edge, and highly disciplined.

The visual style merges **Glassmorphism** with **High-Contrast Minimalism**. It relies on the interplay between deep, infinite backgrounds and razor-sharp, translucent foreground elements. By utilizing frosted surfaces and vibrant neon accents, the design system evokes a sense of depth and physical layeredness, moving away from flat design into a more immersive, tactile digital space.

## Colors

The palette is anchored by a "Deep Space" navy (#020617), providing a near-black canvas that allows neon elements to achieve maximum luminosity. The primary accent is **Neon Cyan**, used sparingly for high-priority calls to action and critical status indicators.

Secondary colors include a deep electric violet for interactive depth and pure white for high-contrast typography. Surfaces are never solid; they are constructed using semi-transparent iterations of the neutral base, layered with white or cyan tinted borders to simulate glass edges. Success, warning, and error states should maintain high saturation to match the neon aesthetic.

## Typography

Typography in this design system prioritizes legibility against dark backgrounds while reinforcing a technical tone. **Space Grotesk** is used for headlines and labels; its geometric quirks and open apertures reflect a futuristic, "interface-first" vibe. 

**Inter** handles body copy and dense data, chosen for its neutral, utilitarian character which balances the more expressive display type. High contrast is maintained through stark white text (#FFFFFF) against the navy base. Small labels and metadata should utilize uppercase styling and increased letter spacing to emulate military or aerospace readouts.

## Layout & Spacing

The layout follows a **Fixed Grid** model to maintain the structural integrity required for a premium feel. A 12-column grid is standard for desktop, with generous margins and gutters to ensure that glass panels do not feel cluttered.

The spacing rhythm is built on an 8px base unit. Larger "breathable" gaps (48px+) are encouraged between major sections to emphasize the floating nature of the UI components. Elements should be aligned strictly to the grid to counteract the "softness" of the background blurs, ensuring the final interface feels engineered rather than atmospheric.

## Elevation & Depth

Depth is the defining characteristic of this design system. Instead of traditional drop shadows, elevation is communicated through **Backdrop Blurs** and **Rim Lighting**.

1.  **Lowest Level:** The base navy background.
2.  **Mid Level (Standard Panels):** Background blur (20px - 40px) with a 10% white opacity fill. A 1px border with a subtle top-to-bottom white-to-transparent gradient simulates a light-catching glass edge.
3.  **High Level (Modals/Popovers):** Higher blur (60px) and a slightly brighter border (20% opacity). 
4.  **Interaction:** When an element is active or hovered, it emits a subtle outer glow using the primary Neon Cyan color, appearing as if the glass is "charging."

## Shapes

The design system utilizes **Soft** roundedness (0.25rem - 0.75rem) to maintain a sleek, aerodynamic appearance. Sharp corners are avoided to prevent the UI from feeling too aggressive, but large "pill" radii are also restricted to keep the look technical rather than playful.

Internal components like buttons and inputs use the base 4px radius, while primary container panels use the 12px (rounded-lg) radius to create a clear visual nesting hierarchy.

## Components

### Buttons
Primary buttons are solid Neon Cyan with black text, featuring a "glow" shadow of the same color. Secondary buttons use the "Glass" style: a transparent background with a 1px cyan border and white text.

### Input Fields
Inputs are defined by a bottom-border only or a very thin 1px ghost-border. When focused, the border transitions to Neon Cyan and the background blur intensity increases slightly.

### Cards & Panels
Cards are the primary vehicle for the glassmorphism effect. They must feature a `backdrop-filter: blur()` and a semi-transparent border. Titles within cards should always be in the Headline-MD or Label-MD styles.

### Chips & Tags
Chips are small, pill-shaped elements with a dark 20% cyan fill and neon cyan text. They are used for status indicators and filtering.

### Data Visualization
Charts should use vibrant gradients that transition from Cyan to Violet. Grid lines in charts must be low-contrast (5-10% white opacity) to ensure the data remains the focal point against the glass panels.