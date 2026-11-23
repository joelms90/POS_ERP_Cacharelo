import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { PosApiClient } from '../client.js';

const text = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
});

const windowParams = {
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Día YYYY-MM-DD (zona America/Mexico_City). Por defecto: hoy.'),
  hours: z.number().positive().max(744).optional().describe('Alternativa a date: últimas N horas.'),
  branchId: z.string().optional().describe('Filtrar por sucursal (branch id).'),
  source: z.enum(['pos_flutter', 'admin_web', 'sync_api']).optional().describe('Origen del log.'),
  minLevel: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).optional().describe('Nivel mínimo (por defecto warn).'),
};

/**
 * Production diagnostics over app_logs: errors from the POS Flutter app,
 * the Admin web (cacharelo-central) and API 5xx, tagged by sucursal.
 * Triage playbook: docs/prod-log-triage.md
 */
export function registerLogsTools(server: McpServer, client: PosApiClient) {
  server.tool(
    'get_error_summary',
    'Resumen de incidencias en producción agrupadas por problema (fingerprint): conteos, sucursales afectadas, versiones, usuarios, mensaje y stack de muestra. Úsalo primero para responder "¿hubo problemas hoy?".',
    windowParams,
    async ({ minLevel, hours, ...rest }) =>
      text(await client.getErrorSummary({ minLevel: minLevel ?? 'warn', hours, ...rest })),
  );

  server.tool(
    'search_logs',
    'Lista entradas individuales de log (más recientes primero). Útil para ver la secuencia de un problema (fingerprint) o buscar texto en mensajes/rutas.',
    {
      ...windowParams,
      q: z.string().optional().describe('Texto a buscar en mensaje o ruta.'),
      fingerprint: z.string().optional().describe('Fingerprint de get_error_summary.'),
      limit: z.number().int().min(1).max(500).optional(),
    },
    async ({ hours, date, ...rest }) =>
      text(await client.searchLogs({ date, hours: date ? undefined : hours ?? 24, ...rest })),
  );

  server.tool(
    'get_log_entry',
    'Entrada completa de log: stack trace, breadcrumbs (últimas acciones/peticiones del dispositivo), contexto HTTP, sucursal, usuario, dispositivo y versión.',
    { id: z.string().describe('ID del log (sampleId de get_error_summary o id de search_logs).') },
    async ({ id }) => text(await client.getLogEntry(id)),
  );
}
