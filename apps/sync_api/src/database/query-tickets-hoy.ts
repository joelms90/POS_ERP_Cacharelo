import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Query Tickets Cobrados Hoy
 *
 * Outputs to console AND writes a file:
 *   - Text report:  data/tickets-hoy-{branch}-{date}.txt
 *   - CSV rows:     data/tickets-hoy-{branch}-{date}.csv
 *
 * Usage:
 *   npx ts-node src/database/query-tickets-hoy.ts <branchUuid> [outputDir]
 *
 *   Or via Makefile:
 *   make db-tickets-hoy BRANCH=c4f07384-d113-4a0e-a555-e5b12824bf04
 *   make db-tickets-hoy-prod BRANCH=c4f07384-d113-4a0e-a555-e5b12824bf04
 */

const DEFAULT_BRANCH = 'c4f07384-d113-4a0e-a555-e5b12824bf04'; // Sucursal Empanadas
const DEFAULT_OUTPUT_DIR = path.resolve(__dirname, '..', '..', 'data');

function padRight(text: string, width: number): string {
  if (text.length >= width) return text.substring(0, width);
  return text + ' '.repeat(width - text.length);
}

function padLeft(text: string, width: number): string {
  if (text.length >= width) return text.substring(0, width);
  return ' '.repeat(width - text.length) + text;
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function queryTicketsHoy(branchId: string, outputDir: string) {
  const connectionString =
    process.env.DATABASE_URL ||
    'postgres://pos_user:pos_password@localhost:5432/pos_dev';

  const pool = new Pool({ connectionString, max: 2 });

  try {
    const { rows: branchRows } = await pool.query(
      'SELECT name FROM branches WHERE id = $1',
      [branchId],
    );
    const branchName =
      branchRows.length > 0 ? branchRows[0].name : 'Sucursal Desconocida';

    const today = new Date();
    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const dateStr = todayStart.toISOString().substring(0, 10);

    const query = `
      SELECT
        o.id AS order_id,
        o.created_at,
        o.total AS order_total,
        o.discount,
        o.subtotal,
        o.tax,
        o.state,
        bt.label AS table_label,
        u.name AS waiter_name,
        COALESCE(
          (SELECT string_agg(p.payment_method || ' $' || p.amount::numeric(10,2)::text, ' | ')
           FROM payments p WHERE p.order_id = o.id),
          '—'
        ) AS payment_details,
        COALESCE(
          (SELECT SUM(p.amount) FROM payments p WHERE p.order_id = o.id),
          0
        ) AS total_paid,
        COALESCE(
          (SELECT string_agg(oi.quantity || 'x ' || pr.name, E'\n')
           FROM order_items oi
           JOIN products pr ON pr.id = oi.product_id
           WHERE oi.order_id = o.id),
          '—'
        ) AS items
      FROM orders o
      JOIN branch_tables bt ON bt.id = o.table_id
      JOIN users u ON u.id = o.waiter_id
      WHERE o.branch_id = $1
        AND o.state = 'closed'
        AND o.created_at >= $2
        AND o.created_at < $3
        AND o.deleted_at IS NULL
      ORDER BY o.created_at ASC
    `;

    const { rows } = await pool.query(query, [
      branchId,
      todayStart.toISOString(),
      todayEnd.toISOString(),
    ]);

    const branchSlug = slug(branchName);
    const txtFile = path.join(outputDir, `tickets-hoy-${branchSlug}-${dateStr}.txt`);
    const csvFile = path.join(outputDir, `tickets-hoy-${branchSlug}-${dateStr}.csv`);

    fs.mkdirSync(outputDir, { recursive: true });

    const out = fs.createWriteStream(txtFile, 'utf8');
    const w = (line: string = '') => { console.log(line); out.write(line + '\n'); };

    w();
    w('═══════════════════════════════════════════════════════════════');
    w(`  TICKETS COBRADOS — ${branchName}`);
    w(`  Fecha: ${dateStr}`);
    w(`  Total: ${rows.length} ticket(s) cobrado(s)`);
    w('═══════════════════════════════════════════════════════════════');
    w();

    if (rows.length === 0) {
      w('  No hay tickets cobrados hoy.');
      w();
      out.end();
      return;
    }

    // Summary table
    w(`  ${padRight('#', 4)} ${padRight('Hora', 10)} ${padRight('Mesa', 14)} ${padRight('Mesero', 18)} ${padRight('Total', 10)} Pago`);
    w(`  ${'─'.repeat(80)}`);

    let grandTotal = 0;
    let cashTotal = 0;
    let cardTotal = 0;
    let otherTotal = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const orderTotal = parseFloat(row.order_total || '0');
      const totalPaid = parseFloat(row.total_paid || '0');
      grandTotal += totalPaid;
      const paymentDetails: string = row.payment_details || '—';
      if (paymentDetails.toLowerCase().includes('cash')) cashTotal += totalPaid;
      else if (paymentDetails.toLowerCase().includes('card')) cardTotal += totalPaid;
      else otherTotal += totalPaid;

      const hora = row.created_at
        ? new Date(row.created_at).toLocaleTimeString('es-MX', {
            hour: '2-digit', minute: '2-digit',
            timeZone: 'America/Mexico_City',
          })
        : '—';

      w(`  ${padRight(`#${i + 1}`, 4)} ${padRight(hora, 10)} ${padRight(row.table_label || '—', 14)} ${padRight(row.waiter_name || '—', 18)} $${padLeft(orderTotal.toFixed(2), 8)}  ${paymentDetails}`);
    }

    w();
    w('  ───────────────────────────────────────────────────────────────');
    w(`  TOTAL COBRADO:                            $${padLeft(grandTotal.toFixed(2), 10)}`);
    w(`    Efectivo:  $${padLeft(cashTotal.toFixed(2), 10)}`);
    w(`    Tarjeta:   $${padLeft(cardTotal.toFixed(2), 10)}`);
    w(`    Otro:      $${padLeft(otherTotal.toFixed(2), 10)}`);
    w('  ═══════════════════════════════════════════════════════════════');
    w();

    // Detailed breakdown
    w('═══════════════════════════════════════════════════════════════');
    w('  DESGLOSE POR TICKET');
    w('═══════════════════════════════════════════════════════════════');
    w();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const hora = row.created_at
        ? new Date(row.created_at).toLocaleTimeString('es-MX', {
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            timeZone: 'America/Mexico_City',
          })
        : '—';

      w(`  Ticket #${i + 1}  [${(row.order_id as string).substring(0, 8)}…] ${hora}`);
      w(`  Mesa: ${row.table_label}   Mesero: ${row.waiter_name}`);
      w(`  Estado: ${row.state}`);
      w(`  Subtotal: $${parseFloat(row.subtotal || '0').toFixed(2)}  Descuento: $${parseFloat(row.discount || '0').toFixed(2)}  IVA: $${parseFloat(row.tax || '0').toFixed(2)}`);
      w(`  Total: $${parseFloat(row.order_total || '0').toFixed(2)}`);
      w(`  Cobro:  ${row.payment_details}`);
      w('  Productos:');
      const items: string = row.items || '—';
      for (const item of items.split('\n')) {
        w(`    - ${item.trim()}`);
      }
      w();
    }

    w();
    w(`  Report saved to: ${txtFile}`);
    w();

    out.end();

    // --- CSV export ---
    const csvHeaders = [
      'Num', 'Hora', 'Mesa', 'Mesero', 'Estado', 'Subtotal', 'Descuento',
      'IVA', 'Total', 'Metodo Pago', 'Total Pagado', 'Productos'
    ];
    const csvOut = fs.createWriteStream(csvFile, 'utf8');
    csvOut.write(csvHeaders.join(',') + '\n');

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const hora = row.created_at ? new Date(row.created_at).toISOString() : '';
      const itemsFlat = (row.items || '—').replace(/\n/g, ' | ');
      csvOut.write(
        [
          i + 1,
          hora,
          JSON.stringify(row.table_label || ''),
          JSON.stringify(row.waiter_name || ''),
          row.state,
          parseFloat(row.subtotal || '0'),
          parseFloat(row.discount || '0'),
          parseFloat(row.tax || '0'),
          parseFloat(row.order_total || '0'),
          JSON.stringify(row.payment_details || ''),
          parseFloat(row.total_paid || '0'),
          JSON.stringify(itemsFlat),
        ].join(',') + '\n',
      );
    }
    csvOut.end();

    console.log(`\n  CSV saved to: ${csvFile}\n`);

  } catch (err) {
    console.error('Error querying tickets:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

const branchId = process.argv[2] || DEFAULT_BRANCH;
const outputDir = process.argv[3] || DEFAULT_OUTPUT_DIR;
queryTicketsHoy(branchId, outputDir);
