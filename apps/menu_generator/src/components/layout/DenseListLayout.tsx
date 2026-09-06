import React from 'react';
import type { MenuSection, MenuTheme } from '../../types/menu';
import { DishImageRenderer } from './DishImageRenderer';

interface DenseListLayoutProps {
  section: MenuSection;
  theme: MenuTheme;
}

export const DenseListLayout: React.FC<DenseListLayoutProps> = ({ section, theme }) => {
  const dishes = section.dishes;
  const dishesWithImage = dishes.filter((d) => Boolean(d.image || d.imageProcessed));
  const dishesWithoutImage = dishes.filter((d) => !d.image && !d.imageProcessed);

  const formatPrice = (price?: number | null) => {
    if (price === null || price === undefined || isNaN(price)) return '';
    return `$ ${price.toFixed(2)}`;
  };

  const WARM_GOLD = '#C8A265';
  const CHARCOAL = '#2D2926';
  const MUTED_BRONZE = '#5C5449';

  const notesList: string[] = React.useMemo(() => {
    if (!section.notes) return [];
    if (Array.isArray(section.notes)) return section.notes;
    return [section.notes];
  }, [section.notes]);

  // SCENARIO 1: EDITORIAL FLOW (e.g. ENSALADAS [5 dishes with photos], PAN ARTESANAL [3 with photos + 4 text])
  // Generously expands across the full page height, eliminating awkward blank space.
  if (dishesWithImage.length >= 1 && dishesWithImage.length <= 5 && dishes.length <= 9) {
    const isPurePhotoFlow = dishesWithoutImage.length === 0;

    return (
      <div className="w-full flex-1 flex flex-col justify-around py-1 px-3 sm:px-6">
        {/* Dishes with images in alternating organic layout */}
        <div
          className={
            isPurePhotoFlow
              ? 'flex-1 flex flex-col justify-around py-1'
              : 'space-y-3 sm:space-y-4'
          }
        >
          {dishesWithImage.map((dish, index) => {
            const isEven = index % 2 === 0;

            return (
              <div key={dish.id} className="relative flex items-center justify-between w-full group my-1">
                {isEven ? (
                  <>
                    {/* Dish Photo (Left) */}
                    <div className="w-[36%] sm:w-[33%] flex justify-center items-center pr-3 sm:pr-4">
                      <DishImageRenderer
                        dish={dish}
                        theme={theme}
                        size={dishesWithoutImage.length > 0 ? 'sm' : (dishesWithImage.length > 3 ? 'sm' : 'md')}
                      />
                    </div>

                    {/* Dish Text Block (Right) */}
                    <div className="w-[64%] sm:w-[67%] flex flex-col justify-center pl-2">
                      <div className="w-6 h-0 border-t-[1.5px] mb-1" style={{ borderColor: WARM_GOLD }} />

                      <div className="flex items-baseline justify-between gap-1.5">
                        <h4
                          className="text-lg sm:text-xl md:text-2xl font-bold font-cormorant tracking-[0.08em] uppercase leading-tight"
                          style={{ color: CHARCOAL }}
                        >
                          {dish.name}
                        </h4>

                        {/* Dotted leader */}
                        <div className="flex-1 border-b border-dotted border-[#C8A265]/35 mx-1.5 mb-1 min-w-[12px]" />

                        {formatPrice(dish.price) && (
                          <span
                            className="text-base sm:text-lg font-bold font-cormorant tracking-wide shrink-0"
                            style={{ color: WARM_GOLD }}
                          >
                            {formatPrice(dish.price)}
                          </span>
                        )}
                      </div>

                      {dish.description && (
                        <p
                          className="text-xs sm:text-[12.5px] font-montserrat leading-relaxed opacity-90 mt-0.5 mb-1 line-clamp-2"
                          style={{ color: CHARCOAL }}
                        >
                          {dish.description}
                        </p>
                      )}

                      {dish.tags && dish.tags.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-0.5">
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
                    </div>
                  </>
                ) : (
                  <>
                    {/* Dish Text Block (Left) */}
                    <div className="w-[64%] sm:w-[67%] flex flex-col justify-center pr-2 text-left">
                      <div className="w-6 h-0 border-t-[1.5px] mb-1" style={{ borderColor: WARM_GOLD }} />

                      <div className="flex items-baseline justify-between gap-1.5">
                        <h4
                          className="text-lg sm:text-xl md:text-2xl font-bold font-cormorant tracking-[0.08em] uppercase leading-tight"
                          style={{ color: CHARCOAL }}
                        >
                          {dish.name}
                        </h4>

                        {/* Dotted leader */}
                        <div className="flex-1 border-b border-dotted border-[#C8A265]/35 mx-1.5 mb-1 min-w-[12px]" />

                        {formatPrice(dish.price) && (
                          <span
                            className="text-base sm:text-lg font-bold font-cormorant tracking-wide shrink-0"
                            style={{ color: WARM_GOLD }}
                          >
                            {formatPrice(dish.price)}
                          </span>
                        )}
                      </div>

                      {dish.description && (
                        <p
                          className="text-xs sm:text-[12.5px] font-montserrat leading-relaxed opacity-90 mt-0.5 mb-1 line-clamp-2"
                          style={{ color: CHARCOAL }}
                        >
                          {dish.description}
                        </p>
                      )}

                      {dish.tags && dish.tags.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-0.5">
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
                    </div>

                    {/* Dish Photo (Right) */}
                    <div className="w-[36%] sm:w-[33%] flex justify-center items-center pl-3 sm:pr-4">
                      <DishImageRenderer
                        dish={dish}
                        theme={theme}
                        size={dishesWithoutImage.length > 0 ? 'sm' : (dishesWithImage.length > 3 ? 'sm' : 'md')}
                      />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom Part: Text-only dishes (e.g. Specialty croissants in Pan Artesanal) */}
        {dishesWithoutImage.length > 0 && (
          <div className="mt-3 pt-2.5 border-t border-[#C8A265]/40">
            <div className="flex items-center justify-between pb-1 mb-2">
              <span
                className="text-[9px] sm:text-[10px] font-montserrat uppercase tracking-[0.25em] font-semibold opacity-85"
                style={{ color: MUTED_BRONZE }}
              >
                Especialidades & Croissants Rellenos
              </span>
              <span
                className="text-[9px] font-montserrat uppercase tracking-[0.2em] font-medium opacity-65"
                style={{ color: WARM_GOLD }}
              >
                Horneados al día
              </span>
            </div>

            <div className="flex flex-col gap-y-2.5 w-full">
              {dishesWithoutImage.map((dish) => (
                <div key={dish.id} className="group relative w-full">
                  <div className="flex items-baseline justify-between gap-2 w-full">
                    <h4
                      className="text-base sm:text-[17px] font-cormorant font-bold uppercase tracking-[0.08em] leading-tight"
                      style={{ color: CHARCOAL }}
                    >
                      {dish.name || 'Especialidad'}
                    </h4>

                    {/* Dotted leader */}
                    <div className="flex-1 border-b border-dotted border-[#C8A265]/35 mx-2 mb-1 min-w-[20px]" />

                    {formatPrice(dish.price) && (
                      <span
                        className="text-sm sm:text-base font-cormorant font-bold tracking-wide shrink-0"
                        style={{ color: WARM_GOLD }}
                      >
                        {formatPrice(dish.price)}
                      </span>
                    )}
                  </div>

                  {dish.description && (
                    <p
                      className="text-[10.5px] sm:text-xs font-montserrat leading-relaxed opacity-85 mt-0.5 line-clamp-2"
                      style={{ color: CHARCOAL }}
                    >
                      {dish.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section Notes / Baker's Note Banner */}
        {notesList.length > 0 && (
          <div className="mt-3 pt-2 border-t border-[#C8A265]/40 flex flex-col items-center justify-center text-center px-4 bg-[#FAF7F2]/60 rounded-lg py-1.5">
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
  }

  // SCENARIO 2: MULTI-DISH GRID (e.g. DESAYUNOS [8 dishes], EXTRAS)
  // Shows dishes in a balanced 2-column grid with clean dotted leaders
  const isLargeList = dishes.length > 6;

  return (
    <div className="w-full flex-1 flex flex-col justify-around py-2 px-2 sm:px-4">
      <div
        className={`w-full mx-auto ${
          isLargeList
            ? 'grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3'
            : 'grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4'
        }`}
      >
        {dishes.map((dish) => {
          const hasImage = Boolean(dish.image || dish.imageProcessed);

          return (
            <div
              key={dish.id}
              className={`group relative ${hasImage ? 'flex items-center gap-3' : ''}`}
            >
              {/* Dish Photo Thumbnail (if dish has an image) */}
              {hasImage && (
                <div className="shrink-0 flex items-center justify-center">
                  <DishImageRenderer dish={dish} theme={theme} size="xs" />
                </div>
              )}

              {/* Dish Typography & Pricing */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-1.5">
                  <h4
                    className="text-base sm:text-[17px] font-cormorant font-bold uppercase tracking-[0.08em] leading-tight shrink-0"
                    style={{ color: CHARCOAL }}
                  >
                    {dish.name || 'Especialidad'}
                  </h4>

                  {/* Dotted leader */}
                  <div className="flex-1 border-b border-dotted border-[#C8A265]/35 mx-1.5 mb-1 min-w-[12px]" />

                  {/* Price */}
                  {formatPrice(dish.price) && (
                    <span
                      className="text-sm sm:text-base font-cormorant font-bold tracking-wide shrink-0"
                      style={{ color: WARM_GOLD }}
                    >
                      {formatPrice(dish.price)}
                    </span>
                  )}
                </div>

                {/* Description */}
                {dish.description && (
                  <p
                    className="text-[10.5px] sm:text-[11.5px] font-montserrat leading-relaxed opacity-85 mt-0.5 mb-1 line-clamp-2"
                    style={{ color: CHARCOAL }}
                  >
                    {dish.description}
                  </p>
                )}

                {/* Tags */}
                {dish.tags && dish.tags.length > 0 && (
                  <div className="flex items-center gap-1.5 mb-0.5">
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
              </div>
            </div>
          );
        })}
      </div>

      {/* Notes Banner */}
      {notesList.length > 0 && (
        <div className="mt-3 pt-2 border-t border-[#C8A265]/40 flex flex-col items-center justify-center text-center px-4 bg-[#FAF7F2]/60 rounded-lg py-1.5">
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
