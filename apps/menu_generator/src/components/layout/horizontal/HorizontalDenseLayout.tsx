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
  // Utilizes the full 16:9 vertical height with generous, balanced editorial cards
  if (hasImages) {
    const numColumns = dishes.length <= 6 ? 2 : 3;
    const perCol = Math.ceil(dishes.length / numColumns);
    const columns = Array.from({ length: numColumns }, (_, colIdx) =>
      dishes.slice(colIdx * perCol, (colIdx + 1) * perCol)
    );

    return (
      <div className="w-full h-full flex flex-col justify-between px-2 py-1">
        {/* Full-height column grid that spans the entire vertical canvas */}
        <div className={`w-full h-full grid ${numColumns === 2 ? 'grid-cols-2 gap-6' : 'grid-cols-3 gap-4'} items-stretch flex-1`}>
          {columns.map((colDishes, colIdx) => (
            <div key={colIdx} className="h-full flex flex-col justify-between gap-3">
              {colDishes.map((dish) => {
                const dishHasImg = Boolean(dish.image || dish.imageProcessed);

                return (
                  <div
                    key={dish.id}
                    className="flex-1 min-h-[110px] flex items-center gap-3.5 pl-3 pr-4 py-3 rounded-xl bg-white/60 border border-[#C8A265]/30 hover:border-[#C8A265]/60 transition-all shadow-xs group"
                  >
                    {/* Generous Dish Thumbnail (80-96px) */}
                    {dishHasImg ? (
                      <div className="shrink-0 flex items-center justify-center">
                        <DishImageRenderer dish={dish} theme={theme} size="thumb" />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-xl border border-dashed border-[#C8A265]/30 shrink-0 flex items-center justify-center text-xl opacity-40">
                        🍽️
                      </div>
                    )}

                    {/* Dish Typography & Pricing Block */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center pr-2">
                      <div className="flex items-start justify-between gap-3 w-full mb-1">
                        <h4
                          className="text-[15px] font-bold font-cormorant tracking-[0.05em] uppercase leading-[1.2] flex-1 min-w-0"
                          style={{
                            color: CHARCOAL,
                            wordBreak: 'break-word',
                            hyphens: 'auto',
                            maxWidth: '65%'
                          }}
                        >
                          {dish.name}
                        </h4>

                        {formatPrice(dish.price) && (
                          <span
                            className="text-[15px] font-bold font-cormorant tracking-wide shrink-0 whitespace-nowrap pt-0.5 pr-2"
                            style={{
                              color: '#C8A265',
                              fontVariantNumeric: 'lining-nums'
                            }}
                          >
                            {formatPrice(dish.price)}
                          </span>
                        )}
                      </div>

                      {dish.description && (
                        <p
                          className="text-[11px] font-montserrat leading-relaxed opacity-85 mt-1 line-clamp-3"
                          style={{ color: CHARCOAL }}
                        >
                          {dish.description}
                        </p>
                      )}

                      {dish.tags && dish.tags.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-1">
                          {dish.tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="text-[8.5px] uppercase font-montserrat font-medium tracking-wider italic text-[#C8A265]"
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
          <div className="mt-2 pt-1 border-t border-[#C8A265]/30 flex flex-col items-center justify-center text-center px-4 shrink-0">
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
  // Distributes all rows evenly from top to bottom across columns
  const numColumns = dishes.length > 18 ? 4 : 3;
  const perCol = Math.ceil(dishes.length / numColumns);
  const columns = Array.from({ length: numColumns }, (_, colIdx) =>
    dishes.slice(colIdx * perCol, (colIdx + 1) * perCol)
  );

  return (
    <div className="w-full h-full flex flex-col justify-between px-4 py-2">
      <div className={`w-full h-full grid ${numColumns === 4 ? 'grid-cols-4 gap-6' : 'grid-cols-3 gap-6'} items-stretch flex-1`}>
        {columns.map((colDishes, colIdx) => (
          <div key={colIdx} className="h-full flex flex-col justify-between py-1">
            {colDishes.map((dish) => (
              <div key={dish.id} className="group flex flex-col py-0.5 pr-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h4
                    className="text-[13px] font-bold font-cormorant tracking-[0.05em] uppercase leading-tight flex-shrink"
                    style={{
                      color: CHARCOAL,
                      wordBreak: 'break-word',
                      hyphens: 'auto',
                      maxWidth: '65%'
                    }}
                  >
                    {dish.name}
                  </h4>
                  <div className="flex-1 border-b border-dotted border-[#C8A265]/35 mx-1.5 mb-1 min-w-[6px]" />
                  {formatPrice(dish.price) && (
                    <span
                      className="text-[13px] font-bold font-cormorant tracking-wide shrink-0 text-[#C8A265] pr-1"
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
        <div className="mt-2 pt-1 border-t border-[#C8A265]/30 flex flex-col items-center justify-center text-center px-4 shrink-0">
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
