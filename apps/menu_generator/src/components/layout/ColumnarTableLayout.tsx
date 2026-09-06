import React from 'react';
import type { MenuSection, MenuTheme, Dish } from '../../types/menu';

interface ColumnarTableLayoutProps {
  section: MenuSection;
  theme: MenuTheme;
}

export const ColumnarTableLayout: React.FC<ColumnarTableLayoutProps> = ({ section }) => {
  const dishes = section.dishes;

  // Separate single-price dishes (e.g. Espresso Sencillo, Doble, Cortados) from multi-size variations (12 oz / 16 oz)
  const singlePriceDishes = React.useMemo(() => {
    return dishes.filter((d) => !d.prices || Object.keys(d.prices).length === 0);
  }, [dishes]);

  const multiPriceDishes = React.useMemo(() => {
    return dishes.filter((d) => d.prices && Object.keys(d.prices).length > 0);
  }, [dishes]);

  // Derive price headers (e.g. ['12 oz', '16 oz']) from multi-size dishes
  const headers: string[] = React.useMemo(() => {
    if (section.priceHeaders && section.priceHeaders.length > 0) {
      return section.priceHeaders;
    }
    const headerSet = new Set<string>();
    multiPriceDishes.forEach((d) => {
      if (d.prices) {
        Object.keys(d.prices).forEach((k) => headerSet.add(k));
      }
    });
    if (headerSet.size > 0) {
      return Array.from(headerSet);
    }
    return ['12 oz', '16 oz'];
  }, [section.priceHeaders, multiPriceDishes]);

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

  // Split multi-size dishes into two balanced columns if more than 3
  const isMultiColumn = multiPriceDishes.length > 3;
  const half = Math.ceil(multiPriceDishes.length / 2);
  const leftMultiDishes = isMultiColumn ? multiPriceDishes.slice(0, half) : multiPriceDishes;
  const rightMultiDishes = isMultiColumn ? multiPriceDishes.slice(half) : [];

  const renderMultiPriceColumn = (columnDishes: Dish[], categoryTitle: string) => (
    <div className="flex-1 flex flex-col justify-start">
      {/* Column Header: Category sub-heading on left, size labels on right */}
      <div className="flex items-center justify-between pb-1.5 border-b border-[#C8A265]/35 mb-2.5">
        <span
          className="text-[9px] sm:text-[10px] font-montserrat uppercase tracking-[0.22em] font-semibold opacity-85"
          style={{ color: MUTED_BRONZE }}
        >
          {categoryTitle}
        </span>
        <div className="flex items-center gap-2 sm:gap-3">
          {headers.map((header, idx) => (
            <span
              key={idx}
              className="w-14 sm:w-16 text-center text-[10px] sm:text-[11px] font-montserrat font-bold uppercase tracking-[0.16em]"
              style={{ color: WARM_GOLD }}
            >
              {header}
            </span>
          ))}
        </div>
      </div>

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

              {/* Dotted leader: connects dish name to price columns */}
              <div className="flex-1 border-b border-dotted border-[#C8A265]/35 mx-1.5 mb-1 min-w-[12px]" />

              {/* Price Columns: exactly aligned under the size headers */}
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                {headers.map((header, idx) => {
                  let priceVal: number | null | undefined = null;
                  if (dish.prices && header in dish.prices) {
                    priceVal = dish.prices[header];
                  } else if (idx === 0 && dish.price !== undefined && dish.price !== null) {
                    priceVal = dish.price;
                  }

                  return (
                    <div key={idx} className="w-14 sm:w-16 text-center flex items-center justify-center">
                      {priceVal !== null && priceVal !== undefined && (
                        <span
                          className="text-sm sm:text-base font-cormorant font-bold tracking-wide w-full text-right"
                          style={{ color: WARM_GOLD }}
                        >
                          {formatPrice(priceVal)}
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
                className="text-[10px] sm:text-[10.5px] font-montserrat leading-relaxed opacity-85 mt-0.5 pr-28 line-clamp-2"
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
    <div className="w-full flex-1 flex flex-col justify-around py-1 px-2 sm:px-4">
      {/* 1. SECCIÓN SUPERIOR: Barra de Espresso / Bebidas de Precio Único (como normalmente aparecen) */}
      {singlePriceDishes.length > 0 && (
        <div className="w-full mb-3">
          {/* Subheader */}
          <div className="flex items-center justify-between pb-1 border-b border-[#C8A265]/35 mb-2.5">
            <span
              className="text-[9px] sm:text-[10px] font-montserrat uppercase tracking-[0.25em] font-semibold opacity-85"
              style={{ color: MUTED_BRONZE }}
            >
              Barra de Espresso & Clásicos
            </span>
            <span
              className="text-[9px] font-montserrat uppercase tracking-[0.2em] font-medium opacity-65"
              style={{ color: WARM_GOLD }}
            >
              Extracción Tradicional
            </span>
          </div>

          {/* Regular dishes in balanced 2-column grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 sm:gap-x-10 gap-y-2.5">
            {singlePriceDishes.map((dish) => (
              <div key={dish.id} className="group relative">
                <div className="flex items-baseline justify-between gap-1.5">
                  <h4
                    className="text-base sm:text-[17px] font-cormorant font-bold uppercase tracking-[0.08em] leading-tight shrink-0"
                    style={{ color: CHARCOAL }}
                  >
                    {dish.name || 'Especialidad'}
                  </h4>

                  {/* Dotted leader */}
                  <div className="flex-1 border-b border-dotted border-[#C8A265]/35 mx-1.5 mb-1 min-w-[12px]" />

                  {/* Single Price */}
                  {dish.price !== null && dish.price !== undefined && (
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
                    className="text-[10px] sm:text-[10.5px] font-montserrat leading-relaxed opacity-85 mt-0.5 line-clamp-2"
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

      {/* 2. SECCIÓN INFERIOR: Tabla de Bebidas con Variaciones 12 oz & 16 oz */}
      {multiPriceDishes.length > 0 && (
        <div className="w-full flex flex-col justify-start">
          <div
            className={
              isMultiColumn
                ? 'grid grid-cols-1 sm:grid-cols-2 gap-y-4 sm:gap-y-0 w-full'
                : 'max-w-xl mx-auto w-full'
            }
          >
            {/* Left Column with central dividing border */}
            <div className={isMultiColumn ? 'sm:pr-8 sm:border-r sm:border-[#C8A265]/35 flex flex-col justify-start' : ''}>
              {renderMultiPriceColumn(leftMultiDishes, 'Especialidades')}
            </div>

            {/* Right Column */}
            {isMultiColumn && (
              <div className="sm:pl-8 flex flex-col justify-start">
                {renderMultiPriceColumn(rightMultiDishes, 'Café & Bebidas')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. NOTAS AL PIE: Opciones de Leches y Preparación */}
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
