import React from 'react';
import type { Cover, MenuTheme, Restaurant } from '../../../types/menu';

interface HorizontalCoverPageProps {
  cover: Cover;
  restaurant: Restaurant;
  theme?: MenuTheme;
}

export const HorizontalCoverPage: React.FC<HorizontalCoverPageProps> = ({
  cover,
  restaurant
}) => {
  // Warm metallic gold tones matching vertical CoverPage
  const WARM_GOLD = '#C8A265';
  const METALLIC_GOLD = '#D4AF37';
  const SCRIPT_GOLD = '#E5C384';

  const overlayOpacity = cover.backgroundOverlayOpacity ?? 0.25;
  const blur = cover.backgroundBlur ?? 0;
  const backgroundImage =
    cover.backgroundImageHorizontal ||
    (cover.backgroundImage && cover.backgroundImage.includes('Horizontal')
      ? cover.backgroundImage
      : '/backgrounds/Cacharelo_Horizontal.jpeg');
  const logoSrc = restaurant.logo || '/branding/cacharelo-cofee-gold-logo.png';
  const categoriesSubline = cover.footer || 'DESAYUNOS  •  COMIDAS  •  CAFÉ  •  MOMENTOS';
  const tagline = cover.tagline || '"Aquí sabe mejor"';

  return (
    <div
      className="menu-page relative w-full h-full flex flex-col items-center justify-between select-none overflow-hidden"
      style={{
        backgroundColor: '#141416',
        color: '#FAF7F2'
      }}
    >
      {/* 0. Vector Background Base: Guarantees dark tone even if browser background printing is off */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <rect width="100" height="100" fill="#141416" />
      </svg>

      {/* 1. Full-Bleed Horizontal Cover Photo Background (Cacharelo_Horizontal.jpeg) */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img
          src={backgroundImage}
          alt="Cafetería Cacharelo Portada Horizontal"
          className="w-full h-full object-cover transition-transform duration-500"
          style={{
            filter: blur > 0 ? `blur(${blur}px)` : undefined,
            transform: blur > 0 ? 'scale(1.03)' : 'none'
          }}
        />

        {/* 2. Vector Readability Gradient Overlay */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-1"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <defs>
            <linearGradient id="coverReadabilityGradHorizontal" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#000000" stopOpacity={Math.min(0.85, 0.40 + overlayOpacity * 0.4)} />
              <stop offset="22%" stopColor="#000000" stopOpacity={overlayOpacity * 0.45} />
              <stop offset="48%" stopColor="#000000" stopOpacity={overlayOpacity * 0.15} />
              <stop offset="72%" stopColor="#000000" stopOpacity={overlayOpacity * 0.3} />
              <stop offset="100%" stopColor="#000000" stopOpacity={Math.min(0.92, 0.50 + overlayOpacity * 0.45)} />
            </linearGradient>
          </defs>
          <rect width="100" height="100" fill="url(#coverReadabilityGradHorizontal)" />
        </svg>
      </div>

      {/* 3. Decorative Framing: Minimal, thin, single-line gold inset border matching vertical portada */}
      <div
        className="absolute inset-6 pointer-events-none z-10"
        style={{
          border: `1px solid ${METALLIC_GOLD}`,
          opacity: 0.85,
          boxShadow: 'inset 0 0 15px rgba(0,0,0,0.2)'
        }}
      />

      {/* 4. Top Block: Single Crisp Gold Vector Logo -> — CAFETERÍA — -> BUEN CAFÉ, GRANDES MOMENTOS */}
      <div className="relative z-20 w-full flex flex-col items-center text-center pt-8 px-8">
        {logoSrc ? (
          <img
            src={logoSrc}
            alt={restaurant.name || 'Cacharelo'}
            className="h-20 sm:h-24 w-auto object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] mb-2 transition-transform hover:scale-105"
          />
        ) : (
          <div
            className="w-16 h-16 rounded-full border-2 flex items-center justify-center mb-2 font-cinzel font-bold text-2xl drop-shadow-md"
            style={{ borderColor: METALLIC_GOLD, color: METALLIC_GOLD }}
          >
            {restaurant.name?.charAt(0) || 'C'}
          </div>
        )}

        {/* — CAFETERÍA — (spaced uppercase sans-serif in warm metallic gold) */}
        <div
          className="font-montserrat text-xs sm:text-sm font-semibold uppercase tracking-[0.45em] drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] my-0.5"
          style={{
            color: METALLIC_GOLD,
            textShadow: '0 1px 4px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.6)'
          }}
        >
          — C A F E T E R Í A —
        </div>

        {/* BUEN CAFÉ, GRANDES MOMENTOS (spaced uppercase sans-serif) */}
        <div
          className="font-montserrat text-[11px] sm:text-xs font-semibold uppercase tracking-[0.3em] drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] mt-0.5 opacity-95"
          style={{
            color: WARM_GOLD,
            textShadow: '0 1px 4px rgba(0,0,0,0.9)'
          }}
        >
          {restaurant.slogan || cover.slogan || 'BUEN CAFÉ, GRANDES MOMENTOS'}
        </div>
      </div>

      {/* 5. Center Focal Hero Area: Clean and unobstructed so the 16:9 cafe photo is celebrated */}
      <div className="relative z-10 flex-1 w-full flex items-center justify-center pointer-events-none">
        {cover.title && cover.title.trim() !== '' && cover.title.trim().toUpperCase() !== 'MENÚ' && (
          <div className="text-center px-6 py-2">
            <h1
              className="text-3xl sm:text-4xl font-cormorant font-bold uppercase tracking-[0.2em] drop-shadow-xl"
              style={{ color: METALLIC_GOLD }}
            >
              {cover.title}
            </h1>
            {cover.subtitle && (
              <p
                className="text-sm sm:text-base font-baskerville italic mt-1 drop-shadow-md"
                style={{ color: SCRIPT_GOLD }}
              >
                {cover.subtitle}
              </p>
            )}
          </div>
        )}
      </div>

      {/* 6. Bottom Block:
             - Categories subline: DESAYUNOS • COMIDAS • CAFÉ • MOMENTOS (spaced uppercase sans-serif in warm gold)
             - Script Tagline beneath categories: "Aquí sabe mejor" in elegant handwritten/calligraphy font
      */}
      <div className="relative z-20 w-full flex flex-col items-center text-center pb-8 px-8">
        {/* Categories subline */}
        <p
          className="font-montserrat text-xs sm:text-sm font-semibold uppercase tracking-[0.32em] mb-1.5 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]"
          style={{
            color: METALLIC_GOLD,
            textShadow: '0 2px 6px rgba(0,0,0,0.95), 0 0 12px rgba(0,0,0,0.6)'
          }}
        >
          {categoriesSubline}
        </p>

        {/* Script Tagline in elegant calligraphy cursive */}
        <p
          className="font-script text-3xl sm:text-4xl font-normal drop-shadow-[0_3px_8px_rgba(0,0,0,0.95)] tracking-wide"
          style={{
            color: SCRIPT_GOLD,
            textShadow: '0 2px 8px rgba(0,0,0,0.95), 0 0 15px rgba(212,175,55,0.3)'
          }}
        >
          {tagline.startsWith('"') || tagline.startsWith('“') ? tagline : `"${tagline}"`}
        </p>
      </div>
    </div>
  );
};
