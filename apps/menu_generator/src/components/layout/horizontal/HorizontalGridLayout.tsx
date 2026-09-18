import React from 'react';
import type { MenuSection, MenuTheme } from '../../../types/menu';
import { DishImageRenderer } from '../DishImageRenderer';

interface HorizontalGridLayoutProps {
  section: MenuSection;
  theme: MenuTheme;
}

export const HorizontalGridLayout: React.FC<HorizontalGridLayoutProps> = ({ section, theme }) => {
  const dishes = section.dishes;
  const CHARCOAL = '#2D2926';
  const MUTED_BRONZE = '#5C5449';

  const formatPrice = (price?: number | null) => {
    if (price === null || price === undefined || isNaN(price)) return '';
    return `$ ${price.toFixed(2)}`;
  };

  // Determine grid columns based on count: 2, 3, 4, or 2-row grid
  const count = dishes.length;
  let gridColsClass = 'grid-cols-3';
  if (count <= 2) gridColsClass = 'grid-cols-2 max-w-2xl mx-auto';
  else if (count === 3) gridColsClass = 'grid-cols-3';
  else if (count === 4) gridColsClass = 'grid-cols-4';
  else if (count <= 6) gridColsClass = 'grid-cols-3';
  else gridColsClass = 'grid-cols-4';

  return (
    <div className="w-full h-full flex items-center justify-center px-4 py-2">
      <div className={`w-full grid ${gridColsClass} gap-4 items-stretch justify-center`}>
        {dishes.slice(0, 8).map((dish) => (
          <div
            key={dish.id}
            className="flex flex-col items-center justify-between text-center p-3 rounded-xl border border-[#C8A265]/20 bg-white/40 shadow-xs group hover:border-[#C8A265]/50 transition-colors"
          >
            {/* Dish Photo */}
            <div className="flex items-center justify-center my-1">
              <DishImageRenderer
                dish={dish}
                theme={theme}
                size={count <= 3 ? 'md' : 'sm'}
              />
            </div>

            {/* Header / Name */}
            <div className="w-full flex flex-col items-center mt-1 mb-auto">
              <div className="w-6 h-0 border-t-[1.5px] mb-1.5 border-[#C8A265]" />
              <h4
                className="text-base sm:text-lg font-bold font-cormorant tracking-[0.06em] uppercase leading-tight line-clamp-2"
                style={{ color: CHARCOAL }}
              >
                {dish.name}
              </h4>

              {dish.description && (
                <p
                  className="text-[11px] font-montserrat leading-snug opacity-80 mt-1 line-clamp-2"
                  style={{ color: MUTED_BRONZE }}
                >
                  {dish.description}
                </p>
              )}
            </div>

            {/* Price */}
            {formatPrice(dish.price) && (
              <div className="pt-2 mt-1">
                <span
                  className="text-lg font-bold font-cormorant tracking-wide text-[#C8A265]"
                >
                  {formatPrice(dish.price)}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
