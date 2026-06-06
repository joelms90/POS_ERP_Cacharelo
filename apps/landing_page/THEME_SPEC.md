# Grupo Cacharelo - Empire Noir Theme Specification

**Version:** 1.0.0
**Last Updated:** June 2026
**Brand:** Grupo Cacharelo
**Design Language:** Empire Noir (Cinematic Mafia Aesthetic)

---

## Table of Contents

1. [Brand Overview](#brand-overview)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Spacing & Layout](#spacing--layout)
5. [Shadows & Effects](#shadows--effects)
6. [Component Patterns](#component-patterns)
7. [Accessibility](#accessibility)
8. [Implementation Examples](#implementation-examples)

---

## Brand Overview

**Empire Noir** is a cinematic design language inspired by classic mafia aesthetics, combining dark, sophisticated backgrounds with luxurious gold accents. The theme evokes tradition, respect, and premium quality - perfect for Grupo Cacharelo's family restaurant brands.

### Design Principles

- **Cinematic Atmosphere**: Dark backgrounds with dramatic contrasts
- **Luxury Accents**: Gold highlights for premium feel
- **Respect for Tradition**: Classic typography and timeless layouts
- **Sophisticated Simplicity**: Clean layouts with purposeful details

---

## Color System

### Foundation Colors

These are the core colors that define the Empire Noir aesthetic:

| Token | Value | Usage |
|-------|-------|-------|
| `--color-mafia-base` | `#0B0B0C` | Darkest background, body background |
| `--color-mafia-surface` | `#121214` | Cards, elevated surfaces |
| `--color-mafia-surface-end` | `#0D0D0E` | Gradient end points |
| `--color-mafia-bronze` | `#2A2415` | Borders, dividers, subtle accents |
| `--color-mafia-gold` | `#D4AF37` | Primary gold accent (container) |

### Semantic UI Tokens

Mapped tokens for consistent UI implementation:

#### Background & Surface

```css
--color-background: #121414;     /* Main background */
--color-surface: #121214;        /* Cards, panels, elevated content */
```

#### Text Colors

```css
--color-on-surface: #e2e2e2;           /* Primary text on dark backgrounds */
--color-on-surface-variant: #d0c5af;   /* Secondary/muted text */
```

#### Primary Colors (Gold Accent)

```css
--color-primary: #f2ca50;                  /* Lighter gold for hover states */
--color-primary-container: #d4af37;        /* Primary gold for buttons, CTAs */
--color-on-primary-container: #3c2f00;     /* Text on gold backgrounds */
```

#### Borders & Outlines

```css
--color-outline: #99907c;           /* Standard borders */
--color-outline-variant: #4d4635;   /* Subtle borders */
```

#### Feedback Colors

```css
--color-error: #ffb4ab;   /* Error states, destructive actions */
```

### Color Palette Visual Reference

```
┌─────────────────────────────────────────────────────────┐
│ DARK FOUNDATION                                         │
│ ███ #0B0B0C (mafia-base)      - Body background       │
│ ███ #121214 (mafia-surface)   - Card backgrounds      │
│ ███ #0D0D0E (surface-end)     - Gradient ends         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ GOLD ACCENTS                                            │
│ ███ #D4AF37 (mafia-gold)      - Primary container     │
│ ███ #f2ca50 (primary)         - Hover states          │
│ ███ #d4b038                   - Active states          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ NEUTRAL TONES                                           │
│ ███ #2A2415 (mafia-bronze)    - Borders, dividers     │
│ ███ #e2e2e2 (on-surface)      - Primary text          │
│ ███ #d0c5af (on-surface-var)  - Secondary text        │
└─────────────────────────────────────────────────────────┘
```

### Gradients

#### Mafia Gradient (Background)

```css
background: linear-gradient(180deg, #121214 0%, #0D0D0E 100%);
```

**Usage:** Hero sections, large background areas

#### Vignette Overlay

```css
background: radial-gradient(circle at center, transparent 20%, #0B0B0C 90%);
```

**Usage:** Image overlays for atmospheric effect

#### Cinematic Divider

```css
background: radial-gradient(circle, rgba(42, 36, 21, 1) 0%, rgba(42, 36, 21, 0) 100%);
```

**Usage:** Horizontal dividers between sections

---

## Typography

### Font Families

#### Primary Fonts

```css
--font-serif: "Bodoni Moda", "Playfair Display", Georgia, serif;
--font-sans: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
--font-hero: "Playfair Display", serif;
--font-brand: "Corleone", serif;  /* Custom font - requires font file */
```

### Custom Font Faces

```css
@font-face {
  font-family: "Corleone";
  src: url("/fonts/Corleone-Regular.otf") format("opentype");
  font-weight: normal;
  font-style: normal;
}

@font-face {
  font-family: "Corleone Due";
  src: url("/fonts/Corleone-Due-Regular.otf") format("opentype");
  font-weight: normal;
  font-style: normal;
}
```

### Typography Scale

| Variant | Font Family | Size (Mobile) | Size (Desktop) | Weight | Line Height | Letter Spacing | Usage |
|---------|-------------|---------------|----------------|---------|-------------|----------------|-------|
| **H1** | Playfair Display | 2.25rem (36px) | 3.5rem (56px) | 700 | 1.2 | 0.05em | Page hero headlines |
| **H2** | Bodoni Moda/Serif | 1.5rem (24px) | 1.875rem (30px) | 600 | 1.3 | 0.025em | Section headings |
| **H3** | Playfair Display | 1.25rem (20px) | 1.5rem (24px) | 700 | 1.4 | 0.025em | Subsection titles, card titles |
| **Body Large** | Inter | 1.125rem (18px) | 1.25rem (20px) | 400 | 1.625 | 0 | Prominent body text, taglines |
| **Body Medium** | Inter | 0.875rem (14px) | 1rem (16px) | 400 | 1.625 | 0 | Standard body text |
| **Label Small** | Inter | 0.75rem (12px) | 0.75rem (12px) | 600 | 1.5 | 0.1em | Labels, metadata, badges |

### Typography Utilities

Pre-defined utility classes for common text patterns:

#### Hero Specification
```css
.font-spec-hero {
  font-family: var(--font-hero);
  letter-spacing: 0.025em;
  /* Apply to hero headlines */
}
```

#### Brand Specification
```css
.font-spec-brand {
  font-family: var(--font-brand);
  letter-spacing: 0.05em;
  /* Apply to brand names, logos */
}
```

#### Dish Specification
```css
.font-spec-dish {
  font-family: "Playfair Display", serif;
  font-weight: 700;
  letter-spacing: 0.025em;
  /* Apply to menu items, product names */
}
```

#### Body Specification
```css
.font-spec-body {
  font-family: var(--font-sans);
  font-weight: 400;
  line-height: 1.625;
  /* Apply to paragraphs, descriptions */
}
```

### Typography Color Guidelines

- **Headlines (H1):** `#D4AF37` (mafia-gold) with drop shadow
- **Headings (H2, H3):** `#ffffff` or `#e2e2e2`
- **Body Text:** `#e2e2e2` or `#e5e5e5`
- **Secondary/Meta Text:** `#d0c5af` (on-surface-variant)
- **Muted Text:** `#99907c` (outline)

---

## Spacing & Layout

### Spacing System

Based on 8px unit system for consistent rhythm:

```css
--spacing-unit: 8px;                /* Base unit (1x) */
--spacing-gutter: 24px;             /* Standard gap (3x) */
--spacing-margin-mobile: 20px;      /* Mobile page margins */
--spacing-margin-desktop: 64px;     /* Desktop page margins */
--spacing-container-max: 1200px;    /* Maximum content width */
```

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `spacing-xs` | 4px (0.5x) | Tight spacing, icon gaps |
| `spacing-sm` | 8px (1x) | Small gaps, compact layouts |
| `spacing-md` | 16px (2x) | Standard element spacing |
| `spacing-lg` | 24px (3x) | Section spacing, card padding |
| `spacing-xl` | 32px (4x) | Large gaps between sections |
| `spacing-2xl` | 48px (6x) | Major section breaks |
| `spacing-3xl` | 64px (8x) | Hero spacing, desktop margins |

### Layout Patterns

#### Page Container

```html
<div class="max-w-[1200px] mx-auto px-[20px] md:px-[64px]">
  <!-- Content -->
</div>
```

#### Section Spacing

- **Vertical Padding:** `py-16` (64px) on desktop, `py-12` (48px) on mobile
- **Section Gap:** `gap-8` (32px) minimum between major sections

#### Grid Systems

**Brand Card Grid:**
```
Mobile: 1 column
Tablet: 2 columns (gap: 24px)
Desktop: 2 columns (gap: 32px)
```

---

## Shadows & Effects

### Shadow System

#### Gold Glow Shadow

```css
--shadow-glow-gold: 0 0 20px rgba(212, 175, 55, 0.15);
```

**Usage:** Hover states on buttons, interactive elements

#### Standard Shadows

```css
/* Subtle elevation */
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);

/* Card hover */
box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5),
            0 0 15px rgba(212, 175, 55, 0.15);

/* Hero text */
text-shadow: 0 2px 20px rgba(0, 0, 0, 0.8);
```

### Transitions

Standard transition for interactive elements:

```css
transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
```

**Properties to animate:**
- `background-color`
- `border-color`
- `color`
- `transform`
- `box-shadow`
- `opacity`

---

## Component Patterns

### Buttons

#### Primary Button (Gold CTA)

```css
{
  background: #d4af37;
  color: #3c2f00;
  padding: 12px 32px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Hover */
{
  background: #d4b038;
  box-shadow: 0 0 20px rgba(212, 175, 55, 0.15);
}

/* Active */
{
  transform: scale(0.95);
}
```

**Usage:** Primary CTAs, main actions

#### Secondary Button (Outlined)

```css
{
  background: transparent;
  color: #e2e2e2;
  border: 1px solid #2A2415;
  padding: 12px 32px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Hover */
{
  border-color: #d4af37;
  color: #f2ca50;
}
```

**Usage:** Secondary actions, navigation

### Cards

#### Interactive Brand Card

```css
{
  background: #121214;
  border: 1px solid #2A2415;
  border-radius: 8px;
  padding: 32px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}

/* Hover */
{
  border-color: #D4AF37;
  transform: translateY(-4px);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5),
              0 0 15px rgba(212, 175, 55, 0.15);
}
```

**Features:**
- Subtle bronze border at rest
- Gold border on hover
- Lift animation (4px)
- Gold glow shadow

### Forms

#### Input Fields

```css
{
  background: transparent;
  border: 1px solid #4d4635;
  border-radius: 4px;
  padding: 12px 16px;
  color: #e2e2e2;
  font-size: 14px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Focus */
{
  border-color: #d4af37;
  outline: none;
  box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.1);
}
```

#### Textarea

Same as input, with:
```css
{
  min-height: 120px;
  resize: vertical;
}
```

### Scrollbar

Custom scrollbar for premium feel:

```css
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #0B0B0C;
}

::-webkit-scrollbar-thumb {
  background: #2A2415;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #D4AF37;
}
```

---

## Accessibility

### Color Contrast

All text meets WCAG 2.1 AA standards:

| Text | Background | Contrast Ratio | Pass |
|------|------------|----------------|------|
| #e2e2e2 | #0B0B0C | 15.2:1 | AAA |
| #d0c5af | #0B0B0C | 10.8:1 | AAA |
| #3c2f00 | #d4af37 | 7.1:1 | AA |
| #D4AF37 | #0B0B0C | 8.3:1 | AAA |

### Focus States

All interactive elements must have visible focus indicators:

```css
:focus-visible {
  outline: 2px solid #d4af37;
  outline-offset: 2px;
}
```

### Motion

Respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Implementation Examples

### Tailwind CSS v4

```css
@import "tailwindcss";

@theme {
  /* Colors */
  --color-mafia-base: #0B0B0C;
  --color-mafia-surface: #121214;
  --color-mafia-bronze: #2A2415;
  --color-mafia-gold: #D4AF37;

  --color-primary: #f2ca50;
  --color-primary-container: #d4af37;
  --color-on-primary-container: #3c2f00;

  /* Spacing */
  --spacing-margin-mobile: 20px;
  --spacing-margin-desktop: 64px;

  /* Typography */
  --font-serif: "Bodoni Moda", "Playfair Display", Georgia, serif;
  --font-sans: "Inter", system-ui, sans-serif;
  --font-hero: "Playfair Display", serif;

  /* Shadows */
  --shadow-glow-gold: 0 0 20px rgba(212, 175, 55, 0.15);
}

/* Utilities */
@layer utilities {
  .bg-mafia-gradient {
    background: linear-gradient(180deg, #121214 0%, #0D0D0E 100%);
  }

  .interactive-card {
    border: 1px solid #2A2415;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .interactive-card:hover {
    border-color: #D4AF37;
    transform: translateY(-4px);
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5),
                0 0 15px rgba(212, 175, 55, 0.15);
  }
}
```

### CSS Variables (Plain CSS)

```css
:root {
  /* Foundation */
  --mafia-base: #0B0B0C;
  --mafia-surface: #121214;
  --mafia-bronze: #2A2415;
  --mafia-gold: #D4AF37;

  /* Text */
  --text-primary: #e2e2e2;
  --text-secondary: #d0c5af;
  --text-muted: #99907c;

  /* Spacing */
  --space-unit: 8px;
  --space-gutter: 24px;
  --container-max: 1200px;

  /* Typography */
  --font-serif: "Bodoni Moda", "Playfair Display", Georgia, serif;
  --font-sans: "Inter", system-ui, sans-serif;
}

body {
  background-color: var(--mafia-base);
  color: var(--text-primary);
  font-family: var(--font-sans);
}
```

### React/Styled Components

```typescript
export const theme = {
  colors: {
    mafia: {
      base: '#0B0B0C',
      surface: '#121214',
      bronze: '#2A2415',
      gold: '#D4AF37',
    },
    primary: {
      main: '#f2ca50',
      container: '#d4af37',
      onContainer: '#3c2f00',
    },
    text: {
      primary: '#e2e2e2',
      secondary: '#d0c5af',
      muted: '#99907c',
    },
  },
  spacing: {
    unit: 8,
    gutter: 24,
    marginMobile: 20,
    marginDesktop: 64,
    containerMax: 1200,
  },
  typography: {
    fonts: {
      serif: '"Bodoni Moda", "Playfair Display", Georgia, serif',
      sans: '"Inter", system-ui, sans-serif',
      hero: '"Playfair Display", serif',
      brand: '"Corleone", serif',
    },
    sizes: {
      h1: { mobile: '2.25rem', desktop: '3.5rem' },
      h2: { mobile: '1.5rem', desktop: '1.875rem' },
      h3: { mobile: '1.25rem', desktop: '1.5rem' },
      bodyLg: { mobile: '1.125rem', desktop: '1.25rem' },
      bodyMd: { mobile: '0.875rem', desktop: '1rem' },
      labelSm: '0.75rem',
    },
  },
  shadows: {
    goldGlow: '0 0 20px rgba(212, 175, 55, 0.15)',
    cardHover: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(212, 175, 55, 0.15)',
  },
  transitions: {
    standard: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },
};
```

### Vue/SCSS

```scss
// _variables.scss
$mafia-base: #0B0B0C;
$mafia-surface: #121214;
$mafia-bronze: #2A2415;
$mafia-gold: #D4AF37;

$text-primary: #e2e2e2;
$text-secondary: #d0c5af;

$space-unit: 8px;
$space-gutter: 24px;

$font-serif: "Bodoni Moda", "Playfair Display", Georgia, serif;
$font-sans: "Inter", system-ui, sans-serif;

// Mixins
@mixin interactive-card {
  border: 1px solid $mafia-bronze;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    border-color: $mafia-gold;
    transform: translateY(-4px);
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5),
                0 0 15px rgba(212, 175, 55, 0.15);
  }
}
```

---

## Design Tokens Export

### JSON Format

```json
{
  "color": {
    "mafia": {
      "base": { "value": "#0B0B0C" },
      "surface": { "value": "#121214" },
      "bronze": { "value": "#2A2415" },
      "gold": { "value": "#D4AF37" }
    },
    "primary": {
      "main": { "value": "#f2ca50" },
      "container": { "value": "#d4af37" },
      "on-container": { "value": "#3c2f00" }
    }
  },
  "spacing": {
    "unit": { "value": "8px" },
    "gutter": { "value": "24px" },
    "margin-mobile": { "value": "20px" },
    "margin-desktop": { "value": "64px" }
  },
  "typography": {
    "font-family": {
      "serif": { "value": "Bodoni Moda, Playfair Display, Georgia, serif" },
      "sans": { "value": "Inter, system-ui, sans-serif" },
      "hero": { "value": "Playfair Display, serif" }
    }
  }
}
```

---

## Version History

- **1.0.0** (June 2026) - Initial Empire Noir theme specification
  - Mafia aesthetic color palette
  - Typography system with Corleone custom font
  - Interactive card patterns
  - Responsive spacing system

---

## License & Usage

This theme specification is proprietary to **Grupo Cacharelo**. Use across all Grupo Cacharelo applications and brands is permitted. External use requires written permission.

**Brands using this theme:**
- Grupo Cacharelo (Corporate)
- Pastes y Empanadas
- Las Hamburguesas
- El Sabor de Antaño
- La Excelencia

---

## Resources

- **Font Files:** `/public/fonts/` (Corleone, Corleone Due)
- **Reference Implementation:** `apps/landing_page/frontend/src/index.css`
- **Component Library:** `apps/landing_page/frontend/src/components/`

For questions or updates, contact: desarrollo@cacharelo.com
