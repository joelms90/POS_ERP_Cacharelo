export type ImageMode = 'transparent' | 'circle' | 'ellipse' | 'soft-edge' | 'original';

export interface ImageTransform {
  scale: number;
  x: number;
  y: number;
  rotation: number;
}

export interface Dish {
  id: string;
  name: string;
  description?: string | null;
  price?: number | null;
  prices?: Record<string, number | null>;
  image?: string;
  imageProcessed?: string;
  imageMode?: ImageMode;
  imageTransform?: ImageTransform;
  tags?: string[];
  group?: string;
  featured?: boolean;
  review_required?: boolean;
  notes?: string;
}

export type LayoutTemplate = 'auto' | 'hero-one' | 'diagonal-two' | 'editorial-three' | 'editorial-four' | 'dense-list' | 'columnar-table';

export interface MenuSection {
  id: string;
  name: string;
  subtitle?: string | null;
  description?: string | null;
  kicker?: string;
  quote?: string;
  notes?: string | string[];
  review_required?: boolean;
  layoutTemplate?: LayoutTemplate;
  priceHeaders?: string[];
  dishes: Dish[];
}

export interface Restaurant {
  name: string;
  logo: string;
  slogan?: string;
  contact?: string;
  currency?: string;
}

export interface Cover {
  enabled: boolean;
  title: string;
  subtitle?: string;
  slogan?: string;
  footer?: string;
  tagline?: string;
  backgroundImage?: string;
  backgroundOverlayOpacity?: number;
  backgroundBlur?: number;
  cardMode?: 'floating-card' | 'full-bleed' | 'framed';
  style: 'minimal-gold' | 'wood-table' | 'dark-luxury' | 'editorial-clean';
}

export interface MenuTheme {
  name: string;
  pageBackground: string; // e.g. '#FAF7F2' or '#FFFFFF'
  textColor: string;      // e.g. '#17130E'
  accentColor: string;    // e.g. '#B88B53' or '#A48246' (gold)
  secondaryColor: string; // e.g. '#5C5449'
  borderColor: string;    // e.g. '#222222' or '#C5A46E'
  headingFont: 'cormorant' | 'playfair' | 'cinzel' | 'baskerville' | 'montserrat';
  bodyFont: 'baskerville' | 'inter' | 'montserrat';
  cardStyle: 'cacharelo-classic' | 'luxury-clean' | 'gold-border';
  dishBackdrop: 'black-circle' | 'white-ring' | 'soft-shadow' | 'none';
  pageSize: 'letter' | 'a4';
  showPageNumbers: boolean;
}

export interface MenuCatalog {
  version: string;
  id: string;
  title: string;
  restaurant: Restaurant;
  cover: Cover;
  sections: MenuSection[];
  theme: MenuTheme;
}
