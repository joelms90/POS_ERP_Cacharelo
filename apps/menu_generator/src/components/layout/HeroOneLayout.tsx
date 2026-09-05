import React from 'react';
import type { MenuSection, MenuTheme } from '../../types/menu';
import { DishImageRenderer } from './DishImageRenderer';

interface HeroOneLayoutProps {
  section: MenuSection;
  theme: MenuTheme;
}

export const HeroOneLayout: React.FC<HeroOneLayoutProps> = ({ section, theme }) => {
  const dish = section.dishes[0];
  if (!dish) return null;

  const formatPrice = (price?: number | null) => {
    if (price === null || price === undefined || isNaN(price)) return '';
    return `$ ${price.toFixed(2)}`;
  };
  const WARM_GOLD = '#C8A265';
  const CHARCOAL = '#2D2926';

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center py-6 px-4">
      {/* Big Hero Organic Plate */}
      <div className="my-4">
        <DishImageRenderer dish={dish} theme={theme} size="hero" />
      </div>

      {/* Clean Editorial Container - Pure Whitespace */}
      <div className="w-full max-w-xl text-center flex flex-col items-center">
        <div className="w-10 h-0 border-t-[1.5px] mb-3" style={{ borderColor: WARM_GOLD }} />

        <h3
          className="text-3xl sm:text-4xl md:text-5xl font-bold font-cormorant tracking-[0.14em] uppercase mb-2"
          style={{ color: CHARCOAL }}
        >
          {dish.name}
        </h3>

        {dish.description && (
          <p
            className="text-sm sm:text-base font-montserrat leading-relaxed max-w-lg mx-auto opacity-90 mb-4"
            style={{ color: CHARCOAL }}
          >
            {dish.description}
          </p>
        )}

        {dish.tags && dish.tags.length > 0 && (
          <div className="flex justify-center gap-3 mb-4">
            {dish.tags.map((tag, idx) => (
              <span
                key={idx}
                className="text-xs uppercase font-montserrat tracking-widest italic"
                style={{ color: WARM_GOLD }}
              >
                · {tag} ·
              </span>
            ))}
          </div>
        )}

        {formatPrice(dish.price) && (
          <div>
            <span
              className="text-3xl sm:text-4xl font-bold font-cormorant tracking-wide"
              style={{ color: WARM_GOLD }}
            >
              {formatPrice(dish.price)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
