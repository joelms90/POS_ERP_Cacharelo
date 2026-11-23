import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Heading } from '../../components/atoms/Heading';
import { Button } from '../../components/atoms/Button';
import { Badge } from '../../components/atoms/Badge';
import {
  api,
  ApprovalCorteItem,
  ApprovalMovementItem,
  CASH_CATEGORY_LABELS,
  LedgerMovement,
  MovementImpact,
  SupervisionBranch,
} from '../../services/api';
import {
  ConfirmActionDialog,
  differenceClass,
  errorMessage,
  formatCurrency,
  formatDateTime,
  Modal,
  MovementBadge,
  ReviewBadge,
} from './supervisionUi';
import { ShiftReviewPanel } from './ShiftReviewPanel';

type View = 'cortes' | 'movements';
type StatusFilter = 'pending' | 'final';

const FINAL_STATUSES = 'aprobado,aprobado_con_ajuste';

/**
 * Spec 019 — approvals inbox for the owner and branch supervisors (D-10).
 * Every rule is enforced by the API; the page shows what the user can do.
 */
export const ApprovalsPage: React.FC = () => {
  const [view, setView] = useState<View>('cortes');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [branches, setBranches] = useState<SupervisionBranch[]>([]);
  const [branchId, setBranchId] = useState<string>('all');
  const [cortes, setCortes] = useState<ApprovalCorteItem[]>([]);
  const [movements, setMovements] = useState<ApprovalMovementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [movementAction, setMovementAction] = useState<{ item: ApprovalMovementItem | LedgerMovement; version: number; branchName?: string; action: 'approve' | 'reject' | 'cancel' | 'adjust' } | null>(null);

  const branchIds = useMemo(() => new Set(branches.map((b) => b.id)), [branches]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [visible, inbox] = await Promise.all([
        api.getSupervisionBranches(),
        api.getApprovals({
          status: statusFilter === 'final' ? FINAL_STATUSES : undefined,
          branchId: branchId !== 'all' ? branchId : undefined,
        }),
      ]);
      const ids = new Set(visible.map((b) => b.id));
      setBranches(visible);
      setCortes(inbox.cortes.filter((c) => ids.has(c.branchId)));
      setMovements(statusFilter === 'final' ? [] : inbox.movements.filter((m) => ids.has(m.branchId)));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [branchId, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (branchId !== 'all' && branches.length && !branchIds.has(branchId)) setBranchId('all');
  }, [branches, branchId, branchIds]);

  const actionableCortes = cortes.filter((c) => c.canAct).length;
  const actionableMovements = movements.filter((m) => m.canAct || m.canCorrect).length;

  return (
    <div className="flex flex-col gap-6 min-h-full lg:h-full overflow-y-auto lg:overflow-hidden">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Heading level={2} className="!text-lg sm:!text-2xl">Aprobaciones de caja</Heading>
          <p className="text-xs text-text-secondary mt-1">
            Cortes Z con una sola aprobación (operador de sucursal, supervisor u owner) e ingresos/egresos de caja.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="bg-charcoal border border-aged-bronze/45 rounded px-2 py-1.5 text-xs text-champagne-gold"
            aria-label="Sucursal"
          >
            <option value="all">Todas mis sucursales</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="bg-charcoal border border-aged-bronze/45 rounded px-2 py-1.5 text-xs text-champagne-gold"
            aria-label="Estado"
          >
            <option value="pending">Pendientes y rechazados</option>
            <option value="final">Aprobados</option>
          </select>
          <Button variant="secondary" size="sm" onClick={load} disabled={loading}>Actualizar</Button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-aged-bronze/30">
        {([
          ['cortes', `Cortes Z (${actionableCortes} por resolver)`],
          ['movements', `Ingresos / egresos (${actionableMovements})`],
        ] as Array<[View, string]>).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`px-3 py-2 text-xs border-b-2 -mb-px transition-colors ${
              view === key ? 'border-champagne-gold text-champagne-gold' : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="p-3 rounded border border-error-red/40 bg-error-red/10 text-error-red text-sm">{error}</div>}
      {loading && <div className="text-text-secondary text-sm">Cargando…</div>}

      {!loading && view === 'cortes' && (
        <div className="flex flex-col gap-2 lg:overflow-y-auto pr-1">
          {cortes.length === 0 && <div className="p-8 text-center text-text-secondary text-sm italic">No hay cortes en este filtro.</div>}
          {cortes.map((corte) => (
            <button
              key={corte.id}
              onClick={() => setSelectedShiftId(corte.id)}
              className="text-left p-4 rounded-lg border border-aged-bronze/20 bg-charcoal/50 hover:border-champagne-gold/50 transition-colors flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-text-primary text-sm">{corte.branchName}</span>
                  <ReviewBadge status={corte.reviewStatus} />
                  {corte.canAct && <Badge variant="gold">Te toca</Badge>}
                  {corte.openBlocking && <Badge variant="error">Bloquea apertura</Badge>}
                  {corte.closedOffline && <Badge variant="charcoal">Cerrado sin conexión</Badge>}
                  {corte.recountCount > 0 && <Badge variant="bronze">{corte.recountCount} reconteo(s)</Badge>}
                </div>
                <span className="text-xs text-text-secondary">
                  {corte.cashierName ?? 'Cajero'} · cierre {formatDateTime(corte.closedAt)}
                  {corte.n1ResolverRole === 'branch_supervisor' ? ' · cerrado por el operador (N1 = supervisor)' : ''}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-text-secondary">Contado <strong className="text-text-primary font-mono">{formatCurrency(corte.counted)}</strong></span>
                <span className="text-text-secondary">
                  Diferencia al cierre{' '}
                  <strong className={`font-mono ${differenceClass(corte.cashDifference)}`}>{formatCurrency(corte.cashDifference)}</strong>
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {!loading && view === 'movements' && (
        <div className="flex flex-col gap-2 lg:overflow-y-auto pr-1">
          {movements.length === 0 && <div className="p-8 text-center text-text-secondary text-sm italic">No hay movimientos pendientes.</div>}
          {movements.map((mv) => (
            <div key={mv.id} className="p-4 rounded-lg border border-aged-bronze/20 bg-charcoal/50 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`font-mono font-semibold ${mv.type === 'cash-in' ? 'text-success-green' : 'text-error-red'}`}>
                    {mv.type === 'cash-in' ? '+' : '−'}{formatCurrency(mv.amount)}
                  </span>
                  <span className="text-sm text-text-primary">{mv.category ? CASH_CATEGORY_LABELS[mv.category] ?? mv.category : 'Sin categoría'}</span>
                  <MovementBadge status={mv.approvalStatus} />
                  {mv.n1ResolverRole === 'branch_supervisor' && <Badge variant="bronze">Registrado por el operador</Badge>}
                </div>
                <span className="text-xs text-text-secondary">
                  {mv.branchName} · {mv.authorName ?? 'Operador'} · {formatDateTime(mv.createdAt)} · {mv.reason}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {mv.canAct && (
                  <>
                    <Button size="sm" onClick={() => setMovementAction({ item: mv, version: mv.version, action: 'approve' })}>Aprobar</Button>
                    <Button size="sm" variant="danger" onClick={() => setMovementAction({ item: mv, version: mv.version, action: 'reject' })}>Rechazar</Button>
                  </>
                )}
                {mv.canCorrect && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => setMovementAction({ item: mv, version: mv.version, action: 'adjust' })}>Ajustar</Button>
                    <Button size="sm" variant="secondary" onClick={() => setMovementAction({ item: mv, version: mv.version, action: 'cancel' })}>Cancelar</Button>
                  </>
                )}
                <Button size="sm" variant="secondary" onClick={() => setSelectedShiftId(mv.shiftId)}>Ver turno</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedShiftId && (
        <Modal title="Revisión de Corte Z" onClose={() => setSelectedShiftId(null)} wide>
          <ShiftReviewPanel
            shiftId={selectedShiftId}
            onChanged={load}
            onMovementAction={(movement, action) => setMovementAction({ item: movement, version: movement.version, action })}
          />
        </Modal>
      )}

      {movementAction && (
        <MovementActionDialog
          target={movementAction}
          onClose={() => setMovementAction(null)}
          onDone={() => {
            setMovementAction(null);
            load();
          }}
        />
      )}
    </div>
  );
};

/** Approve/reject/cancel/adjust a cash movement, with the impact shown before confirming (R-16). */
export const MovementActionDialog: React.FC<{
  target: { item: ApprovalMovementItem | LedgerMovement; version: number; action: 'approve' | 'reject' | 'cancel' | 'adjust' };
  onClose: () => void;
  onDone: () => void;
}> = ({ target, onClose, onDone }) => {
  const { item, action } = target;
  const [amount, setAmount] = useState<string>(String(item.amount));
  const [impact, setImpact] = useState<MovementImpact | null>(null);
  const [impactLoading, setImpactLoading] = useState(action !== 'approve');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const version = target.version;

  useEffect(() => {
    if (action === 'approve') return;
    let cancelled = false;
    setImpactLoading(true);
    const timer = setTimeout(() => {
      api
        .getMovementImpact(item.id, action, action === 'adjust' && Number.parseFloat(amount) > 0 ? amount : undefined)
        .then((res) => !cancelled && setImpact(res))
        .catch((err) => !cancelled && setError(errorMessage(err)))
        .finally(() => !cancelled && setImpactLoading(false));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [item.id, action, amount]);

  const titles = {
    approve: 'Aprobar movimiento',
    reject: 'Rechazar movimiento',
    cancel: 'Cancelar movimiento (asiento de reverso)',
    adjust: 'Ajustar monto (reverso + nuevo asiento)',
  } as const;

  const describe = (
    <div className="flex flex-col gap-1">
      <span>
        {item.type === 'cash-in' ? 'Ingreso' : 'Egreso'} de <strong>{formatCurrency(item.amount)}</strong>
        {item.category ? ` · ${CASH_CATEGORY_LABELS[item.category] ?? item.category}` : ''} — {item.reason}
      </span>
      {action === 'approve' && <span className="text-text-secondary">El movimiento ya cuenta en caja; aprobarlo lo valida. Es la aprobación final.</span>}
      {action !== 'approve' && impact && (
        <>
          <span className="text-text-secondary">
            Nada se borra: se registrará un asiento compensatorio en el ledger de caja.
          </span>
          <span>{impact.message}</span>
          {impact.resultingDifference !== null && impact.resultingDifference < 0 && (
            <span className="text-error-red">
              Si el Corte Z se aprueba así, habrá un faltante de {formatCurrency(-impact.resultingDifference)} que se registrará como adeudo del cajero.
            </span>
          )}
        </>
      )}
    </div>
  );

  const confirm = async (reason: string) => {
    setBusy(true);
    setError(null);
    try {
      if (action === 'approve') await api.approveMovement(item.id, { version, reason: reason || undefined });
      if (action === 'reject') await api.rejectMovement(item.id, { version, reason });
      if (action === 'cancel') await api.cancelMovement(item.id, { version, reason });
      if (action === 'adjust') await api.adjustMovement(item.id, { version, reason, amount });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConfirmActionDialog
      title={titles[action]}
      impact={describe}
      impactLoading={impactLoading && action !== 'approve'}
      reasonRequired={action !== 'approve'}
      amountLabel={action === 'adjust' ? 'Monto correcto' : undefined}
      amount={amount}
      onAmountChange={setAmount}
      confirmLabel={titles[action].split(' (')[0]}
      confirmVariant={action === 'approve' ? 'primary' : 'danger'}
      busy={busy}
      error={error}
      onConfirm={confirm}
      onClose={onClose}
    />
  );
};

