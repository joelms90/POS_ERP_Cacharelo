import React, { useCallback, useEffect, useState } from 'react';
import { Heading } from '../../components/atoms/Heading';
import { Button } from '../../components/atoms/Button';
import { Badge } from '../../components/atoms/Badge';
import { api, CashierDebt, SupervisionBranch } from '../../services/api';
import { errorMessage, formatCurrency, formatDateTime } from './supervisionUi';

/** Spec 019 D-8 / P-1: cashier debts from approved shortages — recorded and audited only. */
export const DebtsPage: React.FC<{ businessId: string }> = ({ businessId }) => {
  const [branches, setBranches] = useState<SupervisionBranch[]>([]);
  const [branchId, setBranchId] = useState('all');
  const [status, setStatus] = useState<'vigente' | 'anulado' | ''>('vigente');
  const [debts, setDebts] = useState<CashierDebt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const visible = (await api.getSupervisionBranches()).filter((b) => b.businessId === businessId);
      setBranches(visible);
      const ids = new Set(visible.map((b) => b.id));
      const rows = await api.getCashierDebts({ branchId: branchId !== 'all' ? branchId : undefined, status: status || undefined });
      setDebts(rows.filter((d) => ids.has(d.branchId)));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [businessId, branchId, status]);

  useEffect(() => {
    load();
  }, [load]);

  const total = debts.filter((d) => d.status === 'vigente').reduce((sum, d) => sum + Number(d.amount), 0);

  return (
    <div className="flex flex-col gap-6 min-h-full lg:h-full overflow-y-auto lg:overflow-hidden">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Heading level={2} className="!text-lg sm:!text-2xl">Adeudos de cajeros</Heading>
          <p className="text-xs text-text-secondary mt-1">Faltantes de Cortes Z aprobados. Solo se registran y auditan; el cobro no se gestiona aquí.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="bg-charcoal border border-aged-bronze/45 rounded px-2 py-1.5 text-xs text-champagne-gold" aria-label="Sucursal">
            <option value="all">Todas mis sucursales</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="bg-charcoal border border-aged-bronze/45 rounded px-2 py-1.5 text-xs text-champagne-gold" aria-label="Estado">
            <option value="vigente">Vigentes</option>
            <option value="anulado">Anulados</option>
            <option value="">Todos</option>
          </select>
          <Button size="sm" variant="secondary" onClick={load} disabled={loading}>Actualizar</Button>
        </div>
      </div>
      {error && <div className="text-error-red text-sm">{error}</div>}
      <div className="text-sm text-text-secondary">Total vigente: <strong className="text-error-red font-mono">{formatCurrency(total)}</strong></div>
      {loading ? (
        <div className="text-text-secondary text-sm">Cargando…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-text-secondary border-b border-aged-bronze/30">
                <th className="py-2 pr-3">Cajero</th>
                <th className="py-2 pr-3">Sucursal</th>
                <th className="py-2 pr-3 text-right">Monto</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Generado</th>
              </tr>
            </thead>
            <tbody>
              {debts.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-text-secondary italic">Sin adeudos.</td></tr>
              )}
              {debts.map((d) => (
                <tr key={d.id} className="border-b border-aged-bronze/10">
                  <td className="py-2 pr-3 text-text-primary">{d.cashierName}</td>
                  <td className="py-2 pr-3">{d.branchName}</td>
                  <td className="py-2 pr-3 text-right font-mono text-error-red">{formatCurrency(d.amount)}</td>
                  <td className="py-2 pr-3"><Badge variant={d.status === 'vigente' ? 'error' : 'charcoal'}>{d.status}</Badge></td>
                  <td className="py-2 pr-3">{formatDateTime(d.generatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
