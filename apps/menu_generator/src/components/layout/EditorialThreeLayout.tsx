import React from 'react';
import type { MenuSection, MenuTheme } from '../../types/menu';
import { DishImageRenderer } from './DishImageRenderer';

interface EditorialThreeLayoutProps {
  section: MenuSection;
  theme: MenuTheme;
}

export const EditorialThreeLayout: React.FC<EditorialThreeLayoutProps> = ({ section, theme }) => {
  const dishes = section.dishes.slice(0, 3);

  const formatPrice = (price?: number | null) => {
    if (price === null || price === undefined || isNaN(price)) return '';
    return `$ ${price.toFixed(2)}`;
  };

  const WARM_GOLD = '#C8A265';
  const CHARCOAL = '#2D2926';

  return (
    <div className="w-full flex-1 flex flex-col justify-around py-2 px-3 sm:px-6">
      {/* Item 1: Photo Left, Text Right */}
      {dishes[0] && (
        <div className="relative flex items-center justify-between w-full my-2 group">
          {/* Organic Dish Photo (Left) */}
          <div className="w-[45%] flex justify-center items-center pr-4">
            <DishImageRenderer dish={dishes[0]} theme={theme} size="md" />
          </div>

          {/* Clean Editorial Text Block (Right) - Pure Whitespace, No Dashed Boxes */}
          <div className="w-[55%] flex flex-col justify-center pl-4 pr-2">
            {/* Accent Divider: Tiny 20-30px gold horizontal stroke */}
            <div className="w-7 h-0 border-t-[1.5px] mb-2" style={{ borderColor: WARM_GOLD }} />

            {/* Dish Name: Bold serif, all-caps, tracking +100 */}
            <h3
              className="text-2xl sm:text-3xl font-bold font-cormorant tracking-[0.1em] uppercase mb-1.5"
              style={{ color: CHARCOAL }}
            >
              {dishes[0].name || 'Especialidad'}
            </h3>

            {/* Description: Clean neutral sans-serif, 9-10pt, line-height 1.4, dark charcoal #2D2926 */}
            {dishes[0].description && (
              <p
                className="text-xs sm:text-[13px] font-montserrat leading-relaxed line-clamp-3 mb-2.5 opacity-90"
                style={{ color: CHARCOAL }}
              >
                {dishes[0].description}
              </p>
            )}

            {/* Minimalist Text-only Sub-tags (no pill badges) */}
            {dishes[0].tags && dishes[0].tags.length > 0 && (
              <div className="flex items-center gap-2 mb-2">
                {dishes[0].tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] uppercase font-montserrat font-medium tracking-wider italic"
                    style={{ color: WARM_GOLD }}
                  >
                    · {tag} ·
                  </span>
                ))}
              </div>
            )}

            {/* Pricing: Prominently on its own line below the description */}
            {formatPrice(dishes[0].price) && (
              <div className="mt-0.5">
                <span
                  className="text-lg sm:text-xl font-bold font-cormorant tracking-wide"
                  style={{ color: WARM_GOLD }}
                >
                  {formatPrice(dishes[0].price)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Item 2: Text Left, Photo Right (Alternating Flow) */}
      {dishes[1] && (
        <div className="relative flex items-center justify-between w-full my-2 group">
          {/* Clean Editorial Text Block (Left) */}
          <div className="w-[55%] flex flex-col justify-center pr-4 pl-2 text-left">
            <div className="w-7 h-0 border-t-[1.5px] mb-2" style={{ borderColor: WARM_GOLD }} />

            <h3
              className="text-2xl sm:text-3xl font-bold font-cormorant tracking-[0.1em] uppercase mb-1.5"
              style={{ color: CHARCOAL }}
            >
              {dishes[1].name || 'Especialidad'}
            </h3>

            {dishes[1].description && (
              <p
                className="text-xs sm:text-[13px] font-montserrat leading-relaxed line-clamp-3 mb-2.5 opacity-90"
                style={{ color: CHARCOAL }}
              >
                {dishes[1].description}
              </p>
            )}

            {dishes[1].tags && dishes[1].tags.length > 0 && (
              <div className="flex items-center gap-2 mb-2">
                {dishes[1].tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] uppercase font-montserrat font-medium tracking-wider italic"
                    style={{ color: WARM_GOLD }}
                  >
                    · {tag} ·
                  </span>
                ))}
              </div>
            )}

            {formatPrice(dishes[1].price) && (
              <div className="mt-0.5">
                <span
                  className="text-lg sm:text-xl font-bold font-cormorant tracking-wide"
                  style={{ color: WARM_GOLD }}
                >
                  {formatPrice(dishes[1].price)}
                </span>
              </div>
            )}
          </div>

          {/* Organic Dish Photo (Right) */}
          <div className="w-[45%] flex justify-center items-center pl-4">
            <DishImageRenderer dish={dishes[1]} theme={theme} size="md" />
          </div>
        </div>
      )}

      {/* Item 3: Photo Left, Text Right */}
      {dishes[2] && (
        <div className="relative flex items-center justify-between w-full my-2 group">
          {/* Organic Dish Photo (Left) */}
          <div className="w-[45%] flex justify-center items-center pr-4">
            <DishImageRenderer dish={dishes[2]} theme={theme} size="md" />
          </div>

          {/* Clean Editorial Text Block (Right) */}
          <div className="w-[55%] flex flex-col justify-center pl-4 pr-2">
            <div className="w-7 h-0 border-t-[1.5px] mb-2" style={{ borderColor: WARM_GOLD }} />

            <h3
              className="text-2xl sm:text-3xl font-bold font-cormorant tracking-[0.1em] uppercase mb-1.5"
              style={{ color: CHARCOAL }}
            >
              {dishes[2].name || 'Especialidad'}
            </h3>

            {dishes[2].description && (
              <p
                className="text-xs sm:text-[13px] font-montserrat leading-relaxed line-clamp-3 mb-2.5 opacity-90"
                style={{ color: CHARCOAL }}
              >
                {dishes[2].description}
              </p>
            )}

            {dishes[2].tags && dishes[2].tags.length > 0 && (
              <div className="flex items-center gap-2 mb-2">
                {dishes[2].tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] uppercase font-montserrat font-medium tracking-wider italic"
                    style={{ color: WARM_GOLD }}
                  >
                    · {tag} ·
                  </span>
                ))}
              </div>
            )}

            {formatPrice(dishes[2].price) && (
              <div className="mt-0.5">
                <span
                  className="text-lg sm:text-xl font-bold font-cormorant tracking-wide"
                  style={{ color: WARM_GOLD }}
                >
                  {formatPrice(dishes[2].price)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
