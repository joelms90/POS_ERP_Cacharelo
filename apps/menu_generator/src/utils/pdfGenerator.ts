import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
import type { MenuCatalog } from '../types/menu';

export interface GeneratePdfOptions {
  catalog: MenuCatalog;
  singlePageIndex?: number; // -1 for cover, 0+ for section, undefined for ALL pages
  targetFormat?: 'letter' | 'a4'; // Override catalog.theme.pageSize
  onProgress?: (current: number, total: number, message: string) => void;
}

export interface PdfResult {
  blobUrl: string;
  filename: string;
}

/**
 * Direct High-Resolution Digital PDF Generator
 * Eliminates browser print dialog (window.print), capturing pages at native 2x retina
 * resolution and embedding into a digital PDF with exact physical dimensions (Carta / A4).
 */
export async function generateDigitalPdf({
  catalog,
  singlePageIndex,
  targetFormat,
  onProgress
}: GeneratePdfOptions): Promise<PdfResult> {
  const { theme, cover, sections, restaurant } = catalog;
  const activePageSize = targetFormat || theme.pageSize || 'letter';
  const isA4 = activePageSize === 'a4';

  // Exact physical millimeter dimensions
  // Carta / Letter: 21.6 × 27.9 cm (215.9 mm × 279.4 mm / 8.5 × 11 in)
  // A4: 21.0 × 29.7 cm (210.0 mm × 297.0 mm)
  const widthMm = isA4 ? 210.0 : 215.9;
  const heightMm = isA4 ? 297.0 : 279.4;
  const widthPx = isA4 ? 794 : 816;
  const heightPx = isA4 ? 1123 : 1056;
  const formatName = isA4 ? 'A4' : 'Carta';

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
    orientation: 'portrait',
    unit: 'mm',
    format: [widthMm, heightMm],
    compress: true
  });

  // Determine list of page IDs to export
  interface PageExportTarget {
    elementId: string;
    fallbackId?: string;
    label: string;
  }

  const targets: PageExportTarget[] = [];

  if (singlePageIndex !== undefined) {
    if (singlePageIndex === -1 && cover.enabled) {
      targets.push({
        elementId: 'export-page-cover',
        fallbackId: 'menu-page-cover',
        label: 'Portada'
      });
    } else if (singlePageIndex >= 0 && sections[singlePageIndex]) {
      targets.push({
        elementId: `export-page-${singlePageIndex}`,
        fallbackId: `menu-page-${singlePageIndex}`,
        label: sections[singlePageIndex].name
      });
    }
  } else {
    // Export All Pages
    if (cover.enabled) {
      targets.push({
        elementId: 'export-page-cover',
        fallbackId: 'menu-page-cover',
        label: 'Portada'
      });
    }
    sections.forEach((sec, idx) => {
      targets.push({
        elementId: `export-page-${idx}`,
        fallbackId: `menu-page-${idx}`,
        label: sec.name
      });
    });
  }

  if (targets.length === 0) {
    throw new Error('No hay páginas disponibles para exportar');
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
      backgroundColor: target.label === 'Portada' ? '#141416' : theme.pageBackground,
      skipFonts: false
    });

    // If not the first page, add a new page
    if (i > 0) {
      pdf.addPage([widthMm, heightMm], 'portrait');
    }

    // Embed full-bleed image with 0 margin
    pdf.addImage(dataUrl, 'PNG', 0, 0, widthMm, heightMm, undefined, 'FAST');
  }

  onProgress?.(targets.length, targets.length, 'Compilando archivo PDF digital...');

  const cleanRestaurantName = restaurant.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const scopeName = singlePageIndex !== undefined
    ? (singlePageIndex === -1 ? 'portada' : `pag-${singlePageIndex + 1}`)
    : 'completo';
  const filename = `${cleanRestaurantName}-menu-${scopeName}-${formatName.toLowerCase()}.pdf`;

  // Download PDF file directly
  pdf.save(filename);

  // Generate blob URL to open directly in a new browser tab as digital PDF
  const blobUrl = pdf.output('bloburl').toString();

  return { blobUrl, filename };
}
