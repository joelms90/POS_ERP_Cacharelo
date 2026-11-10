import React from 'react';
import type { Cover, MenuTheme, Restaurant } from '../../types/menu';

interface CoverPageProps {
  cover: Cover;
  restaurant: Restaurant;
  theme: MenuTheme;
}

export const CoverPage: React.FC<CoverPageProps> = ({ cover, restaurant, theme }) => {
  // Warm metallic gold tones matching wood tones (#C8A265, #D4AF37, #E5C384)
  const WARM_GOLD = '#C8A265';
  const METALLIC_GOLD = '#D4AF37';
  const SCRIPT_GOLD = '#E5C384';

  const isFloatingCard = cover.cardMode === 'floating-card';
  const overlayOpacity = cover.backgroundOverlayOpacity ?? 0.25;
  const blur = cover.backgroundBlur ?? 0;
  const rawBackgroundImage = cover.backgroundImage || '/backgrounds/cafe-interior-cover.png';
  const backgroundImage = rawBackgroundImage
    ? rawBackgroundImage.normalize('NFC').split('/').map(p => p ? encodeURIComponent(p) : p).join('/')
    : rawBackgroundImage;
  const rawLogoSrc = restaurant.logo || '/branding/cacharelo-cofee-gold-logo.png';
  const logoSrc = rawLogoSrc
    ? rawLogoSrc.normalize('NFC').split('/').map(p => p ? encodeURIComponent(p) : p).join('/')
    : rawLogoSrc;
  const categoriesSubline = cover.footer || 'DESAYUNOS  •  COMIDAS  •  CAFÉ  •  MOMENTOS';
  const tagline = cover.tagline || '"Aquí sabe mejor"';

  // If floating card mode is explicitly selected by user
  if (isFloatingCard) {
    return (
      <div
        className="menu-page relative w-full h-full flex flex-col items-center justify-between select-none overflow-hidden"
        style={{
          backgroundColor: theme.pageBackground,
          color: theme.textColor
        }}
      >
        {/* Background Layer */}
        {backgroundImage && (
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            <img
              src={backgroundImage}
              alt="Cover Background"
              className="w-full h-full object-cover"
              style={{
                filter: blur > 0 ? `blur(${blur}px)` : undefined
              }}
            />
            <div
              className="absolute inset-0 bg-white"
              style={{ opacity: overlayOpacity }}
            />
          </div>
        )}

        {/* Inset Gold Frame */}
        <div
          className="absolute inset-6 sm:inset-8 pointer-events-none z-10"
          style={{ border: `1px solid ${METALLIC_GOLD}80` }}
        />

        {/* Floating Card Container */}
        <div className="relative z-10 w-full h-full flex items-center justify-center p-8">
          <div className="relative w-[60%] sm:w-[54%] h-[82%] flex flex-col items-center justify-between p-8 sm:p-10 shadow-2xl rounded-sm bg-white text-zinc-900 text-center border border-black/5">
            <div className="flex flex-col items-center pt-2">
              <img
                src={logoSrc}
                alt={restaurant.name}
                className="h-20 sm:h-24 w-auto object-contain mb-2"
              />
              <span
                className="text-[10px] sm:text-xs font-montserrat uppercase tracking-[0.35em] font-semibold my-0.5"
                style={{ color: METALLIC_GOLD }}
              >
                — C A F E T E R Í A —
              </span>
              <span className="text-[10px] sm:text-[11px] font-montserrat uppercase tracking-[0.25em] font-medium text-zinc-600">
                {restaurant.slogan || cover.slogan || 'BUEN CAFÉ, GRANDES MOMENTOS'}
              </span>
            </div>

            <div className="flex flex-col items-center my-auto">
              <h1 className="text-5xl sm:text-6xl font-cormorant font-bold tracking-[0.18em] uppercase text-zinc-950">
                {cover.title || 'MENÚ'}
              </h1>
              {cover.subtitle && (
                <p className="text-xs sm:text-sm font-baskerville italic text-zinc-600 mt-2">
                  {cover.subtitle}
                </p>
              )}
            </div>

            <div className="flex flex-col items-center pb-2 text-center">
              <p
                className="text-[11px] sm:text-xs font-montserrat uppercase tracking-[0.25em] font-semibold mb-1"
                style={{ color: METALLIC_GOLD }}
              >
                {categoriesSubline}
              </p>
              <p className="font-script text-2xl sm:text-3xl text-amber-700">
                {tagline}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // STANDARD TARGET DESIGN: Full Bleed Cafe Photograph + Direct Gold Overlays
  return (
    <div
      className="menu-page relative w-full h-full flex flex-col items-center justify-between select-none overflow-hidden"
      style={{
        backgroundColor: '#141416',
        color: '#FAF7F2'
      }}
    >
      {/* 0. Vector Background Base: Guarantees dark tone even if browser "Background graphics" is unchecked */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <rect width="100" height="100" fill="#141416" />
      </svg>

      {/* 1. Full-Bleed Cafe Interior Photo Background (HTML Image element - Always printed by browser) */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img
          src={backgroundImage}
          alt="Cafetería Cacharelo Portada"
          className="w-full h-full object-cover transition-transform duration-500"
          style={{
            filter: blur > 0 ? `blur(${blur}px)` : undefined,
            transform: blur > 0 ? 'scale(1.05)' : 'none'
          }}
        />

        {/* 2. Vector Readability Gradient Overlay:
             Implemented as an SVG vector fill with linearGradient so that Chrome's print engine
             NEVER strips it when the user has "Background graphics" disabled in the print dialog.
        */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-1"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <defs>
            <linearGradient id="coverReadabilityGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#000000" stopOpacity={Math.min(0.85, 0.40 + overlayOpacity * 0.4)} />
              <stop offset="22%" stopColor="#000000" stopOpacity={overlayOpacity * 0.45} />
              <stop offset="45%" stopColor="#000000" stopOpacity={overlayOpacity * 0.15} />
              <stop offset="68%" stopColor="#000000" stopOpacity={overlayOpacity * 0.25} />
              <stop offset="100%" stopColor="#000000" stopOpacity={Math.min(0.92, 0.50 + overlayOpacity * 0.45)} />
            </linearGradient>
          </defs>
          <rect width="100" height="100" fill="url(#coverReadabilityGrad)" />
        </svg>
      </div>

      {/* 3. Decorative Framing: Minimal, thin, single-line gold inset border offset ~20-30px from all outer edges */}
      <div
        className="absolute inset-6 sm:inset-7 md:inset-8 pointer-events-none z-10"
        style={{
          border: `1px solid ${METALLIC_GOLD}`,
          opacity: 0.85,
          boxShadow: 'inset 0 0 15px rgba(0,0,0,0.2)'
        }}
      />

      {/* 4. Top Block: Single Crisp Gold Vector Logo -> — CAFETERÍA — -> BUEN CAFÉ, GRANDES MOMENTOS */}
      <div className="relative z-20 w-full flex flex-col items-center text-center pt-10 sm:pt-14 md:pt-16 px-8">
        {/* Crisp Gold Vector Mark */}
        {logoSrc ? (
          <img
            src={logoSrc}
            alt={restaurant.name || 'Cacharelo'}
            className="h-28 sm:h-32 md:h-36 w-auto object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] mb-2.5 transition-transform hover:scale-105"
          />
        ) : (
          <div
            className="w-20 h-20 rounded-full border-2 flex items-center justify-center mb-2.5 font-cinzel font-bold text-3xl drop-shadow-md"
            style={{ borderColor: METALLIC_GOLD, color: METALLIC_GOLD }}
          >
            {restaurant.name?.charAt(0) || 'C'}
          </div>
        )}

        {/* — CAFETERÍA — (spaced uppercase sans-serif in warm metallic gold) */}
        <div
          className="font-montserrat text-xs sm:text-sm font-semibold uppercase tracking-[0.45em] drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] my-1"
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

      {/* 5. Center Focal Hero Area:
             The large center text "MENÚ / Cafetería & Cocina Artesanal" is completely removed.
             This allows the warm artisan cafe setting, coffee cup latte art, and marble table to take center stage!
             (If a non-standard title is explicitly set other than "MENÚ", it renders subtly)
      */}
      <div className="relative z-10 flex-1 w-full flex items-center justify-center pointer-events-none">
        {cover.title && cover.title.trim() !== '' && cover.title.trim().toUpperCase() !== 'MENÚ' && (
          <div className="text-center px-6 py-4">
            <h1
              className="text-4xl sm:text-5xl font-cormorant font-bold uppercase tracking-[0.2em] drop-shadow-xl"
              style={{ color: METALLIC_GOLD }}
            >
              {cover.title}
            </h1>
            {cover.subtitle && (
              <p
                className="text-sm sm:text-base font-baskerville italic mt-2 drop-shadow-md"
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
             - Omits website URL and social handle
      */}
      <div className="relative z-20 w-full flex flex-col items-center text-center pb-10 sm:pb-12 md:pb-14 px-8">
        {/* Categories subline */}
        <p
          className="font-montserrat text-xs sm:text-sm font-semibold uppercase tracking-[0.32em] mb-2 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]"
          style={{
            color: METALLIC_GOLD,
            textShadow: '0 2px 6px rgba(0,0,0,0.95), 0 0 12px rgba(0,0,0,0.6)'
          }}
        >
          {categoriesSubline}
        </p>

        {/* Script Tagline in elegant calligraphy cursive */}
        <p
          className="font-script text-3xl sm:text-4xl md:text-5xl font-normal drop-shadow-[0_3px_8px_rgba(0,0,0,0.95)] tracking-wide"
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
