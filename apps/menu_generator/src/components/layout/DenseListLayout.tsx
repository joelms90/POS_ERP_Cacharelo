import React from 'react';
import type { MenuSection, MenuTheme } from '../../types/menu';
import { DishImageRenderer } from './DishImageRenderer';

interface DenseListLayoutProps {
  section: MenuSection;
  theme: MenuTheme;
}

export const DenseListLayout: React.FC<DenseListLayoutProps> = ({ section, theme }) => {
  const dishes = section.dishes;
  const featuredDish = dishes.find((d) => d.image);
  const formatPrice = (price?: number | null) => {
    if (price === null || price === undefined || isNaN(price)) return '';
    return `$ ${price.toFixed(2)}`;
  };

  const WARM_GOLD = '#C8A265';
  const CHARCOAL = '#2D2926';
  const isLargeList = dishes.length > 6;

  return (
    <div className="w-full flex-1 flex flex-col justify-center py-2 px-2 sm:px-4">
      <div className="relative flex flex-col lg:flex-row items-center justify-between gap-4 w-full">
        {/* Featured Organic Plate (if any dish has an image) */}
        {featuredDish && featuredDish.image && (
          <div className="z-10 shrink-0 flex justify-center items-center py-2 lg:w-4/12">
            <DishImageRenderer dish={featuredDish} theme={theme} size="lg" />
          </div>
        )}

        {/* Clean Editorial Menu Items List - Pure Whitespace */}
        <div
          className={`flex-1 w-full py-1 ${
            featuredDish && featuredDish.image ? 'lg:w-8/12 lg:pl-4' : 'max-w-3xl mx-auto'
          }`}
        >
          <div className={isLargeList ? 'grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5' : 'space-y-3.5'}>
            {dishes.map((dish) => (
              <div key={dish.id} className="group relative">
                {/* Delicate Gold Accent Divider */}
                <div className="w-5 h-0 border-t-[1.5px] mb-1.5" style={{ borderColor: WARM_GOLD }} />

                {/* Dish Name: Bold serif, all-caps, tracking +100 */}
                <div className="flex items-baseline justify-between gap-2">
                  <h4
                    className="text-base sm:text-lg font-cormorant font-bold uppercase tracking-[0.08em] leading-tight"
                    style={{ color: CHARCOAL }}
                  >
                    {dish.name || 'Especialidad'}
                  </h4>

                  {/* Price on same line for large lists, or below for standard lists */}
                  {isLargeList && formatPrice(dish.price) && (
                    <span
                      className="text-sm font-cormorant font-bold tracking-wide shrink-0"
                      style={{ color: WARM_GOLD }}
                    >
                      {formatPrice(dish.price)}
                    </span>
                  )}
                </div>

                {/* Description: Clean neutral sans-serif, line-height 1.4 */}
                {dish.description && (
                  <p
                    className="text-[11px] sm:text-xs font-montserrat leading-relaxed opacity-85 mt-0.5 mb-1"
                    style={{ color: CHARCOAL }}
                  >
                    {dish.description}
                  </p>
                )}

                {/* Minimalist Text-only Sub-tags (no pill badges) */}
                {dish.tags && dish.tags.length > 0 && (
                  <div className="flex items-center gap-1.5 mb-1">
                    {dish.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-[9px] uppercase font-montserrat font-medium tracking-wider italic"
                        style={{ color: WARM_GOLD }}
                      >
                        · {tag} ·
                      </span>
                    ))}
                  </div>
                )}

                {/* Price below description for standard lists */}
                {!isLargeList && formatPrice(dish.price) && (
                  <div className="mt-0.5">
                    <span
                      className="text-base sm:text-lg font-cormorant font-bold tracking-wide"
                      style={{ color: WARM_GOLD }}
                    >
                      {formatPrice(dish.price)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
