import React from 'react';
import type { MenuSection, MenuTheme, Dish } from '../../types/menu';

interface ColumnarTableLayoutProps {
  section: MenuSection;
  theme: MenuTheme;
}

export const ColumnarTableLayout: React.FC<ColumnarTableLayoutProps> = ({ section }) => {
  const dishes = section.dishes;

  // 1. Cold beverages (FRÍO)
  const frioDishes = React.useMemo(() => {
    return dishes.filter((d) => d.group === 'frio' || d.id.includes('frio'));
  }, [dishes]);

  // 2. Single-price classic beverages (e.g. Espresso Sencillo, Doble, Cortados)
  const classicDishes = React.useMemo(() => {
    return dishes.filter(
      (d) =>
        (!d.prices || Object.keys(d.prices).length === 0) &&
        d.group !== 'frio' &&
        !d.id.includes('frio') &&
        d.group !== 'te' &&
        d.group !== 'frappe' &&
        d.group !== 'smoothie' &&
        d.group !== 'jugo' &&
        d.group !== 'refresco' &&
        d.group !== 'zoe'
    );
  }, [dishes]);

  // 3. Multi-size beverages (e.g. Calientes 12 oz / 16 oz)
  const calienteMultiDishes = React.useMemo(() => {
    return dishes.filter(
      (d) =>
        d.prices &&
        Object.keys(d.prices).length > 0 &&
        d.group !== 'frio' &&
        !d.id.includes('frio') &&
        d.group !== 'te' &&
        d.group !== 'frappe' &&
        d.group !== 'smoothie' &&
        d.group !== 'jugo' &&
        d.group !== 'refresco' &&
        d.group !== 'zoe'
    );
  }, [dishes]);

  // 4. Combined Tés & Frappés support (e.g. Page 13: BEBIDAS - Infusiones & Frappé)
  const teDishes = React.useMemo(() => {
    return dishes.filter(
      (d) =>
        d.group === 'te' ||
        d.id.startsWith('te-') ||
        d.id.includes('tizana') ||
        d.id.includes('tisana') ||
        d.id === 'chai'
    );
  }, [dishes]);

  const frappeDishes = React.useMemo(() => {
    return dishes.filter((d) => d.group === 'frappe' || d.id.includes('frappe'));
  }, [dishes]);

  const isTeAndFrappe = teDishes.length > 0 && frappeDishes.length > 0;

  // 5. Combined Smoothies & Jugos support (e.g. Page 14: BEBIDAS - Smoothies & Jugos)
  const smoothieDishes = React.useMemo(() => {
    return dishes.filter((d) => d.group === 'smoothie' || d.id.includes('smoothie'));
  }, [dishes]);

  const jugoDishes = React.useMemo(() => {
    return dishes.filter((d) => d.group === 'jugo' || d.id.includes('jugo'));
  }, [dishes]);

  const isSmoothieAndJugo = smoothieDishes.length > 0 && jugoDishes.length > 0;

  // 6. Combined Refrescos & Agua Zoe support (e.g. Page 15: BEBIDAS - Refrescos & Agua)
  const refrescoDishes = React.useMemo(() => {
    return dishes.filter(
      (d) =>
        d.group === 'refresco' ||
        d.id.includes('refresco') ||
        d.id.includes('coca') ||
        d.id.includes('sprite') ||
        d.id.includes('fanta') ||
        d.id.includes('mundet') ||
        d.id.includes('topo') ||
        d.id.includes('fiel')
    );
  }, [dishes]);

  const zoeDishes = React.useMemo(() => {
    return dishes.filter((d) => d.group === 'zoe' || d.id.includes('zoe'));
  }, [dishes]);

  const isRefrescoAndZoe = refrescoDishes.length > 0 && zoeDishes.length > 0;

  const parseHeader = (header: string): { type: string; size: string } => {
    const match = header.trim().match(/^(caliente|frío|frio)\s*(.*)$/i);
    if (match) {
      return {
        type: match[1].toUpperCase(),
        size: match[2].toUpperCase().replace(/(\d+)\s*(OZ|ML)/i, '$1 $2')
      };
    }
    return {
      type: '',
      size: header.toUpperCase().replace(/(\d+)\s*(OZ|ML)/i, '$1 $2')
    };
  };

  const teHeaders: string[] = React.useMemo(() => {
    if (section.priceHeaders && section.priceHeaders.length > 0 && !section.priceHeaders.includes('12 oz')) {
      return section.priceHeaders;
    }
    const headerSet = new Set<string>();
    teDishes.forEach((d) => {
      if (d.prices) {
        Object.keys(d.prices).forEach((k) => headerSet.add(k));
      }
    });
    if (headerSet.size > 0) {
      return Array.from(headerSet);
    }
    return ['Caliente 12oz', 'Caliente 16oz', 'Frío 16oz'];
  }, [section.priceHeaders, teDishes]);

  // Derive price headers (e.g. ['12 oz', '16 oz']) from multi-size dishes
  const headers: string[] = React.useMemo(() => {
    if (section.priceHeaders && section.priceHeaders.length > 0) {
      return section.priceHeaders;
    }
    const headerSet = new Set<string>();
    calienteMultiDishes.forEach((d) => {
      if (d.prices) {
        Object.keys(d.prices).forEach((k) => headerSet.add(k));
      }
    });
    if (headerSet.size > 0) {
      return Array.from(headerSet);
    }
    return ['12 oz', '16 oz'];
  }, [section.priceHeaders, calienteMultiDishes]);

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

  // Split multi-size dishes into two balanced columns if more than 3 and no separate frio column
  const isMultiColumn = calienteMultiDishes.length > 3;
  const half = Math.ceil(calienteMultiDishes.length / 2);
  const leftMultiDishes = isMultiColumn ? calienteMultiDishes.slice(0, half) : calienteMultiDishes;
  const rightMultiDishes = isMultiColumn ? calienteMultiDishes.slice(half) : [];

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
              <div className="flex items-center gap-1.5 shrink-0">
                {dish.featured && (dish.image || dish.imageProcessed) && (
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full overflow-hidden border border-[#C8A265] shadow-xs shrink-0 inline-flex items-center justify-center">
                    <img
                      src={dish.imageProcessed || dish.image}
                      alt={dish.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <h4
                  className="text-base sm:text-[17px] font-cormorant font-bold uppercase tracking-[0.08em] leading-tight"
                  style={{ color: CHARCOAL }}
                >
                  {dish.name || 'Especialidad'}
                </h4>
              </div>

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

  const renderSinglePriceColumn = (columnDishes: Dish[], categoryTitle: string, rightTag: string = 'En las rocas') => (
    <div className="flex-1 flex flex-col justify-start">
      {/* Column Header: Category sub-heading on left, rightTag on right */}
      <div className="flex items-center justify-between pb-1.5 border-b border-[#C8A265]/35 mb-2.5">
        <span
          className="text-[9px] sm:text-[10px] font-montserrat uppercase tracking-[0.22em] font-semibold opacity-85"
          style={{ color: MUTED_BRONZE }}
        >
          {categoryTitle}
        </span>
        <span
          className="text-[9px] font-montserrat uppercase tracking-[0.16em] font-medium opacity-65"
          style={{ color: WARM_GOLD }}
        >
          {rightTag}
        </span>
      </div>

      {/* Dish rows */}
      <div className="space-y-2.5">
        {columnDishes.map((dish) => (
          <div key={dish.id} className="group relative">
            {/* Top row: Name + dotted leader + single price */}
            <div className="flex items-baseline justify-between gap-1.5">
              <div className="flex items-center gap-1.5 shrink-0">
                {dish.featured && (dish.image || dish.imageProcessed) && (
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full overflow-hidden border border-[#C8A265] shadow-xs shrink-0 inline-flex items-center justify-center">
                    <img
                      src={dish.imageProcessed || dish.image}
                      alt={dish.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <h4
                  className="text-base sm:text-[17px] font-cormorant font-bold uppercase tracking-[0.08em] leading-tight"
                  style={{ color: CHARCOAL }}
                >
                  {dish.name || 'Especialidad'}
                </h4>
              </div>

              {/* Dotted leader */}
              <div className="flex-1 border-b border-dotted border-[#C8A265]/35 mx-1.5 mb-1 min-w-[12px]" />

              {/* Price */}
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

  if (isTeAndFrappe) {
    return (
      <div className="w-full flex-1 flex flex-col justify-around py-1 px-2 sm:px-4">
        {/* 1. SECCIÓN SUPERIOR: TÉS & TISANAS */}
        <div className="w-full">
          {/* Header Row */}
          <div className="flex items-end justify-between pb-1.5 border-b border-[#C8A265]/35 mb-2">
            <span
              className="text-[9px] sm:text-[10px] font-montserrat uppercase tracking-[0.25em] font-semibold opacity-85"
              style={{ color: MUTED_BRONZE }}
            >
              Tés & Tisanas
            </span>
            <div className="flex items-center gap-2 sm:gap-4">
              {teHeaders.map((header, idx) => {
                const parsed = parseHeader(header);
                return (
                  <div key={idx} className="w-16 sm:w-20 text-center flex flex-col items-center">
                    {parsed.type && (
                      <span
                        className="text-[7.5px] sm:text-[8px] font-montserrat uppercase tracking-[0.16em] opacity-80 mb-0.5"
                        style={{ color: MUTED_BRONZE }}
                      >
                        {parsed.type}
                      </span>
                    )}
                    <span
                      className="text-[10px] sm:text-[11px] font-montserrat font-bold uppercase tracking-[0.12em]"
                      style={{ color: WARM_GOLD }}
                    >
                      {parsed.size}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dish rows */}
          <div className="space-y-2.5">
            {teDishes.map((dish) => (
              <div key={dish.id} className="group relative">
                <div className="flex items-baseline justify-between gap-1.5">
                  <h4
                    className="text-base sm:text-[17px] font-cormorant font-bold uppercase tracking-[0.08em] leading-tight shrink-0"
                    style={{ color: CHARCOAL }}
                  >
                    {dish.name}
                  </h4>

                  {/* Dotted leader */}
                  <div className="flex-1 border-b border-dotted border-[#C8A265]/35 mx-1.5 mb-1 min-w-[12px]" />

                  {/* Prices */}
                  <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                    {teHeaders.map((header, idx) => {
                      let priceVal: number | null | undefined = null;
                      if (dish.prices && header in dish.prices) {
                        priceVal = dish.prices[header];
                      } else if (dish.prices) {
                        const norm = (s: string) =>
                          s
                            .toLowerCase()
                            .normalize('NFD')
                            .replace(/[\u0300-\u036f]/g, '')
                            .replace(/\s+/g, '');
                        const target = norm(header);
                        const foundKey = Object.keys(dish.prices).find((k) => norm(k) === target);
                        if (foundKey) priceVal = dish.prices[foundKey];
                      }

                      return (
                        <div key={idx} className="w-16 sm:w-20 text-center flex items-center justify-center">
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

                {dish.description && (
                  <p
                    className="text-[10px] sm:text-[10.5px] font-montserrat leading-relaxed opacity-85 mt-0.5 pr-48 line-clamp-1"
                    style={{ color: CHARCOAL }}
                  >
                    {dish.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Separador */}
        <div className="w-full border-b border-[#C8A265]/35 my-2 sm:my-3" />

        {/* 2. SECCIÓN INFERIOR: FRAPPÉ */}
        <div className="w-full">
          {/* Header Row */}
          <div className="flex items-end justify-between pb-1.5 border-b border-[#C8A265]/35 mb-2.5">
            <span
              className="text-[9px] sm:text-[10px] font-montserrat uppercase tracking-[0.25em] font-semibold opacity-85"
              style={{ color: MUTED_BRONZE }}
            >
              Frappé
            </span>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="w-16 sm:w-20 text-center flex flex-col items-center">
                <span
                  className="text-[7.5px] sm:text-[8px] font-montserrat uppercase tracking-[0.16em] opacity-80 mb-0.5"
                  style={{ color: MUTED_BRONZE }}
                >
                  Frío
                </span>
                <span
                  className="text-[10px] sm:text-[11px] font-montserrat font-bold uppercase tracking-[0.12em]"
                  style={{ color: WARM_GOLD }}
                >
                  16 oz
                </span>
              </div>
            </div>
          </div>

          {/* Dish rows + Featured showcase */}
          <div className="flex items-center gap-3 sm:gap-5">
            <div className="flex-1 space-y-2.5">
              {frappeDishes.map((dish) => {
                const priceVal = dish.prices?.['16oz'] ?? dish.prices?.['16 oz'] ?? dish.price;
                return (
                  <div key={dish.id} className="group relative">
                    <div className="flex items-baseline justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 shrink-0">
                        {dish.featured && (dish.image || dish.imageProcessed) && (
                          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full overflow-hidden border border-[#C8A265] shadow-xs shrink-0 inline-flex items-center justify-center">
                            <img
                              src={dish.imageProcessed || dish.image}
                              alt={dish.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <h4
                          className="text-base sm:text-[17px] font-cormorant font-bold uppercase tracking-[0.08em] leading-tight"
                          style={{ color: CHARCOAL }}
                        >
                          {dish.name}
                        </h4>
                      </div>

                      {/* Dotted leader */}
                      <div className="flex-1 border-b border-dotted border-[#C8A265]/35 mx-1.5 mb-1 min-w-[12px]" />

                      {/* Price in far right column matching teHeaders alignment */}
                      <div className="w-16 sm:w-20 text-center flex items-center justify-end shrink-0">
                        {priceVal !== null && priceVal !== undefined && (
                          <span
                            className="text-sm sm:text-base font-cormorant font-bold tracking-wide text-right w-full"
                            style={{ color: WARM_GOLD }}
                          >
                            {formatPrice(priceVal)}
                          </span>
                        )}
                      </div>
                    </div>

                    {dish.description && (
                      <p
                        className="text-[10px] sm:text-[10.5px] font-montserrat leading-relaxed opacity-85 mt-0.5 pr-28 line-clamp-1"
                        style={{ color: CHARCOAL }}
                      >
                        {dish.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Featured Frappe Photo Showcase */}
            {(() => {
              const featuredFrappe = frappeDishes.find((d) => d.featured && (d.image || d.imageProcessed));
              if (!featuredFrappe) return null;
              return (
                <div className="shrink-0 flex flex-col items-center justify-center pl-2">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-[#C8A265]/70 shadow-md">
                    <img
                      src={featuredFrappe.imageProcessed || featuredFrappe.image}
                      alt={featuredFrappe.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span
                    className="text-[8px] font-montserrat uppercase tracking-widest font-semibold mt-1"
                    style={{ color: WARM_GOLD }}
                  >
                    ★ Destacado
                  </span>
                  <span
                    className="text-[9.5px] font-cormorant font-bold uppercase tracking-wider text-center max-w-[90px] truncate"
                    style={{ color: CHARCOAL }}
                  >
                    {featuredFrappe.name}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  }

  if (isSmoothieAndJugo) {
    return (
      <div className="w-full flex-1 flex flex-col justify-around py-1 px-2 sm:px-4">
        {/* 1. SECCIÓN SUPERIOR: SMOOTHIES */}
        <div className="w-full">
          {/* Header Row */}
          <div className="flex items-end justify-between pb-1.5 border-b border-[#C8A265]/35 mb-2.5">
            <span
              className="text-[9px] sm:text-[10px] font-montserrat uppercase tracking-[0.25em] font-semibold opacity-85"
              style={{ color: MUTED_BRONZE }}
            >
              Smoothies
            </span>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="w-16 sm:w-20 text-center flex flex-col items-center">
                <span
                  className="text-[7.5px] sm:text-[8px] font-montserrat uppercase tracking-[0.16em] opacity-80 mb-0.5"
                  style={{ color: MUTED_BRONZE }}
                >
                  Frío
                </span>
                <span
                  className="text-[10px] sm:text-[11px] font-montserrat font-bold uppercase tracking-[0.12em]"
                  style={{ color: WARM_GOLD }}
                >
                  16 oz
                </span>
              </div>
            </div>
          </div>

          {/* Dish rows + Featured showcase */}
          <div className="flex items-center gap-3 sm:gap-5">
            <div className="flex-1 space-y-3">
              {smoothieDishes.map((dish) => {
                const priceVal = dish.prices?.['16oz'] ?? dish.prices?.['16 oz'] ?? dish.price;
                return (
                  <div key={dish.id} className="group relative">
                    <div className="flex items-baseline justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 shrink-0">
                        {dish.featured && (dish.image || dish.imageProcessed) && (
                          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full overflow-hidden border border-[#C8A265] shadow-xs shrink-0 inline-flex items-center justify-center">
                            <img
                              src={dish.imageProcessed || dish.image}
                              alt={dish.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <h4
                          className="text-base sm:text-[17px] font-cormorant font-bold uppercase tracking-[0.08em] leading-tight"
                          style={{ color: CHARCOAL }}
                        >
                          {dish.name}
                        </h4>
                      </div>

                      {/* Dotted leader */}
                      <div className="flex-1 border-b border-dotted border-[#C8A265]/35 mx-1.5 mb-1 min-w-[12px]" />

                      {/* Price in far right column */}
                      <div className="w-16 sm:w-20 text-center flex items-center justify-end shrink-0">
                        {priceVal !== null && priceVal !== undefined && (
                          <span
                            className="text-sm sm:text-base font-cormorant font-bold tracking-wide text-right w-full"
                            style={{ color: WARM_GOLD }}
                          >
                            {formatPrice(priceVal)}
                          </span>
                        )}
                      </div>
                    </div>

                    {dish.description && (
                      <p
                        className="text-[10px] sm:text-[10.5px] font-montserrat leading-relaxed opacity-85 mt-0.5 pr-10"
                        style={{ color: CHARCOAL }}
                      >
                        {dish.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Featured Smoothie Photo Showcase */}
            {(() => {
              const featuredSmoothie = smoothieDishes.find((d) => d.featured && (d.image || d.imageProcessed));
              if (!featuredSmoothie) return null;
              return (
                <div className="shrink-0 flex flex-col items-center justify-center pl-2">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-[#C8A265]/70 shadow-md">
                    <img
                      src={featuredSmoothie.imageProcessed || featuredSmoothie.image}
                      alt={featuredSmoothie.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span
                    className="text-[8px] font-montserrat uppercase tracking-widest font-semibold mt-1"
                    style={{ color: WARM_GOLD }}
                  >
                    ★ Destacado
                  </span>
                  <span
                    className="text-[9.5px] font-cormorant font-bold uppercase tracking-wider text-center max-w-[90px] truncate"
                    style={{ color: CHARCOAL }}
                  >
                    {featuredSmoothie.name}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Separador */}
        <div className="w-full border-b border-[#C8A265]/35 my-2 sm:my-3" />

        {/* 2. SECCIÓN INFERIOR: JUGOS */}
        <div className="w-full">
          {/* Header Row */}
          <div className="flex items-end justify-between pb-1.5 border-b border-[#C8A265]/35 mb-2.5">
            <span
              className="text-[9px] sm:text-[10px] font-montserrat uppercase tracking-[0.25em] font-semibold opacity-85"
              style={{ color: MUTED_BRONZE }}
            >
              Jugos Naturales
            </span>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="w-16 sm:w-20 text-center flex flex-col items-center">
                <span
                  className="text-[7.5px] sm:text-[8px] font-montserrat uppercase tracking-[0.16em] opacity-80 mb-0.5"
                  style={{ color: MUTED_BRONZE }}
                >
                  Frío
                </span>
                <span
                  className="text-[10px] sm:text-[11px] font-montserrat font-bold uppercase tracking-[0.12em]"
                  style={{ color: WARM_GOLD }}
                >
                  16 oz
                </span>
              </div>
            </div>
          </div>

          {/* Dish rows + Featured showcase */}
          <div className="flex items-center gap-3 sm:gap-5">
            <div className="flex-1 space-y-3">
              {jugoDishes.map((dish) => {
                const priceVal = dish.prices?.['16oz'] ?? dish.prices?.['16 oz'] ?? dish.price;
                return (
                  <div key={dish.id} className="group relative">
                    <div className="flex items-baseline justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 shrink-0">
                        {dish.featured && (dish.image || dish.imageProcessed) && (
                          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full overflow-hidden border border-[#C8A265] shadow-xs shrink-0 inline-flex items-center justify-center">
                            <img
                              src={dish.imageProcessed || dish.image}
                              alt={dish.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <h4
                          className="text-base sm:text-[17px] font-cormorant font-bold uppercase tracking-[0.08em] leading-tight"
                          style={{ color: CHARCOAL }}
                        >
                          {dish.name}
                        </h4>
                      </div>

                      {/* Dotted leader */}
                      <div className="flex-1 border-b border-dotted border-[#C8A265]/35 mx-1.5 mb-1 min-w-[12px]" />

                      {/* Price in far right column */}
                      <div className="w-16 sm:w-20 text-center flex items-center justify-end shrink-0">
                        {priceVal !== null && priceVal !== undefined && (
                          <span
                            className="text-sm sm:text-base font-cormorant font-bold tracking-wide text-right w-full"
                            style={{ color: WARM_GOLD }}
                          >
                            {formatPrice(priceVal)}
                          </span>
                        )}
                      </div>
                    </div>

                    {dish.description && (
                      <p
                        className="text-[10px] sm:text-[10.5px] font-montserrat leading-relaxed opacity-85 mt-0.5 pr-10"
                        style={{ color: CHARCOAL }}
                      >
                        {dish.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Featured Jugo Photo Showcase */}
            {(() => {
              const featuredJugo = jugoDishes.find((d) => d.featured && (d.image || d.imageProcessed));
              if (!featuredJugo) return null;
              return (
                <div className="shrink-0 flex flex-col items-center justify-center pl-2">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-[#C8A265]/70 shadow-md">
                    <img
                      src={featuredJugo.imageProcessed || featuredJugo.image}
                      alt={featuredJugo.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span
                    className="text-[8px] font-montserrat uppercase tracking-widest font-semibold mt-1"
                    style={{ color: WARM_GOLD }}
                  >
                    ★ Destacado
                  </span>
                  <span
                    className="text-[9.5px] font-cormorant font-bold uppercase tracking-wider text-center max-w-[90px] truncate"
                    style={{ color: CHARCOAL }}
                  >
                    {featuredJugo.name}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  }

  if (isRefrescoAndZoe) {
    return (
      <div className="w-full flex-1 flex flex-col justify-around py-1 px-2 sm:px-4">
        {/* 1. SECCIÓN SUPERIOR: REFRESCOS Y AGUA */}
        <div className="w-full">
          {/* Header Row */}
          <div className="flex items-center justify-between pb-1.5 border-b border-[#C8A265]/35 mb-2.5">
            <span
              className="text-[9px] sm:text-[10px] font-montserrat uppercase tracking-[0.25em] font-semibold opacity-85"
              style={{ color: MUTED_BRONZE }}
            >
              Refrescos y Agua
            </span>
            <span
              className="text-[9px] font-montserrat uppercase tracking-[0.2em] font-medium opacity-65"
              style={{ color: WARM_GOLD }}
            >
              Variedad
            </span>
          </div>

          {/* Regular dishes in balanced 2-column grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 sm:gap-x-10 gap-y-2.5">
            {refrescoDishes.map((dish) => (
              <div key={dish.id} className="group relative">
                <div className="flex items-baseline justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 shrink-0">
                    {dish.featured && (dish.image || dish.imageProcessed) && (
                      <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full overflow-hidden border border-[#C8A265] shadow-xs shrink-0 inline-flex items-center justify-center">
                        <img
                          src={dish.imageProcessed || dish.image}
                          alt={dish.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <h4
                      className="text-base sm:text-[17px] font-cormorant font-bold uppercase tracking-[0.08em] leading-tight"
                      style={{ color: CHARCOAL }}
                    >
                      {dish.name}
                    </h4>
                  </div>

                  {/* Dotted leader */}
                  <div className="flex-1 border-b border-dotted border-[#C8A265]/35 mx-1.5 mb-1 min-w-[12px]" />

                  {/* Price */}
                  {dish.price !== null && dish.price !== undefined && (
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
                    className="text-[10px] sm:text-[10.5px] font-montserrat leading-relaxed opacity-85 mt-0.5 line-clamp-1"
                    style={{ color: CHARCOAL }}
                  >
                    {dish.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Separador */}
        <div className="w-full border-b border-[#C8A265]/35 my-2 sm:my-3" />

        {/* 2. SECCIÓN INFERIOR: AGUA ZOE */}
        <div className="w-full">
          {/* Header Row */}
          <div className="flex items-center justify-between pb-1.5 border-b border-[#C8A265]/35 mb-2.5">
            <span
              className="text-[9px] sm:text-[10px] font-montserrat uppercase tracking-[0.25em] font-semibold opacity-85"
              style={{ color: MUTED_BRONZE }}
            >
              Agua Zoe
            </span>
            <span
              className="text-[9px] font-montserrat uppercase tracking-[0.2em] font-medium opacity-65"
              style={{ color: WARM_GOLD }}
            >
              Alcalina
            </span>
          </div>

          {/* Dishes + Featured showcase on right */}
          <div className="flex items-center gap-3 sm:gap-5">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-8 sm:gap-x-10 gap-y-2.5">
              {zoeDishes.map((dish) => (
                <div key={dish.id} className="group relative">
                  <div className="flex items-baseline justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 shrink-0">
                      {dish.featured && (dish.image || dish.imageProcessed) && (
                        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full overflow-hidden border border-[#C8A265] shadow-xs shrink-0 inline-flex items-center justify-center">
                          <img
                            src={dish.imageProcessed || dish.image}
                            alt={dish.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <h4
                        className="text-base sm:text-[17px] font-cormorant font-bold uppercase tracking-[0.08em] leading-tight"
                        style={{ color: CHARCOAL }}
                      >
                        {dish.name}
                      </h4>
                    </div>

                    {/* Dotted leader */}
                    <div className="flex-1 border-b border-dotted border-[#C8A265]/35 mx-1.5 mb-1 min-w-[12px]" />

                    {/* Price */}
                    {dish.price !== null && dish.price !== undefined && (
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
                      className="text-[10px] sm:text-[10.5px] font-montserrat leading-relaxed opacity-85 mt-0.5 line-clamp-1"
                      style={{ color: CHARCOAL }}
                    >
                      {dish.description}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Featured Zoe Photo Showcase */}
            {(() => {
              const featuredZoe = zoeDishes.find((d) => d.featured && (d.image || d.imageProcessed));
              if (!featuredZoe) return null;
              return (
                <div className="shrink-0 flex flex-col items-center justify-center pl-2">
                  <div className="w-18 h-18 sm:w-22 sm:h-22 rounded-full overflow-hidden border-2 border-[#C8A265]/70 shadow-md">
                    <img
                      src={featuredZoe.imageProcessed || featuredZoe.image}
                      alt={featuredZoe.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span
                    className="text-[8px] font-montserrat uppercase tracking-widest font-semibold mt-1"
                    style={{ color: WARM_GOLD }}
                  >
                    ★ Destacado
                  </span>
                  <span
                    className="text-[9.5px] font-cormorant font-bold uppercase tracking-wider text-center max-w-[90px] truncate"
                    style={{ color: CHARCOAL }}
                  >
                    {featuredZoe.name}
                  </span>
                </div>
              );
            })()}
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 flex flex-col justify-around py-1 px-2 sm:px-4">
      {/* 1. SECCIÓN SUPERIOR: Barra de Espresso / Bebidas de Precio Único (como normalmente aparecen) */}
      {classicDishes.length > 0 && (
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
            {classicDishes.map((dish) => (
              <div key={dish.id} className="group relative">
                <div className="flex items-baseline justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 shrink-0">
                    {dish.featured && (dish.image || dish.imageProcessed) && (
                      <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full overflow-hidden border border-[#C8A265] shadow-xs shrink-0 inline-flex items-center justify-center">
                        <img
                          src={dish.imageProcessed || dish.image}
                          alt={dish.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <h4
                      className="text-base sm:text-[17px] font-cormorant font-bold uppercase tracking-[0.08em] leading-tight"
                      style={{ color: CHARCOAL }}
                    >
                      {dish.name || 'Especialidad'}
                    </h4>
                  </div>

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

      {/* 2. SECCIÓN PRINCIPAL: Calientes & Frío (o Multi-columnas si no hay frío) */}
      {(calienteMultiDishes.length > 0 || frioDishes.length > 0) && (
        <div className="w-full flex flex-col justify-start">
          {frioDishes.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 sm:gap-y-0 w-full">
              {/* Left Column: Calientes */}
              <div className="sm:pr-8 sm:border-r sm:border-[#C8A265]/35 flex flex-col justify-start">
                {renderMultiPriceColumn(calienteMultiDishes, 'Calientes')}
              </div>

              {/* Right Column: Frío */}
              <div className="sm:pl-8 flex flex-col justify-start">
                {renderSinglePriceColumn(frioDishes, 'Frío', 'En las rocas')}
              </div>
            </div>
          ) : (
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
          )}
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
