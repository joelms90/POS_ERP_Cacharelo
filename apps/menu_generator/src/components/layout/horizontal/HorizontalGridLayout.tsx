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
  let imgSize: 'xs' | 'thumb' | 'sm' | 'md' | 'lg' = 'sm';

  if (count === 1) {
    gridColsClass = 'grid-cols-1 max-w-md mx-auto';
    imgSize = 'lg';
  } else if (count === 2) {
    gridColsClass = 'grid-cols-2 max-w-4xl mx-auto gap-8';
    imgSize = 'lg';
  } else if (count === 3) {
    gridColsClass = 'grid-cols-3 gap-5';
    imgSize = 'md';
  } else if (count === 4) {
    gridColsClass = 'grid-cols-4 gap-4';
    imgSize = 'sm';
  } else if (count === 5) {
    // 5 Columns: Perfect for ENSALADAS in 16:9 widescreen
    gridColsClass = 'grid-cols-5 gap-3';
    imgSize = 'sm';
  } else if (count === 6) {
    gridColsClass = 'grid-cols-3 grid-rows-2 gap-3.5';
    imgSize = 'thumb';
  } else {
    gridColsClass = 'grid-cols-4 gap-3';
    imgSize = 'thumb';
  }

  return (
    <div className="w-full h-full flex flex-col justify-center px-2 py-1">
      {/* Full-height responsive grid filling the entire 16:9 vertical canvas */}
      <div className={`w-full h-full grid ${gridColsClass} items-stretch justify-center`}>
        {dishes.map((dish) => {
          const hasImage = Boolean(dish.image || dish.imageProcessed);

          return (
            <div
              key={dish.id}
              className="h-full flex flex-col items-center justify-between text-center p-4 rounded-xl border border-[#C8A265]/25 bg-white/55 shadow-xs group hover:border-[#C8A265]/60 transition-all"
            >
              {/* Top Badge for special dishes (when 1 or 2 dishes) */}
              {count <= 2 && (
                <div className="mb-1">
                  <span className="text-[10px] font-montserrat uppercase tracking-[0.22em] font-bold text-[#C8A265] bg-[#C8A265]/10 px-3 py-0.5 rounded-full border border-[#C8A265]/30">
                    ✦ ESPECIALIDAD DE LA CASA ✦
                  </span>
                </div>
              )}

              {/* Dish Photo */}
              <div className="flex-1 flex items-center justify-center my-2 min-h-0">
                {hasImage ? (
                  <DishImageRenderer
                    dish={dish}
                    theme={theme}
                    size={imgSize}
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full border border-dashed border-[#C8A265]/40 flex items-center justify-center opacity-50 text-2xl">
                    🍽️
                  </div>
                )}
              </div>

              {/* Header / Name & Description */}
              <div className="w-full flex flex-col items-center mt-1 mb-2">
                <div className="w-8 h-0 border-t-[1.5px] mb-2 border-[#C8A265]" />
                <h4
                  className={`font-bold font-cormorant uppercase leading-tight line-clamp-2 ${
                    count <= 2
                      ? 'text-2xl sm:text-3xl tracking-[0.08em]'
                      : count === 3
                      ? 'text-xl sm:text-2xl tracking-[0.06em]'
                      : 'text-base sm:text-lg tracking-[0.05em]'
                  }`}
                  style={{ color: CHARCOAL }}
                >
                  {dish.name}
                </h4>

                {dish.description && (
                  <p
                    className={`font-montserrat leading-relaxed opacity-85 mt-1.5 ${
                      count <= 2
                        ? 'text-xs sm:text-sm max-w-sm line-clamp-3'
                        : count <= 4
                        ? 'text-[11px] sm:text-xs line-clamp-3'
                        : 'text-[10.5px] sm:text-[11px] line-clamp-2'
                    }`}
                    style={{ color: MUTED_BRONZE }}
                  >
                    {dish.description}
                  </p>
                )}

                {dish.tags && dish.tags.length > 0 && (
                  <div className="flex items-center justify-center gap-1.5 mt-1.5">
                    {dish.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-[9px] uppercase font-montserrat font-medium tracking-wider italic text-[#C8A265]"
                      >
                        · {tag} ·
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Price Anchored at Bottom */}
              {formatPrice(dish.price) && (
                <div className="pt-2 border-t border-[#C8A265]/20 w-full mt-auto">
                  <span
                    className={`font-bold font-cormorant tracking-wide text-[#C8A265] ${
                      count <= 2
                        ? 'text-2xl sm:text-3xl'
                        : count === 3
                        ? 'text-xl sm:text-2xl'
                        : 'text-lg sm:text-xl'
                    }`}
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
