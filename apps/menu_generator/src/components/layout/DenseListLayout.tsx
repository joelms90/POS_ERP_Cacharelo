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

  // SCENARIO 2: CATEGORIZED 2-COLUMN SPLIT (e.g. DESAYUNOS: Huevos on Left, Omelettes on Right)
  // Eliminates blank space, balances 5 items per column, and adds house accompaniments card & bakery banner
  const isHuevosAndOmelettes = React.useMemo(() => {
    const huevos = dishes.filter((d) => !d.name.toLowerCase().includes('omelette'));
    const omelettes = dishes.filter((d) => d.name.toLowerCase().includes('omelette'));
    return huevos.length > 0 && omelettes.length > 0 && huevos.length + omelettes.length === dishes.length;
  }, [dishes]);

  if (isHuevosAndOmelettes) {
    const huevos = dishes.filter((d) => !d.name.toLowerCase().includes('omelette'));
    const omelettes = dishes.filter((d) => d.name.toLowerCase().includes('omelette'));

    const renderDishCard = (dish: any) => {
      const hasImage = Boolean(dish.image || dish.imageProcessed);

      return (
        <div key={dish.id} className="group relative flex items-start gap-2.5 sm:gap-3 w-full">
          {hasImage && (
            <div className="shrink-0 flex items-center justify-center pt-0.5">
              <DishImageRenderer dish={dish} theme={theme} size="xs" />
            </div>
          )}

          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex items-start justify-between gap-1.5 w-full">
              <h4
                className="text-[14px] sm:text-[15.5px] font-cormorant font-bold uppercase tracking-[0.05em] leading-[1.15] flex-1 min-w-0"
                style={{ color: CHARCOAL }}
              >
                {dish.name || 'Especialidad'}
              </h4>

              {formatPrice(dish.price) && (
                <span
                  className="text-sm sm:text-base font-cormorant font-bold tracking-wide shrink-0 whitespace-nowrap pl-1 leading-none pt-0.5"
                  style={{ color: WARM_GOLD }}
                >
                  {formatPrice(dish.price)}
                </span>
              )}
            </div>

            {dish.description && (
              <p
                className="text-[10px] sm:text-[10.5px] font-montserrat leading-relaxed opacity-85 mt-1"
                style={{ color: CHARCOAL }}
              >
                {dish.description}
              </p>
            )}

            {dish.tags && dish.tags.length > 0 && (
              <div className="flex items-center gap-1.5 mt-1">
                {dish.tags.map((tag: string, idx: number) => (
                  <span
                    key={idx}
                    className="text-[8.5px] sm:text-[9px] uppercase font-montserrat font-medium tracking-wider italic"
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
    };

    return (
      <div className="w-full flex-1 flex flex-col justify-between py-2 px-1 sm:px-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 sm:gap-x-10 gap-y-6 w-full flex-1">
          {/* Column 1: Huevos */}
          <div className="flex flex-col justify-between h-full">
            <div className="pb-1.5 mb-3 border-b border-[#C8A265]/40 flex items-center justify-between">
              <span
                className="text-[10px] sm:text-[11px] font-montserrat uppercase tracking-[0.25em] font-semibold"
                style={{ color: MUTED_BRONZE }}
              >
                Huevos al Gusto & Especiales
              </span>
              <span
                className="text-[9px] font-montserrat uppercase tracking-[0.2em] font-medium opacity-65"
                style={{ color: WARM_GOLD }}
              >
                Recetas de la Casa
              </span>
            </div>

            <div className="flex flex-col justify-between gap-y-3.5 sm:gap-y-4 flex-1">
              {huevos.map(renderDishCard)}
            </div>
          </div>

          {/* Column 2: Omelettes */}
          <div className="flex flex-col justify-between h-full">
            <div className="pb-1.5 mb-3 border-b border-[#C8A265]/40 flex items-center justify-between">
              <span
                className="text-[10px] sm:text-[11px] font-montserrat uppercase tracking-[0.25em] font-semibold"
                style={{ color: MUTED_BRONZE }}
              >
                Omelettes Preparados
              </span>
              <span
                className="text-[9px] font-montserrat uppercase tracking-[0.2em] font-medium opacity-65"
                style={{ color: WARM_GOLD }}
              >
                3 Huevos al Momento
              </span>
            </div>

            <div className="flex flex-col justify-between gap-y-3.5 sm:gap-y-4 flex-1">
              {omelettes.map(renderDishCard)}

              {/* 5th slot: Accompaniments Card */}
              <div className="rounded-xl border border-[#C8A265]/35 bg-[#FAF7F2]/60 p-3 sm:p-3.5 flex flex-col justify-center text-center shadow-xs">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <span className="w-5 h-0 border-t border-[#C8A265]/60" />
                  <span
                    className="text-[9px] sm:text-[9.5px] font-montserrat uppercase tracking-[0.25em] font-bold"
                    style={{ color: WARM_GOLD }}
                  >
                    Acompañamientos Incluidos
                  </span>
                  <span className="w-5 h-0 border-t border-[#C8A265]/60" />
                </div>
                <p
                  className="text-[10px] sm:text-[10.5px] font-montserrat leading-relaxed opacity-90"
                  style={{ color: CHARCOAL }}
                >
                  Todos nuestros desayunos incluyen <strong className="font-semibold">pan tostado</strong>, <strong className="font-semibold">aguacate fresco</strong> y <strong className="font-semibold">frijoles maneados</strong> de la casa.
                </p>
                <span
                  className="text-[8.5px] sm:text-[9px] font-montserrat tracking-wider uppercase mt-1 italic opacity-75"
                  style={{ color: MUTED_BRONZE }}
                >
                  * Preparación con claras disponible en cualquier platillo
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bakery / Sides Note Banner */}
        <div className="mt-4 pt-2.5 border-t border-[#C8A265]/35 flex flex-col sm:flex-row items-center justify-between text-center px-4 py-2 bg-[#FAF7F2]/50 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="text-xs">🍞</span>
            <span className="text-[10px] sm:text-[10.5px] font-montserrat text-[#5C5449] font-medium tracking-wide">
              Pan artesanal horneado diariamente en nuestra cocina
            </span>
          </div>
          <div className="flex items-center gap-3 text-[9px] sm:text-[9.5px] font-montserrat text-[#8C7A65] mt-1 sm:mt-0 tracking-wider uppercase">
            <span>• Huevos 100% de Granja</span>
            <span>• Ingredientes Frescos</span>
            <span>• Hecho al Momento</span>
          </div>
        </div>
      </div>
    );
  }

  // SCENARIO 3: GENERAL MULTI-DISH GRID (e.g. EXTRAS, OTHER DENSE LISTS)
  // Shows dishes in a balanced 2-column grid with unclipped titles, visible prices, and full descriptions
  const isLargeList = dishes.length > 6;

  return (
    <div className="w-full flex-1 flex flex-col justify-around py-2 px-1 sm:px-2">
      <div
        className={`w-full mx-auto ${
          isLargeList
            ? 'grid grid-cols-1 sm:grid-cols-2 gap-x-6 sm:gap-x-7 gap-y-3.5'
            : 'grid grid-cols-1 sm:grid-cols-2 gap-x-7 sm:gap-x-8 gap-y-4'
        }`}
      >
        {dishes.map((dish) => {
          const hasImage = Boolean(dish.image || dish.imageProcessed);

          return (
            <div
              key={dish.id}
              className={`group relative ${hasImage ? 'flex items-start gap-2.5 sm:gap-3' : ''}`}
            >
              {/* Dish Photo Thumbnail (if dish has an image) */}
              {hasImage && (
                <div className="shrink-0 flex items-center justify-center pt-0.5">
                  <DishImageRenderer dish={dish} theme={theme} size="xs" />
                </div>
              )}

              {/* Dish Typography & Pricing */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-1.5 w-full">
                  <h4
                    className="text-[14px] sm:text-[15.5px] font-cormorant font-bold uppercase tracking-[0.05em] leading-[1.15] flex-1 min-w-0"
                    style={{ color: CHARCOAL }}
                  >
                    {dish.name || 'Especialidad'}
                  </h4>

                  {/* Price - Always visible, right-aligned, shrink-0 */}
                  {formatPrice(dish.price) && (
                    <span
                      className="text-sm sm:text-base font-cormorant font-bold tracking-wide shrink-0 whitespace-nowrap pl-1 leading-none pt-0.5"
                      style={{ color: WARM_GOLD }}
                    >
                      {formatPrice(dish.price)}
                    </span>
                  )}
                </div>

                {/* Description - Full text, never cut off with line-clamp */}
                {dish.description && (
                  <p
                    className="text-[10px] sm:text-[10.5px] font-montserrat leading-relaxed opacity-85 mt-1"
                    style={{ color: CHARCOAL }}
                  >
                    {dish.description}
                  </p>
                )}

                {/* Tags */}
                {dish.tags && dish.tags.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-1">
                    {dish.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-[8.5px] sm:text-[9px] uppercase font-montserrat font-medium tracking-wider italic"
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
