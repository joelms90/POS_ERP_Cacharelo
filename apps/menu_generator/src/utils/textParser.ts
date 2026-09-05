import type { Dish } from '../types/menu';

export interface ParseResult {
  categoryName?: string;
  categorySubtitle?: string;
  dishes: Dish[];
}

/**
 * Parses raw text copied from notes, WhatsApp, Excel, or PDF into structured dishes.
 */
export function parseRawMenuText(rawText: string): ParseResult {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { dishes: [] };
  }

  let categoryName: string | undefined;
  let categorySubtitle: string | undefined;
  let startIndex = 0;

  // Check if first line is a Category Header (all uppercase or starts with # or ends with :)
  const firstLine = lines[0];
  const isHeader =
    (firstLine === firstLine.toUpperCase() && !firstLine.match(/\$\s*\d+/) && firstLine.length < 40) ||
    firstLine.startsWith('#') ||
    firstLine.endsWith(':');

  if (isHeader) {
    categoryName = firstLine.replace(/^[#:\s]+|[#:\s]+$/g, '');
    startIndex = 1;

    // Check if second line might be a subtitle (doesn't contain price and not an all-caps dish name)
    if (lines.length > 1 && !lines[1].match(/\$\s*\d+/) && lines[1].length < 80 && !lines[1].match(/^\d+$/)) {
      // If it looks like a subtitle e.g. "Frescura en cada bocado"
      if (!lines[1].startsWith('-') && !lines[1].startsWith('*')) {
        categorySubtitle = lines[1];
        startIndex = 2;
      }
    }
  }

  const dishes: Dish[] = [];
  const remainingLines = lines.slice(startIndex);

  // Helper to extract price from a line
  const extractPrice = (text: string): { price: number; cleanText: string } | null => {
    // Matches $177, $ 177.00, 177.00, 177 at end or after space
    const match = text.match(/(?:(?:\$|\b)\s*(\d+(?:[.,]\d{2})?)\s*(?:\$|\b)?)$/) || text.match(/\$\s*(\d+(?:[.,]\d{2})?)/);
    if (match) {
      const num = parseFloat(match[1].replace(',', '.'));
      if (!isNaN(num) && num > 0) {
        const clean = text.replace(match[0], '').replace(/[-–—:]\s*$/, '').trim();
        return { price: num, cleanText: clean };
      }
    }
    return null;
  };

  // Strategy A: Check if lines have inline prices e.g. "Croissant jamón y queso  $115"
  let inlinePriceCount = 0;
  for (const line of remainingLines) {
    if (extractPrice(line)) inlinePriceCount++;
  }

  if (inlinePriceCount >= Math.max(1, Math.floor(remainingLines.length * 0.4))) {
    // Process line by line with inline prices
    for (const line of remainingLines) {
      const res = extractPrice(line);
      if (res) {
        let name = res.cleanText.replace(/^[-*•]\s*/, '').trim();
        let desc = '';

        // Check if there is a dash or colon separating name and description
        const sepMatch = name.match(/^([^-:–—]+)[-:–—]\s*(.+)$/);
        if (sepMatch) {
          name = sepMatch[1].trim();
          desc = sepMatch[2].trim();
        }

        if (name) {
          dishes.push({
            id: 'dish-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
            name: name,
            description: desc || undefined,
            price: res.price,
            imageMode: 'circle',
            imageTransform: { scale: 1, x: 0, y: 0, rotation: 0 }
          });
        }
      }
    }
    return { categoryName, categorySubtitle, dishes };
  }

  // Strategy B: Block parsing (Name, Description, Price on subsequent lines)
  // E.g.:
  // CAPRESSE
  // Rodajas de jitomate y queso mozzarella...
  // 177
  let currentName = '';
  let currentDescParts: string[] = [];

  for (let i = 0; i < remainingLines.length; i++) {
    const line = remainingLines[i];
    const priceRes = extractPrice(line);

    // If this line is just a price (or contains the price)
    if (priceRes && (priceRes.cleanText.length === 0 || /^\d+(\.\d{2})?$/.test(line.replace('$', '').trim()))) {
      if (currentName) {
        dishes.push({
          id: 'dish-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
          name: currentName,
          description: currentDescParts.join(' ').trim() || undefined,
          price: priceRes.price,
          imageMode: 'circle',
          imageTransform: { scale: 1, x: 0, y: 0, rotation: 0 }
        });
        currentName = '';
        currentDescParts = [];
      }
    } else if (!currentName) {
      // First line of block is name
      currentName = line.replace(/^[-*•]\s*/, '').trim();
    } else {
      // Subsequent line is part of description
      currentDescParts.push(line);
    }
  }

  // If there's a trailing dish without explicit price
  if (currentName) {
    dishes.push({
      id: 'dish-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      name: currentName,
      description: currentDescParts.join(' ').trim() || undefined,
      price: 0,
      imageMode: 'circle',
      imageTransform: { scale: 1, x: 0, y: 0, rotation: 0 }
    });
  }

  return { categoryName, categorySubtitle, dishes };
}
