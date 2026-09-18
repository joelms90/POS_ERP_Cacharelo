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
    } catch (e) {
      console.warn('Font loading check timed out or failed, continuing', e);
    }
  }

  // Small delay for DOM settling
  await new Promise((resolve) => setTimeout(resolve, 80));

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

  // Iterate and capture each page
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    onProgress?.(i + 1, targets.length, `Generando ${target.label} (${i + 1}/${targets.length})...`);

    // Look for element in offscreen export queue first, then fallback element, then active preview
    let elem = document.getElementById(target.elementId);
    if (!elem && target.fallbackId) {
      elem = document.getElementById(target.fallbackId);
    }
    if (!elem && singlePageIndex !== undefined) {
      elem = (document.querySelector('#active-menu-page .menu-page') ||
             document.querySelector('#active-menu-page')) as HTMLElement;
    }

    if (!elem) {
      console.warn(`Could not find DOM element #${target.elementId} or #${target.fallbackId}, skipping`);
      continue;
    }

    // Capture using html-to-image with retina quality
    const dataUrl = await toPng(elem, {
      pixelRatio: 2.0, // High-DPI crisp vector-like text
      quality: 0.98,
      width: widthPx,
      height: heightPx,
      backgroundColor: target.label.includes('Portada') ? '#141416' : theme.pageBackground,
      skipFonts: false
    });

    // If not the first page, add a new page
    if (i > 0) {
      pdf.addPage([widthMm, heightMm], orientationDoc);
    }

    // Embed full-bleed image with 0 margin
    pdf.addImage(dataUrl, 'PNG', 0, 0, widthMm, heightMm, undefined, 'FAST');
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
