import React from 'react';
import type { MenuSection, MenuTheme, Dish } from '../../types/menu';

interface ColumnarTableLayoutProps {
  section: MenuSection;
  theme: MenuTheme;
}

export const ColumnarTableLayout: React.FC<ColumnarTableLayoutProps> = ({ section }) => {
  const dishes = section.dishes;

  // Derive price headers (e.g. ['12 oz', '16 oz'])
  const headers: string[] = React.useMemo(() => {
    if (section.priceHeaders && section.priceHeaders.length > 0) {
      return section.priceHeaders;
    }
    const headerSet = new Set<string>();
    dishes.forEach((d) => {
      if (d.prices) {
        Object.keys(d.prices).forEach((k) => headerSet.add(k));
      }
    });
    if (headerSet.size > 0) {
      return Array.from(headerSet);
    }
    return ['12 oz', '16 oz'];
  }, [section.priceHeaders, dishes]);

  const formatPrice = (price?: number | null) => {
    if (price === null || price === undefined || isNaN(price)) return '';
    return `$ ${price.toFixed(2)}`;
  };

  const WARM_GOLD = '#C8A265';
  const CHARCOAL = '#2D2926';
  const MUTED_BRONZE = '#5C5449';

  // Normalize notes list
  const notesList: string[] = React.useMemo(() => {
    if (!section.notes) return [];
    if (Array.isArray(section.notes)) return section.notes;
    return [section.notes];
  }, [section.notes]);

  // Split dishes into two balanced parallel columns for high-end cafe layout
  const isMultiColumn = dishes.length > 5;
  const half = Math.ceil(dishes.length / 2);
  const leftDishes = isMultiColumn ? dishes.slice(0, half) : dishes;
  const rightDishes = isMultiColumn ? dishes.slice(half) : [];

  const renderDishColumn = (columnDishes: Dish[], showHeader = true) => (
    <div className="flex-1 flex flex-col justify-start">
      {/* Column Header: Size labels aligned with the prices */}
      {showHeader && (
        <div className="flex items-center justify-between pb-1.5 border-b border-[#C8A265]/35 mb-2.5">
          <span
            className="text-[9px] sm:text-[10px] font-montserrat uppercase tracking-[0.22em] font-semibold opacity-75"
            style={{ color: MUTED_BRONZE }}
          >
            Selección
          </span>
          <div className="flex items-center gap-2 sm:gap-3">
            {headers.map((header, idx) => (
              <span
                key={idx}
                className="w-14 sm:w-16 text-right text-[10px] sm:text-[11px] font-montserrat font-bold uppercase tracking-[0.16em]"
                style={{ color: WARM_GOLD }}
              >
                {header}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Dish rows */}
      <div className="space-y-2.5">
        {columnDishes.map((dish) => (
          <div key={dish.id} className="group relative">
            {/* Top row: Name + dotted leader + multi-size prices */}
            <div className="flex items-baseline justify-between gap-1.5">
              <h4
                className="text-base sm:text-[17px] font-cormorant font-bold uppercase tracking-[0.08em] leading-tight shrink-0"
                style={{ color: CHARCOAL }}
              >
                {dish.name || 'Especialidad'}
              </h4>

              {/* Dotted leader */}
              <div className="flex-1 border-b border-dotted border-[#C8A265]/35 mx-1.5 mb-1 min-w-[12px]" />

              {/* Prices aligned under headers */}
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                {headers.map((header, idx) => {
                  let priceVal: number | null | undefined = null;
                  if (dish.prices && header in dish.prices) {
                    priceVal = dish.prices[header];
                  } else if (idx === 0 && dish.price !== undefined && dish.price !== null) {
                    priceVal = dish.price;
                  }

                  return (
                    <div key={idx} className="w-14 sm:w-16 text-right">
                      {priceVal !== null && priceVal !== undefined ? (
                        <span
                          className="text-sm sm:text-base font-cormorant font-bold tracking-wide"
                          style={{ color: WARM_GOLD }}
                        >
                          {formatPrice(priceVal)}
                        </span>
                      ) : (
                        <span className="text-xs font-montserrat text-[#5C5449]/40 font-medium">
                          —
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Description */}
            {dish.description && (
              <p
                className="text-[10px] sm:text-[11px] font-montserrat leading-relaxed opacity-85 mt-0.5 pr-28 line-clamp-2"
                style={{ color: CHARCOAL }}
              >
                {dish.description}
              </p>
            )}

            {/* Tags */}
            {dish.tags && dish.tags.length > 0 && (
              <div className="flex items-center gap-1.5 mt-0.5">
                {dish.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-[8.5px] uppercase font-montserrat font-medium tracking-wider italic"
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
  );

  return (
    <div className="w-full flex-1 flex flex-col justify-between py-2 px-2 sm:px-4">
      {/* Main 2-Column Table Grid */}
      <div
        className={
          isMultiColumn
            ? 'grid grid-cols-1 sm:grid-cols-2 gap-x-8 sm:gap-x-10 gap-y-4'
            : 'max-w-xl mx-auto w-full'
        }
      >
        {renderDishColumn(leftDishes, true)}
        {isMultiColumn && renderDishColumn(rightDishes, true)}
      </div>

      {/* Decorative Notes Box (e.g. Milk & preparation options) */}
      {notesList.length > 0 && (
        <div className="mt-4 pt-2.5 border-t border-[#C8A265]/40 flex flex-col items-center justify-center text-center px-4 bg-[#FAF7F2]/60 rounded-lg py-1.5">
          {notesList.map((note, idx) => (
            <p
              key={idx}
              className="text-[10px] sm:text-[11px] font-montserrat font-medium italic tracking-wide text-[#5C5449] opacity-90 leading-tight my-0.5"
            >
              * {note}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};
