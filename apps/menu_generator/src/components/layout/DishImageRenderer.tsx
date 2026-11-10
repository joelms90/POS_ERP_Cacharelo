import React from 'react';
import type { Dish, MenuTheme } from '../../types/menu';

interface DishImageRendererProps {
  dish: Dish;
  theme: MenuTheme;
  className?: string;
  size?: 'xs' | 'thumb' | 'sm' | 'md' | 'lg' | 'hero';
}

export const DishImageRenderer: React.FC<DishImageRendererProps> = ({
  dish,
  theme,
  className = '',
  size = 'md'
}) => {
  // Properly encode image URLs to handle spaces and special characters
  const rawImgSrc = dish.imageProcessed || dish.image;
  // Split path into parts, encode each filename component, keep slashes
  const imgSrc = React.useMemo(() => {
    if (!rawImgSrc) return rawImgSrc;
    // Don't encode if already encoded
    if (rawImgSrc.includes('%20')) return rawImgSrc;

    // CRITICAL: Normalize Unicode to NFC form (macOS uses NFD, but browsers expect NFC)
    // This fixes issues with characters like Ñ, é, etc.
    const normalized = rawImgSrc.normalize('NFC');

    const parts = normalized.split('/');
    // Encode each path component separately, preserving slashes
    return parts.map(part => {
      // Don't encode empty parts or parts that are already encoded
      if (!part || part.includes('%')) return part;
      return encodeURIComponent(part);
    }).join('/');
  }, [rawImgSrc]);

  // Default to transparent / organic plate presentation unless user explicitly selects circle
  const mode = dish.imageMode || 'transparent';
  const transform = dish.imageTransform || { scale: 1, x: 0, y: 0, rotation: 0 };
  const backdrop = theme.dishBackdrop;

  // Debug: Log image loading
  React.useEffect(() => {
    if (imgSrc) {
      const normalized = rawImgSrc?.normalize('NFC');
      console.debug(`DishImageRenderer loading: ${dish.name}`, {
        rawImgSrc,
        normalized,
        finalImgSrc: imgSrc,
        rawBytes: rawImgSrc?.split('').map(c => c.charCodeAt(0).toString(16)).join(' '),
        normalizedBytes: normalized?.split('').map(c => c.charCodeAt(0).toString(16)).join(' ')
      });
    }
  }, [imgSrc, dish.name, rawImgSrc]);

  // Track image loading errors
  const [imageError, setImageError] = React.useState(false);
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    console.error(`Failed to load image for ${dish.name}:`, {
      src: e.currentTarget.src,
      rawImgSrc,
      imgSrc,
      error: e
    });
    setImageError(true);
  };

  // Sizing definitions with generous editorial presence
  const sizeClasses = {
    xs: 'w-14 h-14 sm:w-16 sm:h-16',
    thumb: 'w-20 h-20 sm:w-24 sm:h-24',
    sm: 'w-32 h-32 sm:w-36 sm:h-36',
    md: 'w-44 h-44 sm:w-52 sm:h-52',
    lg: 'w-56 h-56 sm:w-64 sm:h-64',
    hero: 'w-72 h-72 sm:w-88 sm:h-88'
  }[size];

  // Show placeholder if no image or if image failed to load
  if (!imgSrc || imageError) {
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
          {imageError && (
            <span className="text-[8px] font-montserrat text-red-500 opacity-50 mt-1">
              Imagen no disponible
            </span>
          )}
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
            : size === 'xs' || size === 'thumb'
            ? 'rounded-xl overflow-hidden border border-[#C8A265]/25 shadow-xs'
            : 'overflow-visible'
        }`}
      >
        <img
          src={imgSrc}
          alt={dish.name}
          onError={handleImageError}
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
