import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

function classifyProduct(name: string): {
  categoryName: string;
  provider: string;
  prefix: string;
} {
  const lower = name.toLowerCase();
  if (lower.startsWith('paste ')) {
    const sweetKeywords = [
      'arroz',
      'cajeta',
      'crema',
      'fresa',
      'manzana',
      'nutella',
      'piña',
      'zarzamora',
    ];
    const isSweet = sweetKeywords.some((k) => lower.includes(k));
    return {
      categoryName: isSweet ? 'Pastes Dulces' : 'Pastes Salados',
      provider: 'Planta',
      prefix: isSweet ? 'PD' : 'PS',
    };
  }
  if (
    lower.includes('americano') ||
    lower.includes('capuccino') ||
    lower.includes('chocolate') ||
    lower.includes('moka')
  ) {
    return {
      categoryName: 'Cafetería',
      provider: 'Aurrera',
      prefix: 'CAF',
    };
  }
  return {
    categoryName: 'Bebidas y Refrescos',
    provider: 'Aurrera',
    prefix: 'BEB',
  };
}

async function generate() {
  const sourceCsv = path.join(
    process.env.HOME || '',
    'Downloads/productos_precios.csv'
  );

  const raw = fs.readFileSync(sourceCsv, 'utf-8');
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const headers = [
    'Código Interno',
    'Nombre del Producto',
    'Categoría',
    'Costo',
    'Precio Venta',
    'Precio Mayoreo',
    'Inv Mínimo',
    'Inv Máximo',
    'Tipo de Artículo',
    'Estrategia de Producción',
    'Unidad de Medida',
    'SKU',
    'Código Barras',
    'Existencia',
    'Proveedor',
  ];

  const dataRows: any[][] = [];
  const objectRows: any[] = [];

  let codeNum = 1;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(',');
    if (parts.length >= 2) {
      const name = parts[0].trim();
      const price = parseFloat(parts[1].trim()).toFixed(2);
      const { categoryName, provider, prefix } = classifyProduct(name);
      const internalCode = String(codeNum).padStart(3, '0');
      const sku = `${prefix}-${String(codeNum).padStart(3, '0')}`;

      const row = [
        internalCode, // Código Interno
        name, // Nombre del Producto
        categoryName, // Categoría
        '0.00', // Costo
        price, // Precio Venta
        '0.00', // Precio Mayoreo
        '10', // Inv Mínimo
        '100', // Inv Máximo
        'finished_good', // Tipo de Artículo
        'none', // Estrategia de Producción
        'piece', // Unidad de Medida
        sku, // SKU
        '', // Código Barras
        '0', // Existencia inicial para probar flujo de compras y requisiciones
        provider, // Proveedor (Planta o Aurrera)
      ];

      dataRows.push(row);

      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        obj[h] = row[idx];
      });
      objectRows.push(obj);

      codeNum++;
    }
  }

  // 1. Generate CSV with BOM
  const formatCell = (val: any) => {
    if (val === null || val === undefined) return '';
    const strVal = String(val).trim().replace(/"/g, '""');
    return `"${strVal}"`;
  };

  const csvContent =
    '\uFEFF' +
    [
      headers.map(formatCell).join(','),
      ...dataRows.map((r) => r.map(formatCell).join(',')),
    ].join('\n');

  const targetCsv = path.join(
    process.env.HOME || '',
    'Downloads/plantilla_productos_empanadas.csv'
  );
  fs.writeFileSync(targetCsv, csvContent, 'utf-8');
  console.log(`Generated CSV: ${targetCsv} (${dataRows.length} productos)`);

  // 2. Generate Excel (.xlsx)
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

  // Set column widths
  ws['!cols'] = [
    { wch: 15 }, // Código Interno
    { wch: 32 }, // Nombre del Producto
    { wch: 22 }, // Categoría
    { wch: 10 }, // Costo
    { wch: 14 }, // Precio Venta
    { wch: 14 }, // Precio Mayoreo
    { wch: 12 }, // Inv Mínimo
    { wch: 12 }, // Inv Máximo
    { wch: 18 }, // Tipo de Artículo
    { wch: 24 }, // Estrategia de Producción
    { wch: 18 }, // Unidad de Medida
    { wch: 14 }, // SKU
    { wch: 16 }, // Código Barras
    { wch: 12 }, // Existencia
    { wch: 16 }, // Proveedor
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Productos');
  const targetXlsx = path.join(
    process.env.HOME || '',
    'Downloads/plantilla_productos_empanadas.xlsx'
  );
  XLSX.writeFile(wb, targetXlsx);
  console.log(`Generated XLSX: ${targetXlsx}`);
}

generate();
