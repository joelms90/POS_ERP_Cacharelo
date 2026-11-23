import React, { useCallback, useEffect, useState } from 'react';
import { Heading } from '../../components/atoms/Heading';
import { Button } from '../../components/atoms/Button';
import { api, AuditLogEntry, SupervisionBranch } from '../../services/api';
import { errorMessage, formatDateTime } from './supervisionUi';

const ENTITY_LABELS: Record<string, string> = {
  cash_shift: 'Corte Z',
  cash_transaction: 'Movimiento de caja',
  cashier_debt: 'Adeudo',
  supervisor_assignment: 'Asignación',
};

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

/** Spec 019 §6: append-only audit trail (who, when, why, before/after). */
export const AuditLogPage: React.FC<{ businessId: string }> = ({ businessId }) => {
  const [branches, setBranches] = useState<SupervisionBranch[]>([]);
  const [branchId, setBranchId] = useState('all');
  const [entityType, setEntityType] = useState('');
  const [from, setFrom] = useState(daysAgo(7));
  const [to, setTo] = useState(today());
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const visible = (await api.getSupervisionBranches()).filter((b) => b.businessId === businessId);
      setBranches(visible);
      const rows = await api.getSupervisionAuditLog({
        branchId: branchId !== 'all' ? branchId : undefined,
        entityType: entityType || undefined,
        from,
        to,
      });
      setEntries(rows.filter((r) => r.businessId === businessId));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [businessId, branchId, entityType, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name ?? '—';

  const exportCsv = () => {
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const header = ['Fecha', 'Sucursal', 'Entidad', 'Acción', 'Nivel', 'Usuario', 'Rol', 'Motivo', 'Antes', 'Después', 'Origen'];
    const rows = entries.map((e) => [
      new Date(e.createdAt).toISOString(),
      branchName(e.branchId),
      ENTITY_LABELS[e.entityType] ?? e.entityType,
      e.action,
      e.approvalLevel ?? '',
      e.actorName ?? '',
      e.actorRole ?? '',
      e.reason ?? '',
      JSON.stringify(e.before ?? ''),
      JSON.stringify(e.after ?? ''),
      e.source,
    ]);
    const csv = [header, ...rows].map((r) => r.map(escape).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = `bitacora-caja-${from}-a-${to}.csv`;
    link.click();
  };

  return (
    <div className="flex flex-col gap-6 min-h-full lg:h-full overflow-y-auto lg:overflow-hidden">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Heading level={2} className="!text-lg sm:!text-2xl">Bitácora de caja</Heading>
          <p className="text-xs text-text-secondary mt-1">Registro inmutable: usuario, fecha, motivo y valores antes/después.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="bg-charcoal border border-aged-bronze/45 rounded px-2 py-1.5 text-xs text-champagne-gold" aria-label="Sucursal">
            <option value="all">Todas mis sucursales</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="bg-charcoal border border-aged-bronze/45 rounded px-2 py-1.5 text-xs text-champagne-gold" aria-label="Entidad">
            <option value="">Todas las entidades</option>
            {Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-charcoal border border-aged-bronze/45 rounded px-2 py-1 text-xs text-text-primary" aria-label="Desde" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-charcoal border border-aged-bronze/45 rounded px-2 py-1 text-xs text-text-primary" aria-label="Hasta" />
          <Button size="sm" variant="secondary" onClick={exportCsv} disabled={!entries.length}>Exportar CSV</Button>
        </div>
      </div>
      {error && <div className="text-error-red text-sm">{error}</div>}
      {loading ? (
        <div className="text-text-secondary text-sm">Cargando…</div>
      ) : (
        <div className="flex flex-col gap-1 lg:overflow-y-auto pr-1">
          {entries.length === 0 && <div className="p-8 text-center text-text-secondary text-sm italic">Sin eventos en el rango.</div>}
          {entries.map((e) => (
            <div key={e.id} className="p-3 rounded border border-aged-bronze/15 bg-charcoal/30 text-xs">
              <button className="w-full text-left flex flex-wrap gap-x-3 gap-y-1" onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                <span className="text-text-primary">{formatDateTime(e.createdAt)}</span>
                <span className="text-champagne-gold">{e.action}</span>
                <span>{ENTITY_LABELS[e.entityType] ?? e.entityType}</span>
                {e.approvalLevel && <span>[{e.approvalLevel.toUpperCase()}]</span>}
                <span>{e.actorName ?? 'Sistema'}{e.actorRole ? ` (${e.actorRole})` : ''}</span>
                <span className="text-text-secondary">{branchName(e.branchId)}</span>
                {e.reason && <span className="text-text-secondary">— “{e.reason}”</span>}
              </button>
              {expanded === e.id && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                  <pre className="bg-obsidian p-2 rounded overflow-x-auto text-[10px] text-text-secondary">Antes: {JSON.stringify(e.before, null, 2)}</pre>
                  <pre className="bg-obsidian p-2 rounded overflow-x-auto text-[10px] text-text-secondary">Después: {JSON.stringify(e.after, null, 2)}</pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
