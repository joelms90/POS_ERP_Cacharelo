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

  const notesList: string[] = React.useMemo(() => {
    if (!section.notes) return [];
    if (Array.isArray(section.notes)) return section.notes;
    return [section.notes];
  }, [section.notes]);

  return (
    <div className="w-full flex-1 flex flex-col justify-between py-2 px-3 sm:px-6">
      <div className="flex-1 flex flex-col justify-around">
        {dishes.map((dish, index) => {
          const isEven = index % 2 === 0;

          return (
            <div key={dish.id} className="relative flex items-center justify-between w-full my-1.5 group">
              {isEven ? (
                <>
                  <div className="w-[38%] flex justify-center items-center pr-3">
                    <DishImageRenderer dish={dish} theme={theme} size="sm" />
                  </div>
                  <div className="w-[62%] flex flex-col justify-center pl-3">
                    <div className="w-6 h-0 border-t-[1.5px] mb-1.5" style={{ borderColor: WARM_GOLD }} />
                    <h3
                      className="text-xl sm:text-2xl font-bold font-cormorant tracking-[0.1em] uppercase mb-1"
                      style={{ color: CHARCOAL }}
                    >
                      {dish.name || 'Especialidad'}
                    </h3>
                    {dish.description && (
                      <p
                        className="text-xs sm:text-[12.5px] font-montserrat leading-relaxed opacity-90 mb-1.5"
                        style={{ color: CHARCOAL }}
                      >
                        {dish.description}
                      </p>
                    )}
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
                  <div className="w-[62%] flex flex-col justify-center pr-3 text-left">
                    <div className="w-6 h-0 border-t-[1.5px] mb-1.5" style={{ borderColor: WARM_GOLD }} />
                    <h3
                      className="text-xl sm:text-2xl font-bold font-cormorant tracking-[0.1em] uppercase mb-1"
                      style={{ color: CHARCOAL }}
                    >
                      {dish.name || 'Especialidad'}
                    </h3>
                    {dish.description && (
                      <p
                        className="text-xs sm:text-[12.5px] font-montserrat leading-relaxed opacity-90 mb-1.5"
                        style={{ color: CHARCOAL }}
                      >
                        {dish.description}
                      </p>
                    )}
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
                    {formatPrice(dish.price) && (
                      <span
                        className="text-base sm:text-lg font-bold font-cormorant tracking-wide"
                        style={{ color: WARM_GOLD }}
                      >
                        {formatPrice(dish.price)}
                      </span>
                    )}
                  </div>
                  <div className="w-[38%] flex justify-center items-center pl-3">
                    <DishImageRenderer dish={dish} theme={theme} size="sm" />
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {notesList.length > 0 && (
        <div className="mt-2 pt-2 border-t border-[#C8A265]/40 flex flex-col items-center justify-center text-center px-4 bg-[#FAF7F2]/60 rounded-lg py-1.5">
          {notesList.map((note, idx) => (
            <p
              key={idx}
              className="text-[10px] sm:text-[10.5px] font-montserrat font-medium italic tracking-wide text-[#5C5449] opacity-90 leading-tight my-0.5"
            >
              * {note}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};
