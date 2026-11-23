import React, { useCallback, useEffect, useState } from 'react';
import { Heading } from '../../components/atoms/Heading';
import { Button } from '../../components/atoms/Button';
import { Badge } from '../../components/atoms/Badge';
import { api, AppNotification } from '../../services/api';
import { errorMessage, formatDateTime } from './supervisionUi';

/** Spec 019 D-6: persistent notifications read over REST (no push). */
export const NotificationsPage: React.FC<{ onNavigateTab: (tab: string) => void }> = ({ onNavigateTab }) => {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await api.getNotifications({ unread: unreadOnly, limit: 100 }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [unreadOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const open = async (item: AppNotification) => {
    if (!item.readAt) {
      await api.markNotificationRead(item.id).catch(() => undefined);
      window.dispatchEvent(new Event('notifications:changed'));
    }
    onNavigateTab(item.entityType === 'cashier_debt' ? 'debts' : 'approvals');
  };

  const markAll = async () => {
    await api.markAllNotificationsRead();
    window.dispatchEvent(new Event('notifications:changed'));
    load();
  };

  return (
    <div className="flex flex-col gap-6 min-h-full lg:h-full overflow-y-auto lg:overflow-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Heading level={2} className="!text-lg sm:!text-2xl">Notificaciones</Heading>
          <p className="text-xs text-text-secondary mt-1">Cortes Z y movimientos de caja por aprobar, resoluciones, bloqueos de apertura y adeudos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} /> Solo no leídas
          </label>
          <Button size="sm" variant="secondary" onClick={markAll}>Marcar todas como leídas</Button>
          <Button size="sm" variant="secondary" onClick={load} disabled={loading}>Actualizar</Button>
        </div>
      </div>
      {error && <div className="text-error-red text-sm">{error}</div>}
      {loading && <div className="text-text-secondary text-sm">Cargando…</div>}
      {!loading && items.length === 0 && <div className="p-8 text-center text-text-secondary text-sm italic">Sin notificaciones.</div>}
      <div className="flex flex-col gap-2 lg:overflow-y-auto pr-1">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => open(item)}
            className={`text-left p-4 rounded-lg border transition-colors flex flex-col gap-1 ${
              item.readAt ? 'border-aged-bronze/15 bg-charcoal/30' : 'border-champagne-gold/40 bg-charcoal-surface'
            } hover:border-champagne-gold/70`}
          >
            <div className="flex flex-wrap items-center gap-2">
              {item.requiresAction && !item.readAt && <Badge variant="gold">Requiere acción</Badge>}
              {!item.readAt && <span className="w-2 h-2 rounded-full bg-champagne-gold" aria-label="No leída" />}
              <span className="text-sm text-text-primary font-medium">{item.title}</span>
            </div>
            {item.body && <span className="text-xs text-text-secondary">{item.body}</span>}
            <span className="text-[10px] text-text-secondary">{item.branchName ?? ''} · {formatDateTime(item.createdAt)}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
