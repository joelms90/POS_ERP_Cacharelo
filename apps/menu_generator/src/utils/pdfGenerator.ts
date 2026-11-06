import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
import type { MenuCatalog } from '../types/menu';

export interface GeneratePdfOptions {
  catalog: MenuCatalog;
  singlePageIndex?: number; // -1 for cover, 0+ for section, undefined for ALL pages
  pageFilter?: 'all' | 'odd' | 'even';
  targetFormat?: 'letter' | 'a4' | '16:9'; // Override catalog.theme.pageSize
  orientation?: 'vertical' | 'horizontal';
  onProgress?: (current: number, total: number, message: string) => void;
}

export interface PdfResult {
  blobUrl: string;
  filename: string;
}

/**
 * Direct High-Resolution Digital PDF Generator
 * Eliminates browser print dialog (window.print), capturing pages at native 2x retina
 * resolution and embedding into a digital PDF with exact physical dimensions (Carta / A4 / 16:9).
 */
export async function generateDigitalPdf({
  catalog,
  singlePageIndex,
  pageFilter = 'all',
  targetFormat,
  orientation = 'vertical',
  onProgress
}: GeneratePdfOptions): Promise<PdfResult> {
  const { theme, cover, sections, restaurant } = catalog;
  const isHorizontal = orientation === 'horizontal' || targetFormat === '16:9';
  const activePageSize = targetFormat || theme.pageSize || 'letter';
  const isA4 = !isHorizontal && activePageSize === 'a4';

  // Physical millimeter dimensions:
  // 16:9 Widescreen: 297.0 mm × 167.06 mm (Landscape)
  // Carta / Letter: 215.9 mm × 279.4 mm (Portrait)
  // A4: 210.0 mm × 297.0 mm (Portrait)
  const widthMm = isHorizontal ? 297.0 : (isA4 ? 210.0 : 215.9);
  const heightMm = isHorizontal ? 167.06 : (isA4 ? 297.0 : 279.4);
  const widthPx = isHorizontal ? 1280 : (isA4 ? 794 : 816);
  const heightPx = isHorizontal ? 720 : (isA4 ? 1123 : 1056);
  const formatName = isHorizontal ? '16-9' : (isA4 ? 'A4' : 'Carta');
  const orientationDoc: 'portrait' | 'landscape' = isHorizontal ? 'landscape' : 'portrait';

  onProgress?.(0, 1, 'Verificando tipografías y recursos gráficos...');

  // Ensure all web fonts are fully rendered
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
      console.debug('All fonts loaded successfully');
    } catch (e) {
      console.warn('Font loading check timed out or failed, continuing', e);
    }
  }

  // Extended delay for fonts to settle and apply to DOM
  // This prevents text overlap caused by font loading timing issues
  await new Promise((resolve) => setTimeout(resolve, 500));
  console.debug('Font settling delay complete');

  // Verify fonts are actually loaded
  if (typeof document !== 'undefined' && document.fonts) {
    const cormorantLoaded = await document.fonts.check('16px "Cormorant Garamond"');
    const montserratLoaded = await document.fonts.check('16px Montserrat');
    console.debug('Custom fonts check:', {
      cormorant: cormorantLoaded ? 'loaded' : 'NOT LOADED',
      montserrat: montserratLoaded ? 'loaded' : 'NOT LOADED'
    });

    if (!cormorantLoaded || !montserratLoaded) {
      console.warn('Custom fonts not loaded, waiting additional time...');
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const recheckCormorant = await document.fonts.check('16px "Cormorant Garamond"');
      const recheckMontserrat = await document.fonts.check('16px Montserrat');
      console.debug('Fonts recheck:', {
        cormorant: recheckCormorant ? 'loaded' : 'STILL NOT LOADED',
        montserrat: recheckMontserrat ? 'loaded' : 'STILL NOT LOADED'
      });
    }
  }

  // Make export queue fully visible and rendered during PDF generation
  // The export queue has no zoom transform, ensuring accurate capture
  const exportQueue = document.getElementById('pdf-render-queue');
  const originalOpacity = exportQueue?.style.opacity;
  const originalVisibility = exportQueue?.style.visibility;

  if (exportQueue) {
    // Make fully visible
    exportQueue.style.opacity = '1';
    exportQueue.style.visibility = 'visible';
    exportQueue.style.display = 'block';
    exportQueue.style.position = 'fixed';
    exportQueue.style.top = '0';
    exportQueue.style.left = '0';

    // Force layout recalculation - read multiple properties to trigger reflow
    void exportQueue.offsetHeight;
    void exportQueue.offsetWidth;
    void exportQueue.getBoundingClientRect();

    console.debug('Export queue visible, waiting for layout to stabilize...');

    // Wait for layout to fully stabilize
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Force another reflow
    void exportQueue.offsetHeight;

    // Additional delay for fonts and layout
    await new Promise((resolve) => setTimeout(resolve, 300));

    console.debug('Export queue fully rendered and ready for capture');

    // Debug: Compare export queue vs preview rendering
    const exportPage = exportQueue.querySelector('[id^="export-page-"]');
    const previewPage = document.querySelector('[id^="menu-page-"]:not(#menu-page-cover)');

    if (exportPage && previewPage) {
      const exportTitle = exportPage.querySelector('h4');
      const previewTitle = previewPage.querySelector('h4');

      if (exportTitle && previewTitle) {
        const exportStyle = window.getComputedStyle(exportTitle);
        const previewStyle = window.getComputedStyle(previewTitle);

        const exportClasses = exportTitle.className;
        const previewClasses = previewTitle.className;

        console.debug('Comparing first dish title rendering:', {
          exportQueue: {
            text: exportTitle.textContent?.substring(0, 30),
            classes: exportClasses,
            fontSize: exportStyle.fontSize,
            fontFamily: exportStyle.fontFamily,
            fontWeight: exportStyle.fontWeight,
            lineHeight: exportStyle.lineHeight,
            letterSpacing: exportStyle.letterSpacing,
            width: exportTitle.getBoundingClientRect().width,
            hasFontCormorant: exportClasses.includes('font-cormorant')
          },
          preview: {
            text: previewTitle.textContent?.substring(0, 30),
            classes: previewClasses,
            fontSize: previewStyle.fontSize,
            fontFamily: previewStyle.fontFamily,
            fontWeight: previewStyle.fontWeight,
            lineHeight: previewStyle.lineHeight,
            letterSpacing: previewStyle.letterSpacing,
            width: previewTitle.getBoundingClientRect().width,
            hasFontCormorant: previewClasses.includes('font-cormorant')
          }
        });

        // Check if font-cormorant is missing from export queue
        if (!exportClasses.includes('font-cormorant') && previewClasses.includes('font-cormorant')) {
          console.error('⚠️ CRITICAL: Export queue is missing font-cormorant class!');
          console.error('Export element classes:', exportClasses);
          console.error('Preview element classes:', previewClasses);
        }
      }
    }
  }

  // Initialize jsPDF with exact custom millimeter dimensions
  const pdf = new jsPDF({
    orientation: orientationDoc,
    unit: 'mm',
    format: [widthMm, heightMm],
    compress: true
  });

  // Determine list of page IDs to export
  interface PageExportTarget {
    elementId: string;
    fallbackId?: string;
    label: string;
    docPageNumber: number; // 1-based page number in document sequence
  }

  const allTargets: PageExportTarget[] = [];

  if (cover.enabled) {
    allTargets.push({
      elementId: 'export-page-cover',
      fallbackId: 'menu-page-cover',
      label: 'Portada (Pág. 1)',
      docPageNumber: 1
    });
  }
  sections.forEach((sec, idx) => {
    const pageNum = cover.enabled ? idx + 2 : idx + 1;
    allTargets.push({
      elementId: `export-page-${idx}`,
      fallbackId: `menu-page-${idx}`,
      label: `${sec.name} (Pág. ${pageNum})`,
      docPageNumber: pageNum
    });
  });

  let targets: PageExportTarget[] = [];

  if (singlePageIndex !== undefined) {
    if (singlePageIndex === -1 && cover.enabled) {
      targets.push({
        elementId: 'export-page-cover',
        fallbackId: 'menu-page-cover',
        label: 'Portada (Pág. 1)',
        docPageNumber: 1
      });
    } else if (singlePageIndex >= 0 && sections[singlePageIndex]) {
      const pageNum = cover.enabled ? singlePageIndex + 2 : singlePageIndex + 1;
      targets.push({
        elementId: `export-page-${singlePageIndex}`,
        fallbackId: `menu-page-${singlePageIndex}`,
        label: `${sections[singlePageIndex].name} (Pág. ${pageNum})`,
        docPageNumber: pageNum
      });
    }
  } else {
    // Filter by odd / even / all
    if (pageFilter === 'odd') {
      targets = allTargets.filter(t => t.docPageNumber % 2 !== 0);
    } else if (pageFilter === 'even') {
      targets = allTargets.filter(t => t.docPageNumber % 2 === 0);
    } else {
      targets = allTargets;
    }
  }

  if (targets.length === 0) {
    const filterDesc = pageFilter === 'odd' ? 'impares' : pageFilter === 'even' ? 'pares' : '';
    throw new Error(`No hay páginas ${filterDesc} disponibles para exportar`);
  }

  // Helper function to wait for all images in an element to load
  const waitForImagesToLoad = async (elem: HTMLElement): Promise<void> => {
    const images = Array.from(elem.querySelectorAll('img'));

    if (images.length === 0) {
      return;
    }

    console.debug(`Waiting for ${images.length} images to load...`);

    // Force lazy-loaded images to load immediately
    images.forEach((img) => {
      if (img.loading === 'lazy') {
        img.loading = 'eager';
      }
    });

    const imagePromises = images.map((img, idx) => {
      // Already loaded successfully
      if (img.complete && img.naturalWidth > 0) {
        console.debug(`Image ${idx + 1} already loaded:`, img.src.substring(0, 60));
        return Promise.resolve();
      }

      // Image failed previously
      if (img.complete && img.naturalWidth === 0) {
        console.warn(`Image ${idx + 1} failed to load:`, img.src.substring(0, 60));
        return Promise.resolve();
      }

      // Wait for image to load
      return new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          console.warn(`Image ${idx + 1} load timeout (8s), continuing:`, img.src.substring(0, 60));
          resolve();
        }, 8000);

        const onLoad = () => {
          clearTimeout(timeout);
          console.debug(`Image ${idx + 1} loaded successfully:`, img.src.substring(0, 60));
          resolve();
        };

        const onError = (e: Event | string) => {
          clearTimeout(timeout);
          console.warn(`Image ${idx + 1} failed to load:`, img.src.substring(0, 60), e);
          resolve(); // Continue anyway
        };

        img.addEventListener('load', onLoad, { once: true });
        img.addEventListener('error', onError, { once: true });

        // Force image to load if it has a src but hasn't started loading
        if (img.src && !img.complete) {
          // Trigger load by creating a new Image object or reassigning src
          const tempImg = new Image();
          tempImg.onload = () => {
            img.src = img.src; // Trigger reload
          };
          tempImg.onerror = () => {
            onError('Preload failed');
          };
          tempImg.src = img.src;
        }
      });
    });

    await Promise.all(imagePromises);

    // Small delay to ensure DOM is fully settled after images load
    await new Promise((resolve) => setTimeout(resolve, 200));

    console.debug(`All images processed, ${images.filter(i => i.naturalWidth > 0).length}/${images.length} loaded successfully`);
  };

  // Iterate and capture each page
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    onProgress?.(i + 1, targets.length, `Generando ${target.label} (${i + 1}/${targets.length})...`);

    // IMPORTANT: Use same capture method as PNG export for consistency
    let elem: HTMLElement | null = null;

    // Use the EXACT same selector as PNG export (handleExportPNG in App.tsx)
    // This ensures PDF matches what user sees in preview
    if (singlePageIndex !== undefined) {
      // Single page mode: capture from active preview (same as PNG export)
      elem = document.querySelector('#active-menu-page .menu-page') as HTMLElement;
      if (elem) {
        console.debug(`✓ Capturing ${target.label} from active page preview (PNG export method)`);
      }
    } else {
      // Multi-page mode: try visible preview first, fallback to export queue
      // 1. Try visible preview (if in "View All" mode)
      if (target.fallbackId) {
        elem = document.getElementById(target.fallbackId);
        if (elem) {
          console.debug(`✓ Capturing ${target.label} from visible preview: #${target.fallbackId}`);
        }
      }

      // 2. Fallback to export queue (always available)
      if (!elem) {
        elem = document.getElementById(target.elementId);
        if (elem) {
          console.debug(`✓ Capturing ${target.label} from export queue: #${target.elementId}`);
        }
      }
    }

    if (!elem) {
      console.error(`✗ Could not find DOM element for ${target.label}, skipping`);
      continue;
    }

    // Wait for all images in this element to load
    await waitForImagesToLoad(elem);

    // Capture using html-to-image with retina quality
    let dataUrl: string;
    try {
      // Suppress console errors during capture (CORS warnings are expected but non-fatal)
      const originalConsoleError = console.error;
      const originalConsoleWarn = console.warn;
      const suppressedErrors: string[] = [];

      console.error = (...args: any[]) => {
        const msg = String(args[0] || '');
        if (msg.includes('cssRules') || msg.includes('CORS') || msg.includes('SecurityError')) {
          suppressedErrors.push(msg);
          return; // Suppress CORS/CSS errors
        }
        originalConsoleError(...args);
      };
      console.warn = (...args: any[]) => {
        const msg = String(args[0] || '');
        if (msg.includes('cssRules') || msg.includes('CORS')) {
          return; // Suppress CORS warnings
        }
        originalConsoleWarn(...args);
      };

      try {
        // Get actual rendered dimensions from the element
        const rect = elem.getBoundingClientRect();
        console.debug(`Element rendered at: ${rect.width}x${rect.height}, capturing at: ${widthPx}x${heightPx}`);

        // Use EXACT same toPng options as PNG export for consistency
        dataUrl = await toPng(elem, {
          pixelRatio: 2.5, // Same as PNG export (handleExportPNG)
          quality: 0.98,
          backgroundColor: target.label.includes('Portada') ? '#141416' : theme.pageBackground,
          // IMPORTANT: Capture at FULL expected dimensions, not zoomed preview size
          // This ensures the image fills the entire PDF page
          width: widthPx,
          height: heightPx
        });
      } finally {
        // Restore console methods
        console.error = originalConsoleError;
        console.warn = originalConsoleWarn;

        if (suppressedErrors.length > 0) {
          console.debug(`Suppressed ${suppressedErrors.length} expected CORS warnings during PDF capture`);
        }
      }
    } catch (error) {
      console.error(`Failed to capture ${target.label}:`, error);
      throw new Error(`Error capturando ${target.label}: ${error instanceof Error ? error.message : String(error)}`);
    }

    // If not the first page, add a new page
    if (i > 0) {
      pdf.addPage([widthMm, heightMm], orientationDoc);
    }

    // Embed full-bleed image with 0 margin
    pdf.addImage(dataUrl, 'PNG', 0, 0, widthMm, heightMm, undefined, 'FAST');
  }

  // Restore export queue to hidden state after all captures complete
  if (exportQueue) {
    exportQueue.style.opacity = originalOpacity || '0';
    exportQueue.style.visibility = originalVisibility || 'hidden';
    console.debug('Export queue restored to hidden state');
  }

  onProgress?.(targets.length, targets.length, 'Compilando archivo PDF digital...');

  const cleanRestaurantName = restaurant.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  let scopeName = isHorizontal ? 'horizontal' : 'completo';
  if (singlePageIndex !== undefined) {
    scopeName = singlePageIndex === -1 ? 'portada' : `pag-${singlePageIndex + 1}`;
  } else if (pageFilter === 'odd') {
    scopeName = isHorizontal ? 'horizontal-tablet1-impares' : 'tablet1-impares';
  } else if (pageFilter === 'even') {
    scopeName = isHorizontal ? 'horizontal-tablet2-pares' : 'tablet2-pares';
  }

  const filename = `${cleanRestaurantName}-menu-${scopeName}-${formatName.toLowerCase()}.pdf`;

  // Download PDF file directly
  pdf.save(filename);

  // Generate blob URL to open directly in a new browser tab as digital PDF
  const blobUrl = pdf.output('bloburl').toString();

  return { blobUrl, filename };
}
