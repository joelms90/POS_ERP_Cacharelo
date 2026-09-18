import React from 'react';
import type { MenuSection, MenuTheme } from '../../../types/menu';
import { DishImageRenderer } from '../DishImageRenderer';

interface HorizontalMixedFlowLayoutProps {
  section: MenuSection;
  theme: MenuTheme;
}

/**
 * Horizontal Mixed Flow Layout (Specialized for sections like PAN ARTESANAL)
 * Resolves sections with a combination of featured photo items and text-only specialty varieties.
 * Left Zone (58%): Photo Cards for dishes with images.
 * Right Zone (42%): Curated gourmet varieties panel for text-only dishes with dotted leaders and baker's note.
 */
export const HorizontalMixedFlowLayout: React.FC<HorizontalMixedFlowLayoutProps> = ({ section, theme }) => {
  const dishes = section.dishes;
  const CHARCOAL = '#2D2926';
  const MUTED_BRONZE = '#5C5449';
  const WARM_GOLD = '#C8A265';

  const formatPrice = (price?: number | null) => {
    if (price === null || price === undefined || isNaN(price)) return '';
    return `$ ${price.toFixed(2)}`;
  };

  const dishesWithImage = dishes.filter((d) => Boolean(d.image || d.imageProcessed));
  const dishesWithoutImage = dishes.filter((d) => !d.image && !d.imageProcessed);

  const notesList: string[] = React.useMemo(() => {
    if (!section.notes) return [];
    if (Array.isArray(section.notes)) return section.notes;
    return [section.notes];
  }, [section.notes]);

  const photoCols = dishesWithImage.length <= 2 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div className="w-full h-full flex items-stretch justify-between gap-6 px-3 py-1">
      {/* LEFT ZONE: Featured Photo Pastries (approx 58% width) */}
      <div className="w-[58%] h-full flex flex-col justify-between">
        <div className={`w-full h-full grid ${photoCols} gap-4 items-stretch`}>
          {dishesWithImage.map((dish) => (
            <div
              key={dish.id}
              className="h-full flex flex-col items-center justify-between text-center p-4 rounded-xl border border-[#C8A265]/30 bg-white/60 shadow-xs group hover:border-[#C8A265]/60 transition-all"
            >
              {/* Photo */}
              <div className="flex-1 flex items-center justify-center my-2 min-h-0">
                <DishImageRenderer
                  dish={dish}
                  theme={theme}
                  size="md"
                />
              </div>

              {/* Title & Description */}
              <div className="w-full flex flex-col items-center mt-1 mb-2">
                <div className="w-8 h-0 border-t-[1.5px] mb-2 border-[#C8A265]" />
                <h4
                  className="font-bold font-cormorant uppercase text-lg sm:text-xl tracking-[0.06em] leading-tight"
                  style={{ color: CHARCOAL }}
                >
                  {dish.name}
                </h4>

                {dish.description && (
                  <p
                    className="text-[11px] font-montserrat leading-relaxed opacity-85 mt-1 line-clamp-2"
                    style={{ color: MUTED_BRONZE }}
                  >
                    {dish.description}
                  </p>
                )}
              </div>

              {/* Price */}
              {formatPrice(dish.price) && (
                <div className="pt-2 border-t border-[#C8A265]/20 w-full mt-auto">
                  <span
                    className="text-lg sm:text-xl font-bold font-cormorant tracking-wide text-[#C8A265]"
                  >
                    {formatPrice(dish.price)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT ZONE: Curated Text-Only Varieties & Specialty Croissants (approx 42% width) */}
      <div className="w-[42%] h-full flex flex-col justify-between p-5 rounded-xl border border-[#C8A265]/35 bg-white/65 shadow-xs">
        {/* Header matching vertical DenseListLayout */}
        <div className="pb-2 border-b border-[#C8A265]/40">
          <div className="flex items-center justify-between">
            <span
              className="text-[11px] font-montserrat uppercase tracking-[0.25em] font-bold"
              style={{ color: MUTED_BRONZE }}
            >
              Especialidades & Croissants Rellenos
            </span>
            <span
              className="text-[10px] font-montserrat uppercase tracking-[0.2em] font-medium"
              style={{ color: WARM_GOLD }}
            >
              ✦ Horneados al día ✦
            </span>
          </div>
        </div>

        {/* Text-only dishes distributed evenly */}
        <div className="flex-1 flex flex-col justify-around py-3 space-y-2">
          {dishesWithoutImage.map((dish) => (
            <div key={dish.id} className="group flex flex-col py-1">
              <div className="flex items-baseline justify-between gap-2">
                <h4
                  className="text-base sm:text-[17px] font-cormorant font-bold uppercase tracking-[0.06em] leading-tight"
                  style={{ color: CHARCOAL }}
                >
                  {dish.name}
                </h4>

                {/* Dotted leader */}
                <div className="flex-1 border-b border-dotted border-[#C8A265]/40 mx-2 mb-1 min-w-[16px]" />

                {formatPrice(dish.price) && (
                  <span
                    className="text-base font-cormorant font-bold tracking-wide shrink-0 text-[#C8A265]"
                  >
                    {formatPrice(dish.price)}
                  </span>
                )}
              </div>

              {dish.description && (
                <p
                  className="text-[10.5px] font-montserrat leading-relaxed opacity-80 mt-0.5"
                  style={{ color: MUTED_BRONZE }}
                >
                  {dish.description}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Section Notes / Baker's Note Banner at bottom */}
        {notesList.length > 0 && (
          <div className="pt-2.5 border-t border-[#C8A265]/35 flex flex-col items-center justify-center text-center">
            {notesList.map((note, idx) => (
              <p
                key={idx}
                className="text-[10.5px] font-montserrat font-medium italic tracking-wide text-[#5C5449] opacity-90 leading-tight"
              >
                * {note}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
