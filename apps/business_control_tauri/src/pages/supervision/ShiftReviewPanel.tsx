import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '../../components/atoms/Button';
import { Badge } from '../../components/atoms/Badge';
import { api, CASH_CATEGORY_LABELS, LedgerMovement, SupervisionShiftDetail } from '../../services/api';
import {
  ConfirmActionDialog,
  differenceClass,
  errorMessage,
  formatCurrency,
  formatDateTime,
  MovementBadge,
  ReconciliationBadge,
  ReviewBadge,
} from './supervisionUi';

type ShiftAction = 'approve' | 'reject' | 'adjust' | 'reopen' | 'unblock';

const ACTION_LABELS: Record<string, string> = {
  corte_z_cerrado: 'Corte Z cerrado',
  corte_z_aprobado: 'Aprobado',
  corte_z_rechazado: 'Rechazado',
  corte_z_reconteo: 'Reconteo',
  corte_z_ajustado: 'Aprobado con ajuste',
  corte_z_reabierto: 'Reabierto',
  apertura_bloqueada: 'Apertura bloqueada',
  apertura_desbloqueada: 'Apertura desbloqueada',
};

const Figure: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({ label, value, hint }) => (
  <div className="flex flex-col gap-0.5 p-3 rounded border border-aged-bronze/20 bg-charcoal/40">
    <span className="text-[10px] uppercase tracking-widest text-text-secondary">{label}</span>
    <span className="font-mono text-sm text-text-primary">{value}</span>
    {hint && <span className="text-[10px] text-text-secondary">{hint}</span>}
  </div>
);

/** Corte Z review: expected at close + post-close adjustments = adjusted expected (spec 019 §4.4.3). */
export const ShiftReviewPanel: React.FC<{
  shiftId: string;
  onChanged: () => void;
  onMovementAction: (movement: LedgerMovement, action: 'cancel' | 'adjust') => void;
}> = ({ shiftId, onChanged, onMovementAction }) => {
  const [detail, setDetail] = useState<SupervisionShiftDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<ShiftAction | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSupervisionShiftDetail(shiftId);
      setDetail(data);
      setAdjustAmount(String(data.figures.counted));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [shiftId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className="text-text-secondary text-sm">Cargando corte…</div>;
  if (error || !detail) return <div className="text-error-red text-sm">{error ?? 'No se pudo cargar el corte.'}</div>;

  const { shift, figures, permissions, report, history } = detail;
  const movements = report.cashMovements;
  const originals = movements.filter((m) => m.entryKind === 'movimiento');
  const childrenOf = (id: string) => movements.filter((m) => m.reversesTransactionId === id || m.replacesTransactionId === id);
  const level = permissions.level;
  const adjustedDiff = figures.adjustedDifference ?? 0;
  const adjustPreview = Number.parseFloat(adjustAmount);
  const adjustDiff = Number.isFinite(adjustPreview) ? Math.round((adjustPreview - figures.adjustedExpected) * 100) / 100 : null;

  const runAction = async (reason: string) => {
    if (!action) return;
    setBusy(true);
    setActionError(null);
    try {
      if (action === 'approve') await api.approveShift(shift.id, { version: shift.version, reason: reason || undefined });
      if (action === 'reject') await api.rejectShift(shift.id, { version: shift.version, reason });
      if (action === 'adjust') await api.adjustShift(shift.id, { version: shift.version, reason, approvedAmount: adjustAmount });
      if (action === 'reopen') await api.reopenShift(shift.id, reason);
      if (action === 'unblock') await api.overrideOpenBlock(shift.id, reason);
      setAction(null);
      await load();
      onChanged();
    } catch (err) {
      setActionError(errorMessage(err));
      // A 409 means someone else acted first: refresh to show the current state.
      if (/modific|recarga/i.test(errorMessage(err))) await load();
    } finally {
      setBusy(false);
    }
  };

  const impactFor = (kind: ShiftAction): React.ReactNode => {
    switch (kind) {
      case 'approve':
        return level === 'n1' ? (
          <span>El Corte Z pasará a <strong>nivel 2</strong> (supervisor u owner). Si bloqueaba la apertura de caja, la sucursal podrá abrir el siguiente turno.</span>
        ) : (
          <div className="flex flex-col gap-1">
            <span>Aprobación final. Las cifras quedan congeladas como oficiales.</span>
            <span>Diferencia final: <strong className={differenceClass(adjustedDiff)}>{formatCurrency(adjustedDiff)}</strong></span>
            {adjustedDiff < 0 && <span className="text-error-red">Se registrará un adeudo de {formatCurrency(-adjustedDiff)} a nombre del cajero.</span>}
          </div>
        );
      case 'reject':
        return level === 'n1' ? (
          <span>Quien hizo el Corte Z deberá <strong>recontar</strong>; el reconteo vuelve al nivel 1. La apertura del siguiente turno sigue bloqueada mientras tanto.</span>
        ) : (
          <span>El cajero u operador deberá registrar un <strong>nuevo conteo</strong>, que regresa directo al nivel 2. El turno no se reabre.</span>
        );
      case 'adjust':
        return (
          <div className="flex flex-col gap-1">
            <span>Esperado ajustado: {formatCurrency(figures.adjustedExpected)} · contado original: {formatCurrency(figures.counted)}</span>
            {adjustDiff !== null && (
              <span>
                Diferencia final con el monto aceptado: <strong className={differenceClass(adjustDiff)}>{formatCurrency(adjustDiff)}</strong>
              </span>
            )}
            {adjustDiff !== null && adjustDiff < 0 && <span className="text-error-red">Se registrará un adeudo de {formatCurrency(-adjustDiff)} al cajero.</span>}
          </div>
        );
      case 'reopen':
        return <span>El corte vuelve a <strong>pendiente de nivel 2</strong>; si había un adeudo, se anula y se volverá a calcular al aprobar.</span>;
      case 'unblock':
        return <span>La sucursal podrá abrir un turno nuevo. Este Corte Z <strong>sigue pendiente de nivel 1</strong>; no se aprueba.</span>;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-5 text-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-text-primary">{shift.branchName}</span>
            <ReviewBadge status={shift.reviewStatus} />
            <ReconciliationBadge status={figures.reconciliationStatus} />
            {shift.closedOffline && <Badge variant="charcoal">Cerrado sin conexión</Badge>}
          </div>
          <span className="text-xs text-text-secondary">
            Cajero: {shift.cashierName ?? '—'} · Cerró: {shift.closedByName ?? '—'} · {formatDateTime(shift.closedAt)}
          </span>
          {shift.operatorReviewedByName && (
            <span className="text-xs text-text-secondary">
              Nivel 1: {shift.operatorReviewedByName} ({formatDateTime(shift.operatorReviewedAt)}){shift.operatorNotes ? ` — “${shift.operatorNotes}”` : ''}
            </span>
          )}
          {shift.reviewedByName && (
            <span className="text-xs text-text-secondary">
              Nivel 2: {shift.reviewedByName} ({formatDateTime(shift.reviewedAt)}){shift.reviewNotes ? ` — “${shift.reviewNotes}”` : ''}
            </span>
          )}
          {shift.openBlockOverriddenAt && (
            <span className="text-xs text-champagne-gold">Apertura desbloqueada por el owner: {shift.openBlockOverrideReason}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
        <Figure label="Esperado al cierre" value={formatCurrency(figures.expectedAtClose)} hint="Snapshot del Corte Z (no se modifica)" />
        <Figure
          label="Ajustes posteriores al cierre"
          value={<span className={differenceClass(figures.postCloseAdjustment === 0 ? 0 : figures.postCloseAdjustment)}>{formatCurrency(figures.postCloseAdjustment)}</span>}
          hint={`${figures.postCloseEntries.length} asiento(s) de reverso/ajuste`}
        />
        <Figure label="Esperado ajustado" value={formatCurrency(figures.adjustedExpected)} />
        <Figure label="Contado" value={formatCurrency(figures.counted)} hint={shift.recountCount ? `${shift.recountCount} reconteo(s)` : undefined} />
        <Figure label="Diferencia al cierre" value={<span className={differenceClass(figures.originalDifference)}>{formatCurrency(figures.originalDifference)}</span>} />
        <Figure label="Diferencia ajustada" value={<span className={differenceClass(figures.adjustedDifference)}>{formatCurrency(figures.adjustedDifference)}</span>} />
      </div>
      {shift.localExpectedCash !== null && (
        <div className="text-xs text-text-secondary">
          Esperado calculado sin conexión en el POS: {formatCurrency(shift.localExpectedCash)} (el servidor recalculó {formatCurrency(figures.expectedAtClose)}).
        </div>
      )}
      {figures.pendingMovementsCount > 0 && (
        <div className="p-3 rounded border border-champagne-gold/30 bg-champagne-gold/5 text-xs text-champagne-gold">
          Hay {figures.pendingMovementsCount} movimiento(s) pendientes de aprobación ({formatCurrency(figures.pendingMovementsAmount)}). El corte no se puede aprobar hasta resolverlos.
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-[10px] uppercase tracking-widest text-text-secondary font-bold">Ingresos / egresos del turno</span>
        {originals.length === 0 && <span className="text-xs text-text-secondary italic">Sin movimientos de caja.</span>}
        {originals.map((mv) => (
          <div key={mv.id} className="p-3 rounded border border-aged-bronze/20 bg-charcoal/30 flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`font-mono ${mv.type === 'cash-in' ? 'text-success-green' : 'text-error-red'}`}>
                  {mv.type === 'cash-in' ? '+' : '−'}{formatCurrency(mv.amount)}
                </span>
                <span className="text-xs text-text-primary">{mv.category ? CASH_CATEGORY_LABELS[mv.category] ?? mv.category : 'Sin categoría'}</span>
                <MovementBadge status={mv.approvalStatus} />
                <span className="text-xs text-text-secondary">{mv.reason}</span>
              </div>
              {permissions.canCorrectMovements && ['pendiente_n1', 'aprobado', 'aprobado_historico'].includes(mv.approvalStatus) && (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => onMovementAction(mv, 'adjust')}>Ajustar</Button>
                  <Button size="sm" variant="secondary" onClick={() => onMovementAction(mv, 'cancel')}>Cancelar</Button>
                </div>
              )}
            </div>
            {childrenOf(mv.id).map((child) => (
              <div key={child.id} className="ml-4 text-[11px] text-text-secondary flex flex-wrap gap-2">
                <span>{child.entryKind === 'reverso' ? '↳ Reverso' : '↳ Ajuste'}</span>
                <span className="font-mono">{formatCurrency(child.cashEffect)}</span>
                <span>{formatDateTime(child.createdAt)}</span>
                <span>{child.reason}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-aged-bronze/30 pt-4">
        {permissions.canApprove && <Button size="sm" onClick={() => setAction('approve')}>Aprobar {level === 'n1' ? '(nivel 1)' : '(nivel 2)'}</Button>}
        {permissions.canReject && <Button size="sm" variant="danger" onClick={() => setAction('reject')}>Rechazar</Button>}
        {permissions.canAdjust && <Button size="sm" variant="secondary" onClick={() => setAction('adjust')}>Aprobar con ajuste</Button>}
        {permissions.canReopen && <Button size="sm" variant="secondary" onClick={() => setAction('reopen')}>Reabrir (owner)</Button>}
        {permissions.canUnblockOpening && <Button size="sm" variant="secondary" onClick={() => setAction('unblock')}>Desbloquear apertura (owner)</Button>}
        {!permissions.canApprove && !permissions.canAdjust && !permissions.canReopen && !permissions.canUnblockOpening && (
          <span className="text-xs text-text-secondary">
            {level === 'n1'
              ? 'Este corte espera el nivel 1 (operador de sucursal, o el supervisor si lo cerró el operador).'
              : level === 'n2'
                ? 'Este corte espera el nivel 2 de otra persona (supervisor asignado u owner).'
                : 'Sin acciones disponibles.'}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[10px] uppercase tracking-widest text-text-secondary font-bold">Bitácora</span>
        {history.length === 0 && <span className="text-xs text-text-secondary italic">Sin eventos.</span>}
        <ol className="flex flex-col gap-1">
          {history.map((entry) => (
            <li key={entry.id} className="text-[11px] text-text-secondary flex flex-wrap gap-x-2">
              <span className="text-text-primary">{formatDateTime(entry.createdAt)}</span>
              <span className="text-champagne-gold">{ACTION_LABELS[entry.action] ?? entry.action}</span>
              {entry.approvalLevel && <span>[{entry.approvalLevel.toUpperCase()}]</span>}
              <span>{entry.actorName ?? 'Sistema'}</span>
              {entry.reason && <span>— “{entry.reason}”</span>}
            </li>
          ))}
        </ol>
      </div>

      {action && (
        <ConfirmActionDialog
          title={
            action === 'approve'
              ? `Aprobar Corte Z (${level === 'n1' ? 'nivel 1' : 'nivel 2'})`
              : action === 'reject'
                ? 'Rechazar Corte Z'
                : action === 'adjust'
                  ? 'Aprobar con ajuste'
                  : action === 'reopen'
                    ? 'Reabrir Corte Z'
                    : 'Desbloquear apertura de turno'
          }
          impact={impactFor(action)}
          reasonRequired={action !== 'approve'}
          amountLabel={action === 'adjust' ? 'Monto aceptado (efectivo)' : undefined}
          amount={adjustAmount}
          onAmountChange={setAdjustAmount}
          confirmLabel={action === 'approve' ? 'Aprobar' : action === 'reject' ? 'Rechazar' : action === 'adjust' ? 'Aprobar con ajuste' : action === 'reopen' ? 'Reabrir' : 'Desbloquear'}
          confirmVariant={action === 'reject' ? 'danger' : 'primary'}
          busy={busy}
          error={actionError}
          onConfirm={runAction}
          onClose={() => {
            setAction(null);
            setActionError(null);
          }}
        />
      )}
    </div>
  );
};
