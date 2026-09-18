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

  const count = dishes.length;
  let gridColsClass = 'grid-cols-3';
  let imgSize: 'xs' | 'sm' | 'md' | 'lg' = 'sm';

  if (count === 1) {
    gridColsClass = 'grid-cols-1 max-w-md mx-auto';
    imgSize = 'lg';
  } else if (count === 2) {
    gridColsClass = 'grid-cols-2 max-w-3xl mx-auto';
    imgSize = 'md';
  } else if (count === 3) {
    gridColsClass = 'grid-cols-3';
    imgSize = 'md';
  } else if (count === 4) {
    gridColsClass = 'grid-cols-4';
    imgSize = 'sm';
  } else if (count === 5) {
    // 5 Columns: Perfect for ENSALADAS in 16:9 widescreen
    gridColsClass = 'grid-cols-5';
    imgSize = 'sm';
  } else if (count === 6) {
    gridColsClass = 'grid-cols-3';
    imgSize = 'sm';
  } else {
    gridColsClass = 'grid-cols-4';
    imgSize = 'sm';
  }

  return (
    <div className="w-full h-full flex items-center justify-center px-2 py-2">
      <div className={`w-full grid ${gridColsClass} gap-3 sm:gap-4 items-stretch justify-center`}>
        {dishes.map((dish) => {
          const hasImage = Boolean(dish.image || dish.imageProcessed);

          return (
            <div
              key={dish.id}
              className="flex flex-col items-center justify-between text-center p-3 rounded-xl border border-[#C8A265]/25 bg-white/50 shadow-xs group hover:border-[#C8A265]/60 transition-colors"
            >
              {/* Dish Photo */}
              {hasImage ? (
                <div className="flex items-center justify-center my-1 shrink-0">
                  <DishImageRenderer
                    dish={dish}
                    theme={theme}
                    size={imgSize}
                  />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full border border-dashed border-[#C8A265]/40 flex items-center justify-center my-2 opacity-50">
                  <span className="text-lg">🍽️</span>
                </div>
              )}

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
                    className="text-[10.5px] sm:text-[11px] font-montserrat leading-snug opacity-85 mt-1 line-clamp-2"
                    style={{ color: MUTED_BRONZE }}
                  >
                    {dish.description}
                  </p>
                )}

                {dish.tags && dish.tags.length > 0 && (
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    {dish.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-[8.5px] uppercase font-montserrat font-medium tracking-wider italic text-[#C8A265]"
                      >
                        · {tag} ·
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Price */}
              {formatPrice(dish.price) && (
                <div className="pt-2 mt-auto">
                  <span
                    className="text-base sm:text-lg font-bold font-cormorant tracking-wide text-[#C8A265]"
                  >
                    {formatPrice(dish.price)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
