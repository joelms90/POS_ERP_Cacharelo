import React from 'react';
import type { MenuSection, MenuTheme } from '../../types/menu';
import { DishImageRenderer } from './DishImageRenderer';

interface EditorialFourLayoutProps {
  section: MenuSection;
  theme: MenuTheme;
}

export const EditorialFourLayout: React.FC<EditorialFourLayoutProps> = ({ section, theme }) => {
  const dishes = section.dishes.slice(0, 4);

  const formatPrice = (price?: number | null) => {
    if (price === null || price === undefined || isNaN(price)) return '';
    return `$ ${price.toFixed(2)}`;
  };
  const WARM_GOLD = '#C8A265';
  const CHARCOAL = '#2D2926';

  return (
    <div className="w-full flex-1 flex flex-col justify-between py-2 px-3 sm:px-6">
      {dishes.map((dish, index) => {
        const isEven = index % 2 === 0;

        return (
          <div key={dish.id} className="relative flex items-center justify-between w-full my-1.5 group">
            {isEven ? (
              <>
                <div className="w-[40%] flex justify-center items-center pr-3">
                  <DishImageRenderer dish={dish} theme={theme} size="sm" />
                </div>
                <div className="w-[60%] flex flex-col justify-center pl-3">
                  <div className="w-6 h-0 border-t-[1.5px] mb-1.5" style={{ borderColor: WARM_GOLD }} />
                  <h3
                    className="text-xl sm:text-2xl font-bold font-cormorant tracking-[0.1em] uppercase mb-1"
                    style={{ color: CHARCOAL }}
                  >
                    {dish.name || 'Especialidad'}
                  </h3>
                  {dish.description && (
                    <p
                      className="text-xs font-montserrat leading-snug line-clamp-2 opacity-90 mb-1"
                      style={{ color: CHARCOAL }}
                    >
                      {dish.description}
                    </p>
                  )}
                  {formatPrice(dish.price) && (
                    <span
                      className="text-base sm:text-lg font-bold font-cormorant tracking-wide"
                      style={{ color: WARM_GOLD }}
                    >
                      {formatPrice(dish.price)}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="w-[60%] flex flex-col justify-center pr-3 text-left">
                  <div className="w-6 h-0 border-t-[1.5px] mb-1.5" style={{ borderColor: WARM_GOLD }} />
                  <h3
                    className="text-xl sm:text-2xl font-bold font-cormorant tracking-[0.1em] uppercase mb-1"
                    style={{ color: CHARCOAL }}
                  >
                    {dish.name || 'Especialidad'}
                  </h3>
                  {dish.description && (
                    <p
                      className="text-xs font-montserrat leading-snug line-clamp-2 opacity-90 mb-1"
                      style={{ color: CHARCOAL }}
                    >
                      {dish.description}
                    </p>
                  )}
                  {formatPrice(dish.price) && (
                    <span
                      className="text-base sm:text-lg font-bold font-cormorant tracking-wide"
                      style={{ color: WARM_GOLD }}
                    >
                      {formatPrice(dish.price)}
                    </span>
                  )}
                </div>
                <div className="w-[40%] flex justify-center items-center pl-3">
                  <DishImageRenderer dish={dish} theme={theme} size="sm" />
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};
