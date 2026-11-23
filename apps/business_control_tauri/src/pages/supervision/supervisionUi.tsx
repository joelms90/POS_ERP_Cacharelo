import React from 'react';
import { Badge } from '../../components/atoms/Badge';
import { Button } from '../../components/atoms/Button';
import {
  MOVEMENT_STATUS_LABELS,
  MovementApprovalStatus,
  ReconciliationStatus,
  SHIFT_REVIEW_LABELS,
  ShiftReviewStatus,
} from '../../services/api';

export const formatCurrency = (value: number | string | null | undefined) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value ?? 0));

export const formatDateTime = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

const reviewVariant = (status: ShiftReviewStatus) => {
  if (status === 'aprobado' || status === 'aprobado_con_ajuste') return 'success' as const;
  if (status === 'rechazado_n1' || status === 'rechazado_n2') return 'error' as const;
  if (status === 'pendiente_n1' || status === 'pendiente_n2') return 'warning' as const;
  return 'charcoal' as const;
};

export const ReviewBadge: React.FC<{ status: ShiftReviewStatus | undefined }> = ({ status }) =>
  status ? <Badge variant={reviewVariant(status)}>{SHIFT_REVIEW_LABELS[status] ?? status}</Badge> : null;

const movementVariant = (status: MovementApprovalStatus) => {
  if (status === 'aprobado' || status === 'aprobado_historico') return 'success' as const;
  if (status === 'rechazado' || status === 'cancelado') return 'error' as const;
  if (status === 'pendiente_n1') return 'warning' as const;
  if (status === 'ajustado') return 'bronze' as const;
  return 'charcoal' as const;
};

export const MovementBadge: React.FC<{ status: MovementApprovalStatus | undefined }> = ({ status }) =>
  status ? <Badge variant={movementVariant(status)}>{MOVEMENT_STATUS_LABELS[status] ?? status}</Badge> : null;

const RECONCILIATION_LABELS: Record<ReconciliationStatus, string> = {
  BALANCED: 'Cuadrado',
  SURPLUS: 'Sobrante',
  SHORTAGE: 'Faltante',
  REQUIRES_RECONCILIATION: 'Requiere conciliación',
};

export const ReconciliationBadge: React.FC<{ status: ReconciliationStatus | null | undefined }> = ({ status }) => {
  if (!status) return null;
  const variant = status === 'BALANCED' ? 'success' : status === 'SURPLUS' ? 'gold' : 'error';
  return <Badge variant={variant}>{RECONCILIATION_LABELS[status]}</Badge>;
};

export const differenceClass = (value: number | null | undefined) =>
  value === null || value === undefined
    ? 'text-text-secondary'
    : Math.round(value * 100) === 0
      ? 'text-success-green'
      : value < 0
        ? 'text-error-red'
        : 'text-champagne-gold';

export const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({
  title,
  onClose,
  children,
  wide,
}) => (
  <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-start sm:items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={`bg-onyx-surface border border-aged-bronze/40 rounded-lg shadow-2xl w-full ${wide ? 'max-w-4xl' : 'max-w-lg'} my-4`}
    >
      <div className="flex items-center justify-between gap-4 px-4 sm:px-6 py-4 border-b border-aged-bronze/30">
        <h3 className="text-base sm:text-lg font-semibold text-text-primary">{title}</h3>
        <button onClick={onClose} className="p-1 text-text-secondary hover:text-champagne-gold" aria-label="Cerrar">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  </div>
);

export interface ConfirmActionDialogProps {
  title: string;
  /** Consequences shown before confirming (spec 019 R-16). */
  impact?: React.ReactNode;
  impactLoading?: boolean;
  reasonRequired?: boolean;
  reasonLabel?: string;
  amountLabel?: string;
  amount?: string;
  onAmountChange?: (value: string) => void;
  confirmLabel: string;
  confirmVariant?: 'primary' | 'danger';
  busy?: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

/** Confirmation with a mandatory reason when required and the impact shown up front. */
export const ConfirmActionDialog: React.FC<ConfirmActionDialogProps> = ({
  title,
  impact,
  impactLoading,
  reasonRequired,
  reasonLabel = 'Motivo',
  amountLabel,
  amount,
  onAmountChange,
  confirmLabel,
  confirmVariant = 'primary',
  busy,
  error,
  onConfirm,
  onClose,
}) => {
  const [reason, setReason] = React.useState('');
  const reasonOk = !reasonRequired || reason.trim().length >= 3;
  const amountOk = !amountLabel || (Number.parseFloat(amount ?? '') > 0);
  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-4 text-sm">
        <div className="rounded border border-champagne-gold/30 bg-champagne-gold/5 p-3 text-text-primary">
          <div className="text-[10px] uppercase tracking-widest text-champagne-gold font-bold mb-1">Impacto</div>
          {impactLoading ? <span className="text-text-secondary">Calculando impacto…</span> : impact}
        </div>
        {amountLabel && (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-secondary">{amountLabel}</span>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={amount ?? ''}
              onChange={(e) => onAmountChange?.(e.target.value)}
              className="bg-charcoal border border-aged-bronze/40 rounded px-3 py-2 text-text-primary focus:outline-none focus:border-champagne-gold"
            />
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-text-secondary">
            {reasonLabel}
            {reasonRequired ? ' (obligatorio)' : ' (opcional)'}
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            className="bg-charcoal border border-aged-bronze/40 rounded px-3 py-2 text-text-primary focus:outline-none focus:border-champagne-gold"
          />
        </label>
        {error && <div className="text-error-red text-xs">{error}</div>}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            variant={confirmVariant}
            size="sm"
            disabled={busy || !reasonOk || !amountOk || impactLoading}
            onClick={() => onConfirm(reason.trim())}
          >
            {busy ? 'Guardando…' : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Today's calendar date (YYYY-MM-DD) in the viewer's local timezone. */
export const localToday = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
