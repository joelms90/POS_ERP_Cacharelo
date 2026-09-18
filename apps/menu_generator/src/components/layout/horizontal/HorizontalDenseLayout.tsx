import React from 'react';
import type { MenuSection, MenuTheme } from '../../../types/menu';

interface HorizontalDenseLayoutProps {
  section: MenuSection;
  theme: MenuTheme;
}

export const HorizontalDenseLayout: React.FC<HorizontalDenseLayoutProps> = ({ section, theme: _theme }) => {
  const dishes = section.dishes;
  const CHARCOAL = '#2D2926';
  const MUTED_BRONZE = '#5C5449';

  const formatPrice = (price?: number | null) => {
    if (price === null || price === undefined || isNaN(price)) return '';
    return `$ ${price.toFixed(2)}`;
  };

  // Group dishes if they have groups, or split into 3 columns
  const numColumns = dishes.length > 18 ? 4 : 3;
  const perCol = Math.ceil(dishes.length / numColumns);
  const columns = Array.from({ length: numColumns }, (_, colIdx) =>
    dishes.slice(colIdx * perCol, (colIdx + 1) * perCol)
  );

  return (
    <div className="w-full h-full flex items-center justify-center px-4 py-2">
      <div className={`w-full grid ${numColumns === 4 ? 'grid-cols-4' : 'grid-cols-3'} gap-6 items-start`}>
        {columns.map((colDishes, colIdx) => (
          <div key={colIdx} className="space-y-2.5 flex flex-col justify-center">
            {colDishes.map((dish) => (
              <div key={dish.id} className="group flex flex-col">
                <div className="flex items-baseline justify-between gap-1">
                  <h4
                    className="text-sm font-bold font-cormorant tracking-[0.05em] uppercase leading-tight"
                    style={{ color: CHARCOAL }}
                  >
                    {dish.name}
                  </h4>
                  <div className="flex-1 border-b border-dotted border-[#C8A265]/35 mx-1.5 mb-1 min-w-[6px]" />
                  {formatPrice(dish.price) && (
                    <span
                      className="text-xs font-bold font-cormorant tracking-wide shrink-0 text-[#C8A265]"
                    >
                      {formatPrice(dish.price)}
                    </span>
                  )}
                </div>
                {dish.description && (
                  <p
                    className="text-[10px] font-montserrat leading-tight opacity-75 mt-0.5 line-clamp-1"
                    style={{ color: MUTED_BRONZE }}
                  >
                    {dish.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
