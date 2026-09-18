import React from 'react';
import type { MenuSection, MenuTheme } from '../../../types/menu';
import { DishImageRenderer } from '../DishImageRenderer';

interface HorizontalSplitLayoutProps {
  section: MenuSection;
  theme: MenuTheme;
}

export const HorizontalSplitLayout: React.FC<HorizontalSplitLayoutProps> = ({ section, theme }) => {
  const dishes = section.dishes;
  const CHARCOAL = '#2D2926';
  const MUTED_BRONZE = '#5C5449';

  const formatPrice = (price?: number | null) => {
    if (price === null || price === undefined || isNaN(price)) return '';
    return `$ ${price.toFixed(2)}`;
  };

  // Select hero dish: first dish with an image, or first dish
  const heroDishIndex = dishes.findIndex((d) => Boolean(d.image || d.imageProcessed));
  const heroDish = heroDishIndex >= 0 ? dishes[heroDishIndex] : dishes[0];
  const sideDishes = dishes.filter((_, idx) => idx !== (heroDishIndex >= 0 ? heroDishIndex : 0));

  // Split side dishes into 2 balanced columns
  const half = Math.ceil(sideDishes.length / 2);
  const col1Dishes = sideDishes.slice(0, half);
  const col2Dishes = sideDishes.slice(half);

  return (
    <div className="w-full h-full flex items-center justify-between gap-8 px-6 py-2">
      {/* LEFT COLUMN: Hero Dish Presentation (38% width) */}
      <div className="w-[38%] h-full flex flex-col justify-center items-center text-center p-5 rounded-xl border border-[#C8A265]/25 bg-white/40 shadow-sm relative">
        {/* Subtle decorative tag */}
        <div className="mb-2">
          <span
            className="text-[10px] font-montserrat uppercase tracking-[0.25em] font-bold px-3 py-1 rounded-full border border-[#C8A265]/40 bg-[#C8A265]/10 text-[#C8A265]"
          >
            ★ ESPECIALIDAD DESTACADA ★
          </span>
        </div>

        {/* Hero Dish Image */}
        {heroDish && (
          <div className="my-2 flex items-center justify-center">
            <DishImageRenderer dish={heroDish} theme={theme} size="lg" />
          </div>
        )}

        {/* Hero Dish Title & Price */}
        {heroDish && (
          <div className="space-y-1 w-full mt-1">
            <h3
              className="text-2xl font-bold font-cormorant tracking-[0.08em] uppercase leading-tight"
              style={{ color: CHARCOAL }}
            >
              {heroDish.name}
            </h3>

            {heroDish.description && (
              <p
                className="text-xs font-montserrat leading-relaxed opacity-85 px-4 line-clamp-3"
                style={{ color: MUTED_BRONZE }}
              >
                {heroDish.description}
              </p>
            )}

            {heroDish.tags && heroDish.tags.length > 0 && (
              <div className="flex items-center justify-center gap-1.5 pt-1">
                {heroDish.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-[9px] uppercase font-montserrat tracking-wider italic text-[#C8A265]"
                  >
                    · {tag} ·
                  </span>
                ))}
              </div>
            )}

            {formatPrice(heroDish.price) && (
              <div className="pt-2">
                <span
                  className="text-2xl font-bold font-cormorant tracking-wide text-[#C8A265]"
                >
                  {formatPrice(heroDish.price)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: 2 Parallel Columns of Remaining Dishes (62% width) */}
      <div className="w-[62%] h-full grid grid-cols-2 gap-6 items-center">
        {/* Sub-column 1 */}
        <div className="space-y-3.5 flex flex-col justify-center">
          {col1Dishes.map((dish) => {
            const hasImg = Boolean(dish.image || dish.imageProcessed);
            return (
              <div key={dish.id} className="group flex items-start gap-2.5">
                {hasImg && (
                  <div className="shrink-0 flex items-center justify-center pt-0.5">
                    <DishImageRenderer dish={dish} theme={theme} size="xs" />
                  </div>
                )}
                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="flex items-baseline justify-between gap-1">
                    <h4
                      className="text-base font-bold font-cormorant tracking-[0.06em] uppercase leading-tight truncate"
                      style={{ color: CHARCOAL }}
                    >
                      {dish.name}
                    </h4>
                    <div className="flex-1 border-b border-dotted border-[#C8A265]/35 mx-1.5 mb-1 min-w-[8px]" />
                    {formatPrice(dish.price) && (
                      <span
                        className="text-sm font-bold font-cormorant tracking-wide shrink-0 text-[#C8A265]"
                      >
                        {formatPrice(dish.price)}
                      </span>
                    )}
                  </div>
                  {dish.description && (
                    <p
                      className="text-[11px] font-montserrat leading-snug opacity-80 mt-0.5 line-clamp-2"
                      style={{ color: MUTED_BRONZE }}
                    >
                      {dish.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Sub-column 2 */}
        <div className="space-y-3.5 flex flex-col justify-center">
          {col2Dishes.map((dish) => {
            const hasImg = Boolean(dish.image || dish.imageProcessed);
            return (
              <div key={dish.id} className="group flex items-start gap-2.5">
                {hasImg && (
                  <div className="shrink-0 flex items-center justify-center pt-0.5">
                    <DishImageRenderer dish={dish} theme={theme} size="xs" />
                  </div>
                )}
                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="flex items-baseline justify-between gap-1">
                    <h4
                      className="text-base font-bold font-cormorant tracking-[0.06em] uppercase leading-tight truncate"
                      style={{ color: CHARCOAL }}
                    >
                      {dish.name}
                    </h4>
                    <div className="flex-1 border-b border-dotted border-[#C8A265]/35 mx-1.5 mb-1 min-w-[8px]" />
                    {formatPrice(dish.price) && (
                      <span
                        className="text-sm font-bold font-cormorant tracking-wide shrink-0 text-[#C8A265]"
                      >
                        {formatPrice(dish.price)}
                      </span>
                    )}
                  </div>
                  {dish.description && (
                    <p
                      className="text-[11px] font-montserrat leading-snug opacity-80 mt-0.5 line-clamp-2"
                      style={{ color: MUTED_BRONZE }}
                    >
                      {dish.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
