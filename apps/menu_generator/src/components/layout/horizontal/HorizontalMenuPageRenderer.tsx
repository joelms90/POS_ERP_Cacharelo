import React from 'react';
import type { MenuSection, MenuTheme, Restaurant } from '../../../types/menu';
import { HorizontalSplitLayout } from './HorizontalSplitLayout';
import { HorizontalGridLayout } from './HorizontalGridLayout';
import { HorizontalDenseLayout } from './HorizontalDenseLayout';

interface HorizontalMenuPageRendererProps {
  section: MenuSection;
  theme: MenuTheme;
  restaurant: Restaurant;
  pageNumber?: number;
  totalPages?: number;
}

export const HorizontalMenuPageRenderer: React.FC<HorizontalMenuPageRendererProps> = ({
  section,
  theme,
  restaurant,
  pageNumber
}) => {
  const WARM_GOLD = '#C8A265';
  const CHARCOAL = '#2D2926';

  // Determine which layout best fits the section in 16:9 widescreen
  const dishes = section.dishes;
  const dishesWithImage = dishes.filter((d) => Boolean(d.image || d.imageProcessed));

  let layoutType: 'split' | 'grid' | 'dense' = 'split';

  if (section.layoutTemplate === 'dense-list' || dishes.length > 12) {
    layoutType = 'dense';
  } else if (
    section.layoutTemplate === 'editorial-three' ||
    section.layoutTemplate === 'editorial-four' ||
    (dishesWithImage.length >= 3 && dishes.length <= 8)
  ) {
    layoutType = 'grid';
  } else {
    layoutType = 'split';
  }

  return (
    <div
      className="menu-page relative w-full h-full flex flex-col justify-between select-none overflow-hidden px-8 py-5"
      style={{
        backgroundColor: theme.pageBackground,
        color: theme.textColor
      }}
    >
      {/* 1. Subtle Inset Framing Border */}
      <div
        className="absolute inset-3 pointer-events-none z-0"
        style={{ border: `1px solid ${WARM_GOLD}30` }}
      />
      <div
        className="absolute inset-4 pointer-events-none z-0"
        style={{ border: `1px solid ${WARM_GOLD}15` }}
      />

      {/* 2. Panoramic Header (Compact for 16:9 vertical space) */}
      <header className="relative z-10 w-full flex items-center justify-between pb-2 border-b border-[#C8A265]/35">
        {/* Left: Restaurant Branding */}
        <div className="flex items-center gap-3">
          {restaurant.logo ? (
            <img
              src={restaurant.logo}
              alt={restaurant.name}
              className="h-9 w-auto object-contain"
            />
          ) : (
            <span
              className="font-cormorant font-bold text-xl uppercase tracking-widest"
              style={{ color: CHARCOAL }}
            >
              {restaurant.name}
            </span>
          )}
          <div className="h-4 w-[1px] bg-[#C8A265]/40" />
          <span
            className="text-[10px] font-montserrat uppercase tracking-[0.25em] font-semibold text-[#C8A265]"
          >
            CAFETERÍA
          </span>
        </div>

        {/* Center: Category Title & Subtitle */}
        <div className="flex flex-col items-center text-center">
          <h2
            className="text-2xl sm:text-3xl font-bold font-cormorant tracking-[0.14em] uppercase leading-none"
            style={{ color: CHARCOAL }}
          >
            {section.name}
          </h2>
          {section.subtitle ? (
            <span
              className="text-[10px] font-baskerville italic text-[#C8A265] mt-0.5 tracking-wide"
            >
              {section.subtitle}
            </span>
          ) : section.kicker ? (
            <span
              className="text-[9px] font-montserrat uppercase tracking-[0.2em] text-[#C8A265] mt-0.5"
            >
              — {section.kicker} —
            </span>
          ) : null}
        </div>

        {/* Right: Category Badge / Tagline */}
        <div className="text-right">
          <span
            className="text-[10px] font-montserrat uppercase tracking-[0.2em] font-medium text-zinc-500"
          >
            {restaurant.slogan || 'Especialidades'}
          </span>
        </div>
      </header>

      {/* 3. Main 16:9 Layout Body */}
      <main className="relative z-10 w-full flex-1 flex flex-col justify-center overflow-hidden my-1">
        {layoutType === 'split' && <HorizontalSplitLayout section={section} theme={theme} />}
        {layoutType === 'grid' && <HorizontalGridLayout section={section} theme={theme} />}
        {layoutType === 'dense' && <HorizontalDenseLayout section={section} theme={theme} />}
      </main>

      {/* 4. Panoramic Slim Footer */}
      <footer className="relative z-10 w-full flex items-center justify-between pt-2 border-t border-[#C8A265]/35 text-[10px] font-montserrat uppercase">
        {/* Left: Restaurant Name */}
        <div className="w-32 text-left font-cormorant font-bold text-xs tracking-wider opacity-70" style={{ color: CHARCOAL }}>
          {restaurant.name}
        </div>

        {/* Center: Slogan */}
        <div className="flex-1 flex items-center justify-center gap-3 px-2">
          <div className="h-0 flex-1 max-w-xs border-t border-[#C8A265]/40" />
          <span
            className="tracking-[0.25em] font-medium text-[9px] whitespace-nowrap opacity-90 text-[#5C5449]"
          >
            — CAFÉ • SABORES • BUENA COMPAÑÍA —
          </span>
          <div className="h-0 flex-1 max-w-xs border-t border-[#C8A265]/40" />
        </div>

        {/* Right: Page Number */}
        <div className="w-32 text-right font-cormorant font-semibold text-xs tracking-wider text-[#C8A265]">
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
