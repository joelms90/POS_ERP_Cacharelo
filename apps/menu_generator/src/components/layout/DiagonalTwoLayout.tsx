import React from 'react';
import type { MenuSection, MenuTheme } from '../../types/menu';
import { DishImageRenderer } from './DishImageRenderer';

interface DiagonalTwoLayoutProps {
  section: MenuSection;
  theme: MenuTheme;
}

export const DiagonalTwoLayout: React.FC<DiagonalTwoLayoutProps> = ({ section, theme }) => {
  const dishes = section.dishes.slice(0, 2);

  const formatPrice = (price?: number | null) => {
    if (price === null || price === undefined || isNaN(price)) return '';
    return `$ ${price.toFixed(2)}`;
  };

  const WARM_GOLD = '#C8A265';
  const CHARCOAL = '#2D2926';

  return (
    <div className="w-full flex-1 flex flex-col justify-around py-8 px-4 sm:px-8 space-y-12">
      {/* Item 1: Photo Left, Text Right */}
      {dishes[0] && (
        <div className="relative flex items-center justify-between w-full group">
          <div className="w-[48%] flex justify-center items-center pr-6">
            <DishImageRenderer dish={dishes[0]} theme={theme} size="lg" />
          </div>

          <div className="w-[52%] flex flex-col justify-center pl-6">
            <div className="w-8 h-0 border-t-[1.5px] mb-2.5" style={{ borderColor: WARM_GOLD }} />

            <h3
              className="text-3xl sm:text-4xl font-bold font-cormorant tracking-[0.1em] uppercase mb-2"
              style={{ color: CHARCOAL }}
            >
              {dishes[0].name || 'Especialidad'}
            </h3>

            {dishes[0].description && (
              <p
                className="text-sm sm:text-base font-montserrat leading-relaxed mb-3 opacity-90"
                style={{ color: CHARCOAL }}
              >
                {dishes[0].description}
              </p>
            )}

            {dishes[0].tags && dishes[0].tags.length > 0 && (
              <div className="flex items-center gap-2 mb-2">
                {dishes[0].tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-xs uppercase font-montserrat font-medium tracking-wider italic"
                    style={{ color: WARM_GOLD }}
                  >
                    · {tag} ·
                  </span>
                ))}
              </div>
            )}

            {formatPrice(dishes[0].price) && (
              <div>
                <span
                  className="text-2xl sm:text-3xl font-bold font-cormorant tracking-wide"
                  style={{ color: WARM_GOLD }}
                >
                  {formatPrice(dishes[0].price)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Item 2: Text Left, Photo Right */}
      {dishes[1] && (
        <div className="relative flex items-center justify-between w-full group">
          <div className="w-[52%] flex flex-col justify-center pr-6 text-left">
            <div className="w-8 h-0 border-t-[1.5px] mb-2.5" style={{ borderColor: WARM_GOLD }} />

            <h3
              className="text-3xl sm:text-4xl font-bold font-cormorant tracking-[0.1em] uppercase mb-2"
              style={{ color: CHARCOAL }}
            >
              {dishes[1].name || 'Especialidad'}
            </h3>

            {dishes[1].description && (
              <p
                className="text-sm sm:text-base font-montserrat leading-relaxed mb-3 opacity-90"
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
                    className="text-xs uppercase font-montserrat font-medium tracking-wider italic"
                    style={{ color: WARM_GOLD }}
                  >
                    · {tag} ·
                  </span>
                ))}
              </div>
            )}

            {formatPrice(dishes[1].price) && (
              <div>
                <span
                  className="text-2xl sm:text-3xl font-bold font-cormorant tracking-wide"
                  style={{ color: WARM_GOLD }}
                >
                  {formatPrice(dishes[1].price)}
                </span>
              </div>
            )}
          </div>

          <div className="w-[48%] flex justify-center items-center pl-6">
            <DishImageRenderer dish={dishes[1]} theme={theme} size="lg" />
          </div>
        </div>
      )}
    </div>
  );
};
