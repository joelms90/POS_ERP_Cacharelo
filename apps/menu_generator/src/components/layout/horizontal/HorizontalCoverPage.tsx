import React from 'react';
import type { Cover, MenuTheme, Restaurant } from '../../../types/menu';

interface HorizontalCoverPageProps {
  cover: Cover;
  restaurant: Restaurant;
  theme: MenuTheme;
}

export const HorizontalCoverPage: React.FC<HorizontalCoverPageProps> = ({
  cover,
  restaurant,
  theme: _theme
}) => {
  const METALLIC_GOLD = '#D4AF37';

  const overlayOpacity = cover.backgroundOverlayOpacity ?? 0.35;
  const blur = cover.backgroundBlur ?? 0;
  const backgroundImage = cover.backgroundImage || '/backgrounds/cafe-interior-cover.png';
  const logoSrc = restaurant.logo || '/branding/cacharelo-cofee-gold-logo.png';
  const categoriesSubline = cover.footer || 'DESAYUNOS  •  COMIDAS  •  REPOSTERÍA  •  CAFÉ DE ESPECIALIDAD';
  const tagline = cover.tagline || '"El placer del buen comer y el mejor café"';

  return (
    <div
      className="menu-page relative w-full h-full flex flex-col justify-between select-none overflow-hidden"
      style={{
        backgroundColor: '#121110',
        color: '#FFFFFF'
      }}
    >
      {/* 1. Background Cinematic Image Layer */}
      {backgroundImage && (
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <img
            src={backgroundImage}
            alt="Horizontal Cover Background"
            className="w-full h-full object-cover"
            style={{
              filter: blur > 0 ? `blur(${blur}px)` : undefined,
              transform: 'scale(1.02)'
            }}
          />
          {/* Panoramic dark gradient for readability on left side */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(90deg, rgba(14,13,12,0.92) 0%, rgba(14,13,12,0.78) 48%, rgba(14,13,12,0.55) 100%)'
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: '#000000',
              opacity: overlayOpacity
            }}
          />
        </div>
      )}

      {/* 2. Inset Double Gold Geometric Frame */}
      <div
        className="absolute inset-5 pointer-events-none z-10"
        style={{ border: `1px solid ${METALLIC_GOLD}40` }}
      />
      <div
        className="absolute inset-7 pointer-events-none z-10"
        style={{ border: `1px solid ${METALLIC_GOLD}20` }}
      />

      {/* Corner Ornaments */}
      <div className="absolute top-8 left-8 z-10 w-6 h-6 border-t-2 border-l-2 border-[#C8A265]" />
      <div className="absolute top-8 right-8 z-10 w-6 h-6 border-t-2 border-r-2 border-[#C8A265]" />
      <div className="absolute bottom-8 left-8 z-10 w-6 h-6 border-b-2 border-l-2 border-[#C8A265]" />
      <div className="absolute bottom-8 right-8 z-10 w-6 h-6 border-b-2 border-r-2 border-[#C8A265]" />

      {/* 3. Main 16:9 Panoramic Body: Split 45% / 55% */}
      <div className="relative z-10 flex-1 grid grid-cols-12 gap-8 px-14 pt-12 pb-6 items-center">
        
        {/* Left 45% (Cols 1-5): Editorial Brand Presentation */}
        <div className="col-span-6 flex flex-col justify-center text-left space-y-4 pl-4">
          {/* Logo & Category */}
          <div className="flex items-center gap-4">
            <img
              src={logoSrc}
              alt={restaurant.name}
              className="h-16 w-auto object-contain drop-shadow-md"
            />
            <div className="flex flex-col">
              <span
                className="text-[11px] font-montserrat uppercase tracking-[0.35em] font-bold"
                style={{ color: METALLIC_GOLD }}
              >
                — CAFETERÍA & RESTAURANTE —
              </span>
              <span className="text-xs font-montserrat uppercase tracking-[0.2em] text-zinc-300">
                {restaurant.slogan || cover.slogan || 'Sabor tradicional & café de autor'}
              </span>
            </div>
          </div>

          {/* Hairline Divider */}
          <div className="h-[1px] w-36 bg-gradient-to-r from-[#C8A265] to-transparent" />

          {/* Main Title */}
          <div>
            <h1 className="text-5xl font-cormorant font-bold tracking-[0.14em] uppercase text-zinc-100 leading-none">
              {cover.title || 'CARTA DE MENÚ'}
            </h1>
            {cover.subtitle ? (
              <p className="text-base font-baskerville italic text-[#C8A265] mt-2">
                {cover.subtitle}
              </p>
            ) : (
              <p className="text-sm font-baskerville italic text-zinc-400 mt-2">
                Selección de especialidades preparadas al momento con insumos locales
              </p>
            )}
          </div>

          {/* Script Tagline */}
          <div className="pt-2">
            <p className="font-script text-3xl sm:text-4xl text-[#E5C384]">
              {tagline}
            </p>
          </div>

          {/* Quality Badges */}
          <div className="pt-3 flex items-center gap-6 text-[11px] font-montserrat uppercase tracking-widest text-zinc-300">
            <div className="flex items-center gap-2">
              <span className="text-[#C8A265]">✦</span>
              <span>Insumos Frescos</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#C8A265]">✦</span>
              <span>Hecho en Casa</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#C8A265]">✦</span>
              <span>Café Gourmet</span>
            </div>
          </div>
        </div>

        {/* Right 55% (Cols 7-12): Cinematic Visual Focal Point */}
        <div className="col-span-6 flex items-center justify-center relative pr-4">
          {/* Subtle Ambient Radial Glow */}
          <div
            className="absolute w-96 h-96 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(200,162,101,0.22) 0%, rgba(0,0,0,0) 70%)'
            }}
          />

          {/* Luxury Plate / Dish Showcase */}
          <div className="relative flex items-center justify-center">
            {/* Outer Circular Ring */}
            <div
              className="w-[340px] h-[340px] rounded-full flex items-center justify-center p-3 shadow-2xl"
              style={{
                border: `2px solid ${METALLIC_GOLD}60`,
                background: 'radial-gradient(circle, rgba(26,24,22,0.85) 0%, rgba(14,13,12,0.95) 100%)'
              }}
            >
              <div
                className="w-full h-full rounded-full overflow-hidden flex items-center justify-center border border-[#C8A265]/40"
              >
                <img
                  src="/dishes/BAGUETTES A LOS TRES QUESOS.jpeg"
                  alt="Platillo Portada"
                  className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700"
                  onError={(e) => {
                    // Fallback to logo or clean icon if dish image not present
                    const target = e.currentTarget;
                    target.src = logoSrc;
                    target.className = 'h-36 w-auto object-contain opacity-80';
                  }}
                />
              </div>
            </div>

            {/* Floating Luxury Stamp / Ribbon */}
            <div
              className="absolute -bottom-2 -left-4 px-4 py-2 bg-gradient-to-r from-[#C8A265] to-[#B58E4E] text-zinc-950 font-montserrat font-bold text-[10px] tracking-[0.2em] uppercase rounded-full shadow-xl border border-white/20 flex items-center gap-1.5"
            >
              <span>★</span>
              <span>ESPECIALIDAD DE LA CASA</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Panoramic Bottom Footer Bar */}
      <footer className="relative z-10 w-full px-12 pb-5 pt-2 flex items-center justify-between text-[11px] font-montserrat uppercase tracking-[0.2em]">
        <div className="flex items-center gap-2 text-[#C8A265]">
          <span className="font-cormorant font-bold text-sm tracking-wider text-zinc-100">
            {restaurant.name}
          </span>
          <span className="opacity-60">•</span>
          <span className="opacity-90">{categoriesSubline}</span>
        </div>

        <div className="flex items-center gap-4 text-zinc-400 text-[10px]">
          <span>{restaurant.contact || 'Servicio en Mesa & Para Llevar'}</span>
          <span className="text-[#C8A265]">•</span>
          <span className="text-[#E5C384] font-medium">16:9 Widescreen</span>
        </div>
      </footer>
    </div>
  );
};
