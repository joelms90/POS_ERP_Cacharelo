import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  api,
  LogEntryDetail,
  LogIssue,
  LogLevel,
  LogRow,
  LogSource,
  LogSummary,
} from '../services/api';
import { Badge } from '../components/atoms/Badge';
import { Button } from '../components/atoms/Button';
import { Heading } from '../components/atoms/Heading';

const TZ = 'America/Mexico_City';

const todayInMexico = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());

const SOURCE_LABEL: Record<LogSource, string> = {
  pos_flutter: 'POS Flutter',
  admin_web: 'Admin Web',
  sync_api: 'API',
};

const LEVEL_VARIANT: Record<LogLevel, 'error' | 'warning' | 'info' | 'charcoal'> = {
  fatal: 'error',
  error: 'error',
  warn: 'warning',
  info: 'info',
  debug: 'charcoal',
};

const formatTime = (iso: string, withDate = false) => {
  try {
    return new Date(iso).toLocaleString('es-MX', {
      timeZone: TZ,
      hour12: false,
      ...(withDate ? { day: '2-digit', month: 'short' } : {}),
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
};

const selectClass =
  'bg-obsidian text-text-primary px-3 py-2 rounded border border-aged-bronze/20 focus:outline-none focus:border-champagne-gold/60 text-sm';

/** Production diagnostics: errors from POS Flutter, Admin Web and API 5xx, per sucursal. */
export const LogsPage: React.FC = () => {
  const [date, setDate] = useState(todayInMexico);
  const [source, setSource] = useState<LogSource | ''>('');
  const [minLevel, setMinLevel] = useState<LogLevel>('warn');
  const [branchId, setBranchId] = useState('');
  const [summary, setSummary] = useState<LogSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [occurrences, setOccurrences] = useState<Record<string, LogRow[]>>({});
  const [detail, setDetail] = useState<LogEntryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setExpanded(null);
    setOccurrences({});
    try {
      setSummary(await api.getLogSummary({ date, source, minLevel, branchId: branchId || undefined }));
    } catch (err: any) {
      setError(err?.message || 'No se pudo cargar el diagnóstico.');
    } finally {
      setLoading(false);
    }
  }, [date, source, minLevel, branchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = useMemo(() => {
    const totals = summary?.totals ?? [];
    const total = totals.reduce((s, t) => s + t.count, 0);
    const errors = totals.filter((t) => t.level === 'error' || t.level === 'fatal').reduce((s, t) => s + t.count, 0);
    const affected = (summary?.branches ?? []).filter((b) => b.branchId).length;
    return { total, errors, affected, issues: summary?.issues.length ?? 0 };
  }, [summary]);

  const toggleIssue = async (issue: LogIssue) => {
    if (expanded === issue.fingerprint) {
      setExpanded(null);
      return;
    }
    setExpanded(issue.fingerprint);
    if (!occurrences[issue.fingerprint]) {
      try {
        const rows = await api.searchLogs({ fingerprint: issue.fingerprint, date, limit: 50 });
        setOccurrences((prev) => ({ ...prev, [issue.fingerprint]: rows }));
      } catch {
        setOccurrences((prev) => ({ ...prev, [issue.fingerprint]: [] }));
      }
    }
  };

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      setDetail(await api.getLogEntry(id));
    } catch (err: any) {
      alert(`No se pudo abrir el log: ${err?.message ?? err}`);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-6 animate-fade-in text-text-primary">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-aged-bronze/20 pb-4">
        <div>
          <Heading level={2} className="!border-none !pb-0 font-sans tracking-wide">
            Diagnóstico de Producción
          </Heading>
          <p className="text-xs text-text-secondary mt-1">
            Errores del POS (sucursales), de esta consola y del API, agrupados por problema. Zona horaria: Ciudad de México.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void load()} className="flex items-center gap-2">
          <span>Recargar</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end bg-onyx-surface p-4 rounded-lg border border-aged-bronze/20">
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          Día
          <input type="date" value={date} max={todayInMexico()} onChange={(e) => setDate(e.target.value || todayInMexico())} className={selectClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          Origen
          <select value={source} onChange={(e) => setSource(e.target.value as LogSource | '')} className={selectClass}>
            <option value="">Todos</option>
            <option value="pos_flutter">POS Flutter</option>
            <option value="admin_web">Admin Web</option>
            <option value="sync_api">API</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          Nivel mínimo
          <select value={minLevel} onChange={(e) => setMinLevel(e.target.value as LogLevel)} className={selectClass}>
            <option value="warn">Advertencias y errores</option>
            <option value="error">Solo errores</option>
            <option value="debug">Todo</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          Sucursal
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={selectClass}>
            <option value="">Todas</option>
            {(summary?.branches ?? [])
              .filter((b) => b.branchId)
              .map((b) => (
                <option key={b.branchId!} value={b.branchId!}>
                  {b.branchName}
                </option>
              ))}
            {branchId && !summary?.branches.some((b) => b.branchId === branchId) && <option value={branchId}>Sucursal seleccionada</option>}
          </select>
        </label>
      </div>

      {error && <div className="p-4 rounded border border-error-red/30 bg-error-red/10 text-error-red text-sm">{error}</div>}

      {loading ? (
        <div className="text-sm text-text-secondary">Cargando diagnóstico…</div>
      ) : summary && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Eventos', value: kpis.total },
              { label: 'Errores', value: kpis.errors, alert: kpis.errors > 0 },
              { label: 'Problemas distintos', value: kpis.issues },
              { label: 'Sucursales afectadas', value: kpis.affected },
            ].map((k) => (
              <div key={k.label} className="bg-onyx-surface p-4 rounded-lg border border-aged-bronze/20">
                <div className="text-xs text-text-secondary uppercase tracking-wider">{k.label}</div>
                <div className={`text-2xl font-semibold mt-1 tabular-nums ${k.alert ? 'text-error-red' : 'text-champagne-gold'}`}>{k.value}</div>
              </div>
            ))}
          </div>

          {kpis.total === 0 ? (
            <div className="p-8 text-center rounded-lg border border-aged-bronze/20 bg-onyx-surface">
              <div className="text-success-green font-semibold">Sin incidencias registradas</div>
              <div className="text-xs text-text-secondary mt-1">
                No hay eventos para este día y filtros. Las sucursales solo reportan si usan la versión del POS con diagnóstico.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-4 items-start">
              {/* Per-branch */}
              <div className="bg-onyx-surface rounded-lg border border-aged-bronze/20 overflow-hidden">
                <div className="px-4 py-3 text-xs uppercase tracking-wider text-text-secondary border-b border-aged-bronze/20">Por sucursal</div>
                {summary.branches.map((b) => (
                  <button
                    key={b.branchId ?? 'none'}
                    disabled={!b.branchId}
                    onClick={() => b.branchId && setBranchId(branchId === b.branchId ? '' : b.branchId)}
                    className={`w-full flex justify-between items-center px-4 py-2.5 text-sm text-left border-b border-aged-bronze/10 last:border-0 ${
                      branchId && branchId === b.branchId ? 'bg-charcoal-surface text-champagne-gold' : 'hover:bg-charcoal-surface/50'
                    } disabled:cursor-default`}
                  >
                    <span className="truncate">{b.branchName}</span>
                    <span className="tabular-nums text-xs">
                      {b.errors > 0 && <span className="text-error-red mr-2">{b.errors} err</span>}
                      <span className="text-text-secondary">{b.count}</span>
                    </span>
                  </button>
                ))}
              </div>

              {/* Issues */}
              <div className="flex flex-col gap-3 min-w-0">
                {summary.issues.map((issue) => (
                  <div key={`${issue.fingerprint}-${issue.source}`} className="bg-onyx-surface rounded-lg border border-aged-bronze/20 min-w-0">
                    <button onClick={() => void toggleIssue(issue)} className="w-full text-left p-4 flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={LEVEL_VARIANT[issue.level]}>{issue.level}</Badge>
                        <Badge variant="charcoal">{SOURCE_LABEL[issue.source] ?? issue.source}</Badge>
                        <span className="text-sm font-semibold tabular-nums text-champagne-gold">{issue.count}×</span>
                        <span className="text-xs text-text-secondary ml-auto">
                          {formatTime(issue.firstSeen)} → {formatTime(issue.lastSeen)}
                        </span>
                      </div>
                      <div className="text-sm break-words">{issue.message}</div>
                      {issue.route && (
                        <div className="text-xs font-mono text-text-secondary break-all">
                          {issue.httpStatus ?? ''} {issue.route}
                        </div>
                      )}
                      <div className="text-xs text-text-secondary flex flex-wrap gap-x-4 gap-y-1">
                        <span>Sucursales: {issue.branches.join(', ') || '—'}</span>
                        <span>Dispositivos: {issue.devices}</span>
                        <span>Versiones: {issue.appVersions.join(', ') || '—'}</span>
                        {issue.users.length > 0 && <span>Usuarios: {issue.users.join(', ')}</span>}
                      </div>
                    </button>

                    {expanded === issue.fingerprint && (
                      <div className="border-t border-aged-bronze/20 px-4 py-3">
                        {!occurrences[issue.fingerprint] ? (
                          <div className="text-xs text-text-secondary">Cargando ocurrencias…</div>
                        ) : (
                          <div className="flex flex-col divide-y divide-aged-bronze/10">
                            {occurrences[issue.fingerprint].map((row) => (
                              <button
                                key={row.id}
                                onClick={() => void openDetail(row.id)}
                                className="flex flex-wrap gap-x-4 gap-y-1 py-2 text-xs text-left hover:text-champagne-gold"
                              >
                                <span className="tabular-nums">{formatTime(row.occurredAt)}</span>
                                <span>{row.branchName ?? 'sin sucursal'}</span>
                                <span className="text-text-secondary">{row.userName ?? '—'}</span>
                                <span className="text-text-secondary">{row.platform ?? ''} {row.appVersion ?? ''}</span>
                                <span className="ml-auto underline">Ver detalle</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Portal: the page wrapper animates with a transform, which would trap position:fixed. */}
      {(detail || detailLoading) && createPortal(
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div
            className="bg-onyx-surface border border-aged-bronze/30 rounded-lg w-full max-w-3xl max-h-[85vh] overflow-y-auto p-5 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            {detailLoading || !detail ? (
              <div className="text-sm text-text-secondary">Cargando…</div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={LEVEL_VARIANT[detail.level]}>{detail.level}</Badge>
                    <Badge variant="charcoal">{SOURCE_LABEL[detail.source] ?? detail.source}</Badge>
                    <span className="text-xs text-text-secondary">{formatTime(detail.occurred_at, true)}</span>
                  </div>
                  <button onClick={() => setDetail(null)} className="text-text-secondary hover:text-text-primary text-sm">
                    Cerrar
                  </button>
                </div>
                <div className="text-sm break-words">{detail.message}</div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
                  {[
                    ['Sucursal', detail.resolved_branch_name],
                    ['Usuario', detail.user_name && `${detail.user_name}${detail.user_role ? ` (${detail.user_role})` : ''}`],
                    ['Dispositivo', detail.device_id],
                    ['Versión', detail.app_version],
                    ['Plataforma', detail.platform],
                    ['Petición', detail.route && `${detail.http_method ?? ''} ${detail.route} ${detail.http_status ?? ''}`],
                    ['ID', detail.id],
                  ]
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k as string} className="flex gap-2 min-w-0">
                        <dt className="text-text-secondary shrink-0">{k}:</dt>
                        <dd className="break-all">{v}</dd>
                      </div>
                    ))}
                </dl>
                {detail.breadcrumbs && detail.breadcrumbs.length > 0 && (
                  <section>
                    <div className="text-xs uppercase tracking-wider text-text-secondary mb-1">Lo que pasó antes (breadcrumbs)</div>
                    <pre className="text-xs bg-obsidian p-3 rounded border border-aged-bronze/20 whitespace-pre-wrap break-all">{detail.breadcrumbs.join('\n')}</pre>
                  </section>
                )}
                {detail.stack && (
                  <section>
                    <div className="text-xs uppercase tracking-wider text-text-secondary mb-1">Stack trace</div>
                    <pre className="text-xs bg-obsidian p-3 rounded border border-aged-bronze/20 whitespace-pre-wrap break-all">{detail.stack}</pre>
                  </section>
                )}
                {detail.context && (
                  <section>
                    <div className="text-xs uppercase tracking-wider text-text-secondary mb-1">Contexto</div>
                    <pre className="text-xs bg-obsidian p-3 rounded border border-aged-bronze/20 whitespace-pre-wrap break-all">
                      {JSON.stringify(detail.context, null, 2)}
                    </pre>
                  </section>
                )}
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};
