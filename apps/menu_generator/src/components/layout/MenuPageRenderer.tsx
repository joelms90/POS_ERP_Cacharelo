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

// Authentic Cacharelo vector cup mark (left handle + C cup outline + steam plumes)
export const CachareloCupIcon: React.FC<{ className?: string }> = ({ className = 'h-8 w-auto' }) => (
  <svg
    viewBox="0 0 83 175"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M 31.00 58.00 L 28.50 59.50 L 26.75 61.25 L 24.00 66.00 L 23.25 70.00 L 23.00 81.25 L 22.25 81.75 L 19.75 79.25 L 16.00 77.00 L 15.00 77.00 L 14.00 76.50 L 10.50 76.50 L 9.75 77.00 L 8.75 77.00 L 6.00 78.75 L 4.25 80.75 L 2.00 85.00 L 2.00 86.00 L 1.00 88.50 L 0.75 91.25 L 0.00 92.50 L 0.00 141.75 L 0.75 143.00 L 1.00 146.25 L 2.00 148.75 L 2.00 149.75 L 4.75 154.75 L 7.00 157.00 L 9.50 158.50 L 11.25 158.75 L 15.50 158.50 L 18.25 157.50 L 22.50 154.75 L 23.00 155.25 L 23.25 159.00 L 24.00 160.75 L 24.00 162.25 L 25.00 164.25 L 25.00 165.25 L 26.00 167.00 L 26.25 168.25 L 27.00 169.00 L 27.00 169.50 L 29.25 172.00 L 31.25 173.50 L 32.75 174.00 L 33.25 174.75 L 42.25 174.75 L 42.75 174.25 L 45.75 173.75 L 50.75 173.75 L 55.75 173.25 L 57.75 172.75 L 62.50 172.75 L 69.75 171.75 L 74.50 171.50 L 77.25 170.25 L 79.75 168.00 L 81.75 164.50 L 81.75 163.00 L 82.75 161.25 L 82.75 153.75 L 82.00 153.00 L 81.50 151.00 L 80.25 150.00 L 78.00 150.00 L 77.25 150.50 L 76.25 153.00 L 76.00 161.00 L 75.75 161.75 L 74.25 163.75 L 71.50 164.75 L 66.75 165.00 L 60.00 166.00 L 36.50 166.00 L 33.75 164.25 L 32.00 162.50 L 30.75 160.50 L 30.00 157.25 L 29.75 144.25 L 29.75 77.50 L 30.00 71.75 L 30.75 69.75 L 31.75 68.25 L 33.25 66.75 L 35.00 65.75 L 50.25 65.75 L 57.25 66.00 L 65.25 66.75 L 70.00 66.75 L 73.00 67.75 L 74.75 69.50 L 76.00 72.00 L 76.25 76.25 L 78.50 78.50 L 80.00 78.50 L 81.50 77.00 L 82.00 75.25 L 82.75 74.25 L 82.75 70.00 L 81.75 68.75 L 81.75 67.75 L 80.50 65.25 L 78.25 63.00 L 75.50 61.25 L 74.00 61.00 L 72.25 60.00 L 70.75 60.00 L 66.75 59.00 L 63.75 59.00 L 59.25 58.00 L 55.75 58.00 L 53.50 57.50 L 47.00 57.00 L 34.25 57.00 Z M 11.75 84.75 L 15.25 84.75 L 17.25 86.00 L 18.75 87.75 L 20.00 91.00 L 20.25 95.75 L 21.25 98.00 L 23.00 99.25 L 23.00 133.75 L 21.00 136.25 L 20.00 145.00 L 19.00 147.50 L 16.50 149.75 L 14.25 150.25 L 11.00 150.00 L 8.75 148.75 L 8.00 148.00 L 6.75 145.75 L 5.75 142.00 L 5.75 92.75 L 6.75 89.25 L 7.75 88.00 L 7.75 87.50 L 9.50 85.75 Z M 58.75 5.00 L 58.00 5.25 L 57.00 6.50 L 55.25 10.00 L 55.00 15.00 L 56.00 17.50 L 56.25 19.00 L 59.00 23.75 L 59.00 24.25 L 60.00 25.25 L 60.25 26.25 L 61.00 27.25 L 61.25 32.00 L 62.00 31.75 L 62.75 30.75 L 63.00 27.00 L 62.75 25.25 L 61.75 23.50 L 61.75 22.75 L 57.75 14.75 L 57.75 8.00 L 58.50 6.75 Z M 52.50 0.75 L 50.00 3.00 L 48.00 5.50 L 46.00 9.25 L 45.25 12.00 L 45.25 20.00 L 47.00 25.50 L 48.00 27.00 L 50.00 31.50 L 53.00 36.00 L 54.75 40.00 L 55.50 43.50 L 55.50 46.00 L 55.00 47.50 L 55.75 48.50 L 56.75 47.25 L 57.75 45.00 L 58.00 42.50 L 57.75 35.75 L 56.75 33.75 L 56.75 33.00 L 55.75 31.50 L 55.75 30.75 L 55.00 29.75 L 52.75 24.50 L 50.75 20.75 L 50.50 19.50 L 49.75 18.25 L 49.00 14.25 L 49.75 8.50 L 50.75 6.00 L 50.75 5.00 L 52.50 1.75 Z"
      fill="currentColor"
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
      <header className="relative z-10 w-full flex items-center justify-between pb-3 pt-1 border-b border-[#C8A265]/35">
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

        {/* Right: Minimalist Brand Header (Logo + CAFETERÍA below, transparent, no borders) */}
        <div className="flex flex-col items-center justify-center shrink-0 pl-3">
          {restaurant.logo ? (
            <img
              src={restaurant.logo.normalize('NFC').split('/').map(p => p ? encodeURIComponent(p) : p).join('/')}
              alt={restaurant.name}
              className="h-20 sm:h-24 w-auto object-contain drop-shadow-xs"
            />
          ) : (
            <span
              className="font-cormorant font-bold text-3xl sm:text-4xl uppercase tracking-[0.2em] leading-none"
              style={{ color: CHARCOAL }}
            >
              {restaurant.name}
            </span>
          )}

          <span
            className="text-[12px] sm:text-[14px] font-montserrat uppercase tracking-[0.32em] font-semibold mt-1.5 leading-none"
            style={{ color: WARM_GOLD }}
          >
            — CAFETERÍA —
          </span>
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
