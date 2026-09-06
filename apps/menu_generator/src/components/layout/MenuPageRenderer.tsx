import React from 'react';
import type { MenuSection, MenuTheme, Restaurant, LayoutTemplate } from '../../types/menu';
import { HeroOneLayout } from './HeroOneLayout';
import { DiagonalTwoLayout } from './DiagonalTwoLayout';
import { EditorialThreeLayout } from './EditorialThreeLayout';
import { EditorialFourLayout } from './EditorialFourLayout';
import { DenseListLayout } from './DenseListLayout';
import { ColumnarTableLayout } from './ColumnarTableLayout';

interface MenuPageRendererProps {
  section: MenuSection;
  theme: MenuTheme;
  restaurant: Restaurant;
  pageNumber?: number;
  totalPages?: number;
  showHeaderTitle?: boolean;
}

// Delicate botanical line-art flourish for corners
const BotanicalCornerFlourish: React.FC<{ className?: string; flipped?: boolean }> = ({
  className = '',
  flipped = false
}) => (
  <svg
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`w-14 h-14 sm:w-16 sm:h-16 pointer-events-none opacity-20 transition-opacity ${
      flipped ? 'scale-x-[-1]' : ''
    } ${className}`}
  >
    {/* Delicate botanical branches and leaves in warm gold */}
    <path
      d="M15 85 C25 70, 40 50, 85 15"
      stroke="#C8A265"
      strokeWidth="1"
      strokeLinecap="round"
    />
    <path
      d="M30 68 C35 60, 45 62, 42 52 C38 45, 30 55, 30 68 Z"
      fill="#C8A265"
      opacity="0.75"
    />
    <path
      d="M50 50 C58 45, 62 52, 65 42 C60 38, 52 42, 50 50 Z"
      fill="#C8A265"
      opacity="0.75"
    />
    <path
      d="M68 32 C75 28, 78 33, 82 25 C76 22, 70 25, 68 32 Z"
      fill="#C8A265"
      opacity="0.75"
    />
    <path
      d="M20 78 C22 72, 28 74, 26 69 C23 65, 18 70, 20 78 Z"
      fill="#C8A265"
      opacity="0.6"
    />
    <circle cx="85" cy="15" r="1.5" fill="#C8A265" />
    <path
      d="M10 90 L10 65 M10 90 L35 90"
      stroke="#C8A265"
      strokeWidth="0.75"
      strokeLinecap="round"
      opacity="0.6"
    />
  </svg>
);

export const MenuPageRenderer: React.FC<MenuPageRendererProps> = ({
  section,
  theme,
  restaurant,
  pageNumber,
  showHeaderTitle = true
}) => {
  // Constants for luxury editorial palette
  const WARM_GOLD = '#C8A265';
  const CHARCOAL = '#2D2926';
  const MUTED_BRONZE = '#5C5449';

  // Determine layout template
  const getLayout = (): LayoutTemplate => {
    if (section.layoutTemplate && section.layoutTemplate !== 'auto') {
      return section.layoutTemplate;
    }
    // Auto-detect multi-size or beverage table
    if (section.priceHeaders && section.priceHeaders.length > 0) {
      return 'columnar-table';
    }
    const hasMultiplePrices = section.dishes.some(
      (d) => d.prices && Object.keys(d.prices).length > 0
    );
    if (hasMultiplePrices) {
      return 'columnar-table';
    }

    const count = section.dishes.length;
    if (count === 1) return 'hero-one';
    if (count === 2) return 'diagonal-two';
    if (count === 3) return 'editorial-three';
    if (count === 4) return 'editorial-four';
    return 'dense-list';
  };

  const layout = getLayout();
  const kickerText = section.kicker || 'NUESTRA COCINA, TU MOMENTO';
  const quoteText = section.quote || '“Comer bien también es un placer”';

  return (
    <div
      className="menu-page relative w-full h-full flex flex-col justify-between p-8 sm:p-10 select-none overflow-hidden"
      style={{
        backgroundColor: theme.pageBackground || '#FAF7F2',
        color: theme.textColor || CHARCOAL
      }}
    >
      {/* 0. Vector Page Background: Preserves warm cream/linen tone even if "Background graphics" is disabled */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <rect width="100" height="100" fill={theme.pageBackground || '#FAF7F2'} />
      </svg>

      {/* 1. Subtle Editorial Lighting Overlay: Vector radial gradient */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-1 opacity-45"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <defs>
          <radialGradient id="editorialLightGrad" cx="75%" cy="20%" r="70%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
            <stop offset="60%" stopColor="#C8A265" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.02" />
          </radialGradient>
        </defs>
        <rect width="100" height="100" fill="url(#editorialLightGrad)" />
      </svg>

      {/* 2. Refined Double-Line Border in Muted Warm Gold */}
      {/* Outer Border (1px) */}
      <div
        className="absolute inset-4 sm:inset-5 rounded-2xl pointer-events-none z-20 transition-all"
        style={{
          border: `1px solid ${WARM_GOLD}65`,
          boxShadow: 'inset 0 0 20px rgba(200, 162, 101, 0.03)'
        }}
      />
      {/* Inner Hairline Border (0.5px) */}
      <div
        className="absolute inset-5.5 sm:inset-6.5 rounded-xl pointer-events-none z-20 transition-all"
        style={{
          border: `0.5px solid ${WARM_GOLD}35`
        }}
      />

      {/* 3. Subtle Botanical Line-Art Flourishes in Bottom Corners */}
      <div className="absolute bottom-5 left-5 z-15 pointer-events-none">
        <BotanicalCornerFlourish />
      </div>
      <div className="absolute bottom-5 right-5 z-15 pointer-events-none">
        <BotanicalCornerFlourish flipped />
      </div>

      {/* 4. Top Header of Category Page */}
      <header className="relative z-10 w-full flex items-start justify-between pb-3 pt-1 border-b border-[#C8A265]/35">
        {/* Left: Kicker + Category Title + Subtitle */}
        <div className="flex flex-col flex-1 pr-4">
          {/* Top Kicker: 8-9pt, uppercase, tracking +200 */}
          <span
            className="text-[9px] sm:text-[10px] font-montserrat uppercase tracking-[0.25em] font-semibold mb-1"
            style={{ color: WARM_GOLD }}
          >
            {kickerText}
          </span>

          {/* Category Title: High-contrast display serif */}
          {showHeaderTitle && (
            <h2
              className="text-3xl sm:text-4xl lg:text-5xl font-cormorant font-bold tracking-[0.14em] uppercase leading-none"
              style={{
                color: CHARCOAL,
                textShadow: '0 1px 2px rgba(0,0,0,0.04)'
              }}
            >
              {section.name}
            </h2>
          )}

          {/* Subtitle: Clean sans-serif with wide tracking */}
          {section.subtitle && (
            <p
              className="text-[10px] sm:text-[11px] font-montserrat font-medium uppercase tracking-[0.25em] opacity-85 mt-1.5"
              style={{ color: MUTED_BRONZE }}
            >
              {section.subtitle}
            </p>
          )}
        </div>

        {/* Right: Decorative Script Accent Quote + Full Horizontal Logo Lockup */}
        <div className="flex flex-col items-end shrink-0 pl-2">
          {/* Top-Right Logo Lockup: Full horizontal lockup (Cacharelo + steam mark + CAFETERÍA below) */}
          <div className="flex items-center gap-2.5 mb-1.5">
            {restaurant.logo ? (
              <img
                src={restaurant.logo}
                alt={restaurant.name}
                className="h-9 sm:h-10 w-auto object-contain drop-shadow-xs"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-full border border-[#C8A265] flex items-center justify-center font-cinzel font-bold text-xs"
                style={{ color: WARM_GOLD }}
              >
                {restaurant.name.charAt(0)}
              </div>
            )}

            <div className="flex flex-col text-right">
              <span
                className="font-cormorant font-bold text-base sm:text-lg tracking-[0.12em] uppercase leading-tight"
                style={{ color: CHARCOAL }}
              >
                {restaurant.name}
              </span>
              <span
                className="text-[8px] sm:text-[9px] font-montserrat uppercase tracking-[0.3em] font-semibold leading-none"
                style={{ color: WARM_GOLD }}
              >
                — CAFETERÍA —
              </span>
            </div>
          </div>

          {/* Decorative Script Accent: Angled handwritten/italic quote */}
          <div className="mt-1 transform -rotate-2 origin-top-right">
            <span
              className="font-cormorant italic text-xs sm:text-[13px] tracking-wide"
              style={{ color: '#8C7A65' }}
            >
              {quoteText}
            </span>
          </div>
        </div>
      </header>

      {/* 5. Main Dynamic Layout Body */}
      <main className="relative z-10 w-full flex-1 flex flex-col justify-center my-2 overflow-hidden">
        {layout === 'hero-one' && <HeroOneLayout section={section} theme={theme} />}
        {layout === 'diagonal-two' && <DiagonalTwoLayout section={section} theme={theme} />}
        {layout === 'editorial-three' && <EditorialThreeLayout section={section} theme={theme} />}
        {layout === 'editorial-four' && <EditorialFourLayout section={section} theme={theme} />}
        {layout === 'dense-list' && <DenseListLayout section={section} theme={theme} />}
        {layout === 'columnar-table' && <ColumnarTableLayout section={section} theme={theme} />}
      </main>

      {/* 6. Centered Micro-Footer with Hairline Rules & Page Numbers */}
      <footer className="relative z-10 w-full flex items-center justify-between pt-3 text-[10px] sm:text-[11px] font-montserrat uppercase">
        {/* Left corner: Restaurant Name */}
        <div className="w-24 text-left font-cormorant font-bold text-xs tracking-wider opacity-70" style={{ color: CHARCOAL }}>
          {restaurant.name}
        </div>

        {/* Center: Micro-footer flanked by subtle hairline rules */}
        <div className="flex-1 flex items-center justify-center gap-3 max-w-sm mx-auto px-2">
          <div className="h-0 flex-1 border-t border-[#C8A265]/45" />
          <span
            className="tracking-[0.25em] font-medium text-[9px] sm:text-[10px] whitespace-nowrap opacity-90"
            style={{ color: MUTED_BRONZE }}
          >
            — CAFÉ • SABORES • BUENA COMPAÑÍA —
          </span>
          <div className="h-0 flex-1 border-t border-[#C8A265]/45" />
        </div>

        {/* Right corner: Page Number */}
        <div className="w-24 text-right font-cormorant font-semibold text-xs tracking-wider" style={{ color: WARM_GOLD }}>
          {theme.showPageNumbers && pageNumber !== undefined ? (
            <span>PÁG. {pageNumber}</span>
          ) : (
            <span className="opacity-60">{restaurant.slogan || 'Cacharelo'}</span>
          )}
        </div>
      </footer>
    </div>
  );
};
