import React from 'react';
import type { Dish, MenuTheme } from '../../types/menu';

interface DishImageRendererProps {
  dish: Dish;
  theme: MenuTheme;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'hero';
}

export const DishImageRenderer: React.FC<DishImageRendererProps> = ({
  dish,
  theme,
  className = '',
  size = 'md'
}) => {
  const imgSrc = dish.imageProcessed || dish.image;
  // Default to transparent / organic plate presentation unless user explicitly selects circle
  const mode = dish.imageMode || 'transparent';
  const transform = dish.imageTransform || { scale: 1, x: 0, y: 0, rotation: 0 };
  const backdrop = theme.dishBackdrop;

  // Sizing definitions with generous editorial presence
  const sizeClasses = {
    xs: 'w-14 h-14 sm:w-16 sm:h-16',
    sm: 'w-32 h-32 sm:w-36 sm:h-36',
    md: 'w-44 h-44 sm:w-52 sm:h-52',
    lg: 'w-56 h-56 sm:w-64 sm:h-64',
    hero: 'w-72 h-72 sm:w-88 sm:h-88'
  }[size];

  if (!imgSrc) {
    return (
      <div className={`relative flex items-center justify-center ${sizeClasses} ${className}`}>
        <div
          className="w-full h-full rounded-full border border-dashed flex flex-col items-center justify-center p-4 text-center"
          style={{ borderColor: '#C8A26550', backgroundColor: 'rgba(200, 162, 101, 0.04)' }}
        >
          <span className="text-2xl mb-1 opacity-70">🍽️</span>
          <span className="text-[11px] font-montserrat uppercase tracking-widest text-[#2D2926] opacity-60">
            {dish.name}
          </span>
        </div>
      </div>
    );
  }

  // Calculate CSS transform
  const transformStyle: React.CSSProperties = {
    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale}) rotate(${transform.rotation}deg)`,
    transformOrigin: 'center center',
    transition: 'transform 0.15s ease-out'
  };

  return (
    <div className={`relative flex items-center justify-center select-none ${sizeClasses} ${className}`}>
      {/* Optional Legacy Backdrops (Only active if user explicitly configures them in theme) */}
      {backdrop === 'black-circle' && mode === 'circle' && (
        <svg className="absolute inset-0 w-full h-full rounded-full z-0 pointer-events-none drop-shadow-md" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="50" fill="#0A0A0A" />
        </svg>
      )}

      {backdrop === 'white-ring' && (
        <svg className="absolute inset-0 w-full h-full rounded-full z-0 pointer-events-none" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="48" fill="rgba(255,255,255,0.4)" stroke="#C8A265" strokeWidth="2" />
        </svg>
      )}

      {/* Organic, Unclipped Dish Photography with Realistic Soft Contact Shadow */}
      <div
        className={`relative z-10 w-full h-full flex items-center justify-center ${
          mode === 'circle'
            ? 'rounded-full overflow-hidden'
            : mode === 'ellipse'
            ? 'rounded-[45%] overflow-hidden'
            : size === 'xs'
            ? 'rounded-xl overflow-hidden border border-[#C8A265]/25 shadow-xs'
            : 'overflow-visible'
        }`}
      >
        <img
          src={imgSrc}
          alt={dish.name}
          className={`w-full h-full pointer-events-none transition-all duration-300 ${
            mode === 'circle'
              ? 'object-cover rounded-full shadow-md'
              : mode === 'soft-edge'
              ? 'object-cover rounded-full filter drop-shadow-[0_12px_14px_rgba(45,41,38,0.15)]'
              : mode === 'original'
              ? 'object-cover rounded-xl shadow-md'
              : 'object-contain filter drop-shadow-[0_16px_20px_rgba(45,41,38,0.18)] drop-shadow-[0_4px_6px_rgba(45,41,38,0.08)]'
          }`}
          style={{
            ...transformStyle,
            ...(mode === 'soft-edge'
              ? {
                  maskImage: 'radial-gradient(circle, black 65%, transparent 98%)',
                  WebkitMaskImage: 'radial-gradient(circle, black 65%, transparent 98%)'
                }
              : {})
          }}
          loading="lazy"
        />
      </div>
    </div>
  );
};
