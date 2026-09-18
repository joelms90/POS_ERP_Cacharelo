import React from 'react';
import type { MenuCatalog, MenuOrientation } from '../../types/menu';
import { MenuPageRenderer } from '../layout/MenuPageRenderer';
import { CoverPage } from '../layout/CoverPage';
import { HorizontalCoverPage } from '../layout/horizontal/HorizontalCoverPage';
import { HorizontalMenuPageRenderer } from '../layout/horizontal/HorizontalMenuPageRenderer';

interface PagePreviewContainerProps {
  catalog: MenuCatalog;
  activePageIndex: number; // -1 for cover, 0+ for section, -99 for all
  zoom: number;
  orientation?: MenuOrientation;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

export const PagePreviewContainer: React.FC<PagePreviewContainerProps> = ({
  catalog,
  activePageIndex,
  zoom,
  orientation = 'vertical',
  containerRef
}) => {
  const { cover, sections, theme, restaurant } = catalog;

  // Aspect ratio dimensions
  const isHorizontal = orientation === 'horizontal';
  const isA4 = theme.pageSize === 'a4';

  // Vertical: Letter (816x1056) or A4 (794x1123). Horizontal: 16:9 widescreen (1280x720)
  const widthPx = isHorizontal ? 1280 : (isA4 ? 794 : 816);
  const heightPx = isHorizontal ? 720 : (isA4 ? 1123 : 1056);

  const renderSinglePage = (pageIndex: number) => {
    if (pageIndex === -1 && cover.enabled) {
      return isHorizontal ? (
        <HorizontalCoverPage
          cover={cover}
          restaurant={restaurant}
          theme={theme}
        />
      ) : (
        <CoverPage
          cover={cover}
          restaurant={restaurant}
          theme={theme}
        />
      );
    }

    const section = sections[pageIndex];
    if (!section) return null;

    return isHorizontal ? (
      <HorizontalMenuPageRenderer
        section={section}
        theme={theme}
        restaurant={restaurant}
        pageNumber={cover.enabled ? pageIndex + 2 : pageIndex + 1}
        totalPages={cover.enabled ? sections.length + 1 : sections.length}
      />
    ) : (
      <MenuPageRenderer
        section={section}
        theme={theme}
        restaurant={restaurant}
        pageNumber={cover.enabled ? pageIndex + 2 : pageIndex + 1}
        totalPages={cover.enabled ? sections.length + 1 : sections.length}
      />
    );
  };

  // If viewing all pages simultaneously
  const isViewAll = activePageIndex === -99;

  return (
    <div
      ref={containerRef}
      data-page-size={theme.pageSize || 'letter'}
      className="print-root-container flex-1 overflow-auto bg-zinc-900/90 flex flex-col items-center py-10 px-4 select-none relative"
      style={{
        backgroundImage: 'radial-gradient(#27272a 1px, transparent 1px)',
        backgroundSize: '24px 24px'
      }}
    >
      <div
        className="zoom-wrapper transition-transform origin-top flex flex-col items-center gap-12"
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: 'top center'
        }}
      >
        {isViewAll ? (
          // View All Mode: Show Cover followed by each Section Page
          <div className="flex flex-col items-center gap-12">
            {cover.enabled && (
              <div
                id="menu-page-cover"
                className="menu-page-container bg-white shadow-2xl rounded-sm transition-all overflow-hidden border border-black/10"
                style={{
                  width: `${widthPx}px`,
                  height: `${heightPx}px`,
                  minWidth: `${widthPx}px`,
                  minHeight: `${heightPx}px`
                }}
              >
                {isHorizontal ? (
                  <HorizontalCoverPage cover={cover} restaurant={restaurant} theme={theme} />
                ) : (
                  <CoverPage cover={cover} restaurant={restaurant} theme={theme} />
                )}
              </div>
            )}

            {sections.map((section, idx) => (
              <div
                key={section.id}
                id={`menu-page-${idx}`}
                className="menu-page-container bg-white shadow-2xl rounded-sm transition-all overflow-hidden border border-black/10"
                style={{
                  width: `${widthPx}px`,
                  height: `${heightPx}px`,
                  minWidth: `${widthPx}px`,
                  minHeight: `${heightPx}px`
                }}
              >
                {isHorizontal ? (
                  <HorizontalMenuPageRenderer
                    section={section}
                    theme={theme}
                    restaurant={restaurant}
                    pageNumber={cover.enabled ? idx + 2 : idx + 1}
                    totalPages={cover.enabled ? sections.length + 1 : sections.length}
                  />
                ) : (
                  <MenuPageRenderer
                    section={section}
                    theme={theme}
                    restaurant={restaurant}
                    pageNumber={cover.enabled ? idx + 2 : idx + 1}
                    totalPages={cover.enabled ? sections.length + 1 : sections.length}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          // Single Page Mode: Show Current Selected Page
          <div
            id="active-menu-page"
            className="menu-page-container bg-white shadow-2xl rounded-sm transition-all overflow-hidden border border-black/10"
            style={{
              width: `${widthPx}px`,
              height: `${heightPx}px`,
              minWidth: `${widthPx}px`,
              minHeight: `${heightPx}px`
            }}
          >
            {renderSinglePage(activePageIndex)}
          </div>
        )}
      </div>

      {/* Off-screen unscaled render container for 1:1 crisp PDF & high-res export */}
      <div
        id="pdf-render-queue"
        className="fixed -left-[99999px] top-0 pointer-events-none opacity-100 z-[-1] print:hidden"
        style={{
          width: `${widthPx}px`
        }}
        aria-hidden="true"
      >
        {cover.enabled && (
          <div
            id="export-page-cover"
            className="bg-white overflow-hidden"
            style={{
              width: `${widthPx}px`,
              height: `${heightPx}px`,
              minWidth: `${widthPx}px`,
              minHeight: `${heightPx}px`
            }}
          >
            {isHorizontal ? (
              <HorizontalCoverPage cover={cover} restaurant={restaurant} theme={theme} />
            ) : (
              <CoverPage cover={cover} restaurant={restaurant} theme={theme} />
            )}
          </div>
        )}

        {sections.map((section, idx) => (
          <div
            key={section.id}
            id={`export-page-${idx}`}
            className="bg-white overflow-hidden"
            style={{
              width: `${widthPx}px`,
              height: `${heightPx}px`,
              minWidth: `${widthPx}px`,
              minHeight: `${heightPx}px`
            }}
          >
            {isHorizontal ? (
              <HorizontalMenuPageRenderer
                section={section}
                theme={theme}
                restaurant={restaurant}
                pageNumber={cover.enabled ? idx + 2 : idx + 1}
                totalPages={cover.enabled ? sections.length + 1 : sections.length}
              />
            ) : (
              <MenuPageRenderer
                section={section}
                theme={theme}
                restaurant={restaurant}
                pageNumber={cover.enabled ? idx + 2 : idx + 1}
                totalPages={cover.enabled ? sections.length + 1 : sections.length}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
