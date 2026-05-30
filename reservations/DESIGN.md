---
name: Empire Noir
colors:
  surface: '#121414'
  surface-dim: '#121414'
  surface-bright: '#38393a'
  surface-container-lowest: '#0d0f0f'
  surface-container-low: '#1a1c1c'
  surface-container: '#1e2020'
  surface-container-high: '#282a2b'
  surface-container-highest: '#333535'
  on-surface: '#e2e2e2'
  on-surface-variant: '#d0c5af'
  inverse-surface: '#e2e2e2'
  inverse-on-surface: '#2f3131'
  outline: '#99907c'
  outline-variant: '#4d4635'
  surface-tint: '#e9c349'
  primary: '#f2ca50'
  on-primary: '#3c2f00'
  primary-container: '#d4af37'
  on-primary-container: '#554300'
  inverse-primary: '#735c00'
  secondary: '#d1c5af'
  on-secondary: '#363020'
  secondary-container: '#504837'
  on-secondary-container: '#c2b7a1'
  tertiary: '#d0cecf'
  on-tertiary: '#313031'
  tertiary-container: '#b5b2b3'
  on-tertiary-container: '#454546'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffe088'
  primary-fixed-dim: '#e9c349'
  on-primary-fixed: '#241a00'
  on-primary-fixed-variant: '#574500'
  secondary-fixed: '#ede1ca'
  secondary-fixed-dim: '#d1c5af'
  on-secondary-fixed: '#211b0d'
  on-secondary-fixed-variant: '#4d4635'
  tertiary-fixed: '#e5e2e3'
  tertiary-fixed-dim: '#c8c6c7'
  on-tertiary-fixed: '#1c1b1c'
  on-tertiary-fixed-variant: '#474647'
  background: '#121414'
  on-background: '#e2e2e2'
  surface-variant: '#333535'
typography:
  display-lg:
    fontFamily: Bodoni Moda
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: 0.05em
  headline-lg:
    fontFamily: Bodoni Moda
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Bodoni Moda
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.7'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.0'
    letterSpacing: 0.1em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 8px
  gutter: 24px
  margin-mobile: 20px
  margin-desktop: 64px
  container-max: 1200px
---

## Brand & Style

This design system embodies a cinematic, "Mafia" aesthetic—sophisticated, authoritative, and deeply premium. It is built for a brand that commands respect through tradition and excellence. The visual language utilizes high-contrast elements, sharp typography, and a "noir" atmosphere to evoke a sense of legacy and exclusivity.

The core style is **Minimalist-Noir**:
*   **Heavy Blacks:** A deep, obsidian foundation that makes metallic accents pop.
*   **Cinematic Contrast:** Sharp transitions between light and dark to direct focus.
*   **Aged Sophistication:** Subtle use of bronze and gold to suggest history and value without being gaudy.
*   **Authoritative Layouts:** Symmetric, structured, and intentional placement of elements.

## Colors

The palette is strictly limited to maintain a premium, moody atmosphere.

*   **Foundation:** #0B0B0C serves as the global canvas, providing a "bottomless" depth.
*   **Surfaces:** Cards and modals utilize a vertical gradient to create subtle volume without breaking the noir aesthetic.
*   **Accents:** Champagne Gold (#D4AF37) is used exclusively for primary calls to action, logos, and critical status indicators.
*   **Structure:** Aged Bronze (#2A2415) is the primary color for borders, dividers, and inactive icons, providing a weathered, historical feel.
*   **Typography:** Pure White is reserved for high-impact headings, while #E5E5E5 is used for body text to reduce eye strain against the black background.

## Typography

The typographic hierarchy relies on the tension between a dramatic serif and a functional sans-serif.

*   **Headings:** Use **Bodoni Moda**. Always uppercase for Display and H1 levels. Increase tracking (letter-spacing) to 0.05em to enhance the "luxury editorial" feel.
*   **Body:** Use **Inter**. Line height is intentionally relaxed (1.6x+) to ensure legibility against the dark background, particularly on mobile devices.
*   **Captions/Labels:** Use Inter Bold in uppercase with wide tracking (0.1em) to create a "technical dossier" or authoritative metadata look.

## Layout & Spacing

The design system utilizes a **Fixed Grid** approach for desktop to maintain a centered, cinematic focus, transitioning to a fluid model for mobile.

*   **Grid:** A 12-column system on desktop with generous 24px gutters.
*   **Rhythm:** An 8px linear scale. Use larger spacing increments (64px, 80px) between major sections to emphasize whitespace (or "blackspace") and luxury.
*   **Mobile:** Reduce side margins to 20px. Stack all card-based content vertically.
*   **Alignment:** Center-align primary marketing content to evoke a formal, symmetrical balance. Left-align data-heavy or operational sections.

## Elevation & Depth

In a dark theme, depth is achieved through **Tonal Layering** and **Subtle Outlines** rather than heavy shadows.

*   **The Floor:** #0B0B0C (Background).
*   **The Surface:** The card gradient (#121214 to #0D0D0E) creates a slight lift.
*   **The Edge:** Use 1px solid borders in Aged Bronze (#2A2415) to define surface boundaries. 
*   **Primary Focus:** For active states or featured cards, use a 1px Gold (#D4AF37) border.
*   **Shadows:** Avoid standard drop shadows. Instead, use a very faint, large-radius glow (10-15% opacity of Primary Gold) for high-importance elements like hovering "Grand" buttons.

## Shapes

To maintain an "authoritative" and "sharp" aesthetic, the system uses minimal rounding.

*   **Buttons & Inputs:** 4px (Soft) corner radius. This provides just enough modern touch without losing the structural rigidity of the brand.
*   **Cards:** 8px corner radius for a slightly softer container feel.
*   **Icons:** Use sharp, thin-stroke geometric icons. Strokes should match the text color or bronze accent.

## Components

### Buttons
*   **Primary:** Solid Gold background with black text. 4px radius.
*   **Secondary:** Ghost style. Transparent background, 1px Aged Bronze border, White text.
*   **Hover State:** Secondary buttons transition their border to Gold; Primary buttons gain a subtle outer gold glow.

### Cards
*   Cards use the defined surface gradient and Aged Bronze border. 
*   Inner padding should be generous (min 32px) to maintain the premium feel.
*   Interactive cards should feature a 1px Gold border on hover.

### Input Fields
*   Background: #0B0B0C (matching the base).
*   Border: 1px Aged Bronze.
*   Focus State: 1px Gold border with a 2px Gold bottom-accent line.
*   Placeholder text: Gray-500 (#666666).

### Chips/Tags
*   Small, all-caps labels.
*   Background: #1A1A1C.
*   Border: 1px #2A2415.
*   Text: #E5E5E5.

### Dividers
*   Horizontal lines should be 1px solid Aged Bronze, often fading to transparent at the edges (radial gradient) to create a cinematic lighting effect.