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

  // SCENARIO 1: HYBRID EDITORIAL FLOW (e.g. ENSALADAS: 1-4 dishes with photos + text dishes)
  // Shows every dish that has a photo in the alternating layout, and text dishes cleanly below
  if (dishesWithImage.length >= 1 && dishesWithImage.length <= 4 && dishes.length <= 6) {
    return (
      <div className="w-full flex-1 flex flex-col justify-around py-2 px-3 sm:px-6">
        {/* Top Part: All dishes with images in alternating flow */}
        <div className="space-y-4">
          {dishesWithImage.map((dish, index) => {
            const isEven = index % 2 === 0;

            return (
              <div key={dish.id} className="relative flex items-center justify-between w-full group">
                {isEven ? (
                  <>
                    {/* Dish Photo (Left) */}
                    <div className="w-[38%] sm:w-[35%] flex justify-center items-center pr-4">
                      <DishImageRenderer
                        dish={dish}
                        theme={theme}
                        size={dishesWithImage.length > 2 ? 'sm' : 'md'}
                      />
                    </div>

                    {/* Dish Text Block (Right) */}
                    <div className="w-[62%] sm:w-[65%] flex flex-col justify-center pl-2">
                      <div className="w-6 h-0 border-t-[1.5px] mb-1.5" style={{ borderColor: WARM_GOLD }} />

                      <div className="flex items-baseline justify-between gap-2">
                        <h4
                          className="text-xl sm:text-2xl font-bold font-cormorant tracking-[0.09em] uppercase mb-0.5"
                          style={{ color: CHARCOAL }}
                        >
                          {dish.name}
                        </h4>

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
                          className="text-xs font-montserrat leading-relaxed opacity-90 mb-1"
                          style={{ color: CHARCOAL }}
                        >
                          {dish.description}
                        </p>
                      )}

                      {dish.tags && dish.tags.length > 0 && (
                        <div className="flex items-center gap-1.5">
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
                    <div className="w-[62%] sm:w-[65%] flex flex-col justify-center pr-2 text-left">
                      <div className="w-6 h-0 border-t-[1.5px] mb-1.5" style={{ borderColor: WARM_GOLD }} />

                      <div className="flex items-baseline justify-between gap-2">
                        <h4
                          className="text-xl sm:text-2xl font-bold font-cormorant tracking-[0.09em] uppercase mb-0.5"
                          style={{ color: CHARCOAL }}
                        >
                          {dish.name}
                        </h4>

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
                          className="text-xs font-montserrat leading-relaxed opacity-90 mb-1"
                          style={{ color: CHARCOAL }}
                        >
                          {dish.description}
                        </p>
                      )}

                      {dish.tags && dish.tags.length > 0 && (
                        <div className="flex items-center gap-1.5">
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
                    <div className="w-[38%] sm:w-[35%] flex justify-center items-center pl-4">
                      <DishImageRenderer
                        dish={dish}
                        theme={theme}
                        size={dishesWithImage.length > 2 ? 'sm' : 'md'}
                      />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom Part: Text-only dishes below with subtle gold divider */}
        {dishesWithoutImage.length > 0 && (
          <div className="mt-3 pt-2.5 border-t border-[#C8A265]/35">
            <div
              className={
                dishesWithoutImage.length > 1
                  ? 'grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5'
                  : 'max-w-xl mx-auto'
              }
            >
              {dishesWithoutImage.map((dish) => (
                <div key={dish.id} className="group relative">
                  <div className="w-5 h-0 border-t-[1.5px] mb-1" style={{ borderColor: WARM_GOLD }} />

                  <div className="flex items-baseline justify-between gap-2">
                    <h4
                      className="text-base sm:text-lg font-cormorant font-bold uppercase tracking-[0.08em] leading-tight"
                      style={{ color: CHARCOAL }}
                    >
                      {dish.name || 'Especialidad'}
                    </h4>

                    {formatPrice(dish.price) && (
                      <span
                        className="text-sm font-cormorant font-bold tracking-wide shrink-0"
                        style={{ color: WARM_GOLD }}
                      >
                        {formatPrice(dish.price)}
                      </span>
                    )}
                  </div>

                  {dish.description && (
                    <p
                      className="text-[11px] sm:text-xs font-montserrat leading-relaxed opacity-85 mt-0.5 mb-1"
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
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // SCENARIO 2: MULTI-DISH GRID (e.g. DESAYUNOS, BAGUETTES, PAN ARTESANAL - 6+ dishes)
  // Shows EVERY dish with a photo alongside its entry, arranged in a 2-column balanced grid
  const isLargeList = dishes.length > 6;

  return (
    <div className="w-full flex-1 flex flex-col justify-center py-2 px-2 sm:px-4">
      <div
        className={`w-full mx-auto ${
          isLargeList
            ? 'grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3'
            : 'grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4'
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
                {/* Delicate Gold Accent Divider */}
                <div className="w-5 h-0 border-t-[1.5px] mb-1" style={{ borderColor: WARM_GOLD }} />

                {/* Dish Name */}
                <div className="flex items-baseline justify-between gap-1.5">
                  <h4
                    className="text-base sm:text-lg font-cormorant font-bold uppercase tracking-[0.08em] leading-tight"
                    style={{ color: CHARCOAL }}
                  >
                    {dish.name || 'Especialidad'}
                  </h4>

                  {/* Price */}
                  {formatPrice(dish.price) && (
                    <span
                      className="text-sm font-cormorant font-bold tracking-wide shrink-0"
                      style={{ color: WARM_GOLD }}
                    >
                      {formatPrice(dish.price)}
                    </span>
                  )}
                </div>

                {/* Description */}
                {dish.description && (
                  <p
                    className="text-[10.5px] sm:text-[11.5px] font-montserrat leading-relaxed opacity-85 mt-0.5 mb-1 line-clamp-3"
                    style={{ color: CHARCOAL }}
                  >
                    {dish.description}
                  </p>
                )}

                {/* Minimalist Text-only Sub-tags */}
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
    </div>
  );
};
