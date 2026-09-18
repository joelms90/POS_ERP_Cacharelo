import React from 'react';
import type { MenuSection, MenuTheme } from '../../../types/menu';
import { DishImageRenderer } from '../DishImageRenderer';

interface HorizontalDenseLayoutProps {
  section: MenuSection;
  theme: MenuTheme;
}

export const HorizontalDenseLayout: React.FC<HorizontalDenseLayoutProps> = ({ section, theme }) => {
  const dishes = section.dishes;
  const CHARCOAL = '#2D2926';
  const MUTED_BRONZE = '#5C5449';

  const formatPrice = (price?: number | null) => {
    if (price === null || price === undefined || isNaN(price)) return '';
    return `$ ${price.toFixed(2)}`;
  };

  const dishesWithImage = dishes.filter((d) => Boolean(d.image || d.imageProcessed));
  const hasImages = dishesWithImage.length > 0;

  const notesList: string[] = React.useMemo(() => {
    if (!section.notes) return [];
    if (Array.isArray(section.notes)) return section.notes;
    return [section.notes];
  }, [section.notes]);

  // SCENARIO A: DISHES HAVE IMAGES (e.g. DESAYUNOS [9 dishes with photos], PAN ARTESANAL)
  // Render with photo thumbnails so no dish image is ever lost!
  if (hasImages) {
    // 3 columns for 7-12 dishes, 2 columns for <= 6 dishes
    const numColumns = dishes.length <= 6 ? 2 : 3;
    const perCol = Math.ceil(dishes.length / numColumns);
    const columns = Array.from({ length: numColumns }, (_, colIdx) =>
      dishes.slice(colIdx * perCol, (colIdx + 1) * perCol)
    );

    return (
      <div className="w-full h-full flex flex-col justify-between px-3 py-2">
        <div className={`w-full grid ${numColumns === 2 ? 'grid-cols-2 gap-6' : 'grid-cols-3 gap-4'} items-start flex-1`}>
          {columns.map((colDishes, colIdx) => (
            <div key={colIdx} className="space-y-3 flex flex-col justify-start">
              {colDishes.map((dish) => {
                const dishHasImg = Boolean(dish.image || dish.imageProcessed);

                return (
                  <div
                    key={dish.id}
                    className="flex items-start gap-3 p-2 rounded-xl bg-white/45 border border-[#C8A265]/20 hover:border-[#C8A265]/50 transition-colors shadow-2xs"
                  >
                    {/* Dish Thumbnail */}
                    {dishHasImg ? (
                      <div className="shrink-0 flex items-center justify-center pt-0.5">
                        <DishImageRenderer dish={dish} theme={theme} size="xs" />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-full border border-dashed border-[#C8A265]/30 shrink-0 flex items-center justify-center text-sm opacity-40">
                        🍽️
                      </div>
                    )}

                    {/* Dish Text Block */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-1.5 w-full">
                        <h4
                          className="text-sm font-bold font-cormorant tracking-[0.05em] uppercase leading-tight truncate"
                          style={{ color: CHARCOAL }}
                          title={dish.name}
                        >
                          {dish.name}
                        </h4>

                        <div className="flex-1 border-b border-dotted border-[#C8A265]/35 mx-1 mb-0.5 min-w-[8px]" />

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
                          className="text-[10px] font-montserrat leading-relaxed opacity-85 mt-0.5 line-clamp-2"
                          style={{ color: CHARCOAL }}
                        >
                          {dish.description}
                        </p>
                      )}

                      {dish.tags && dish.tags.length > 0 && (
                        <div className="flex items-center gap-1 mt-0.5">
                          {dish.tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="text-[8px] uppercase font-montserrat font-medium tracking-wider italic text-[#C8A265]"
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
          ))}
        </div>

        {/* Section Notes Banner */}
        {notesList.length > 0 && (
          <div className="mt-2 pt-1 border-t border-[#C8A265]/30 flex flex-col items-center justify-center text-center px-4">
            {notesList.map((note, idx) => (
              <p
                key={idx}
                className="text-[9.5px] font-montserrat font-medium italic tracking-wide text-[#5C5449] opacity-85 leading-tight my-0.5"
              >
                * {note}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }

  // SCENARIO B: TEXT-ONLY DENSE LIST (e.g. EXTRAS [39 items])
  const numColumns = dishes.length > 18 ? 4 : 3;
  const perCol = Math.ceil(dishes.length / numColumns);
  const columns = Array.from({ length: numColumns }, (_, colIdx) =>
    dishes.slice(colIdx * perCol, (colIdx + 1) * perCol)
  );

  return (
    <div className="w-full h-full flex flex-col justify-between px-4 py-2">
      <div className={`w-full grid ${numColumns === 4 ? 'grid-cols-4 gap-6' : 'grid-cols-3 gap-6'} items-start flex-1`}>
        {columns.map((colDishes, colIdx) => (
          <div key={colIdx} className="space-y-2 flex flex-col justify-center">
            {colDishes.map((dish) => (
              <div key={dish.id} className="group flex flex-col">
                <div className="flex items-baseline justify-between gap-1">
                  <h4
                    className="text-xs sm:text-sm font-bold font-cormorant tracking-[0.05em] uppercase leading-tight"
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
                    className="text-[9.5px] font-montserrat leading-tight opacity-75 mt-0.5 line-clamp-1"
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

      {/* Section Notes Banner */}
      {notesList.length > 0 && (
        <div className="mt-2 pt-1 border-t border-[#C8A265]/30 flex flex-col items-center justify-center text-center px-4">
          {notesList.map((note, idx) => (
            <p
              key={idx}
              className="text-[9.5px] font-montserrat font-medium italic tracking-wide text-[#5C5449] opacity-85 leading-tight my-0.5"
            >
              * {note}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};
