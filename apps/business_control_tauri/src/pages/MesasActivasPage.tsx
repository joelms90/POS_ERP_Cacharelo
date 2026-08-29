import React, { useState, useEffect, useMemo } from 'react';
import { api, LiveOrder } from '../services/api';
import { Heading } from '../components/atoms/Heading';
import { Badge } from '../components/atoms/Badge';

interface MesasActivasPageProps {
  businessId: string;
}

const ROOM_ICONS: Record<string, string> = {
  'Principal': '🏠',
  'Tapanco': '🏗️',
  'Jardin': '🌿',
  'Privado': '🔒',
  'Para Llevar': '🛍️',
};

const statusLabel = (state: string) => {
  switch (state) {
    case 'open': return 'Abierta';
    case 'billing': return 'Por cobrar';
    default: return state;
  }
};

const stateColor = (state: string) => {
  switch (state) {
    case 'open': return 'text-amber-400';
    case 'billing': return 'text-blue-400';
    default: return 'text-text-secondary';
  }
};

export const MesasActivasPage: React.FC<MesasActivasPageProps> = ({ businessId }) => {
  const [orders, setOrders] = useState<LiveOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchOrders = () => {
    api.getActiveOrdersByBusiness(businessId)
      .then(setOrders)
      .catch((err) => setError(err.message || 'Error'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchOrders();
  }, [businessId]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchOrders, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, businessId]);

  // Group orders by branch → room → table
  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, LiveOrder[]>>();
    for (const o of orders) {
      const branch = o.branchName || 'Sucursal';
      if (!map.has(branch)) map.set(branch, new Map());
      const roomMap = map.get(branch)!;
      const room = o.tableRoom || 'Sin sala';
      if (!roomMap.has(room)) roomMap.set(room, []);
      roomMap.get(room)!.push(o);
    }
    return map;
  }, [orders]);

  const totalActive = orders.length;
  const totalAmount = orders.reduce((s, o) => s + (parseFloat(o.total) || 0), 0);
  const totalItems = orders.reduce((s, o) => s + o.items.reduce((si, i) => si + i.quantity, 0), 0);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Heading level={1}>Mesas Activas</Heading>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-2 border-champagne-gold border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 max-w-screen-2xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Heading level={1}>Mesas Activas</Heading>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer select-none">
            <input type="checkbox" checked={autoRefresh} onChange={() => setAutoRefresh(!autoRefresh)} className="cursor-pointer" />
            Auto-refresh (15s)
          </label>
          <button onClick={fetchOrders} className="px-3 py-1.5 bg-charcoal-surface border border-aged-bronze/30 rounded text-xs text-text-primary hover:bg-charcoal-surface/70 cursor-pointer">
            ↻ Refrescar
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-error-red/10 border border-error-red/30 rounded p-4 text-error-red text-sm">
          {error}
          <button onClick={fetchOrders} className="ml-3 underline cursor-pointer">Reintentar</button>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-charcoal-surface border border-aged-bronze/20 rounded-lg p-4">
          <p className="text-[10px] text-text-secondary uppercase tracking-widest">Mesas Activas</p>
          <p className="text-xl font-bold text-champagne-gold mt-1">{totalActive}</p>
        </div>
        <div className="bg-charcoal-surface border border-aged-bronze/20 rounded-lg p-4">
          <p className="text-[10px] text-text-secondary uppercase tracking-widest">Artículos Pendientes</p>
          <p className="text-xl font-bold text-text-primary mt-1">{totalItems}</p>
        </div>
        <div className="bg-charcoal-surface border border-aged-bronze/20 rounded-lg p-4">
          <p className="text-[10px] text-text-secondary uppercase tracking-widest">Total por Cobrar</p>
          <p className="text-xl font-bold text-champagne-gold mt-1">${totalAmount.toFixed(2)}</p>
        </div>
      </div>

      {orders.length === 0 && (
        <div className="text-center py-16 text-text-secondary">
          <p className="text-lg">Sin mesas activas</p>
          <p className="text-xs mt-1">No hay órdenes abiertas en ninguna sucursal</p>
        </div>
      )}

      {/* Per branch → room → table */}
      {Array.from(grouped.entries()).map(([branch, roomMap]) => (
        <div key={branch} className="bg-charcoal-surface border border-aged-bronze/20 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-aged-bronze/10 border-b border-aged-bronze/20 flex items-center gap-3">
            <span className="text-sm font-bold text-champagne-gold">📍 {branch}</span>
            <Badge>{Array.from(roomMap.values()).flat().length} mesas</Badge>
          </div>

          {Array.from(roomMap.entries()).map(([room, roomOrders]) => {
            const icon = ROOM_ICONS[room] || '📍';
            return (
              <div key={room} className="border-b border-aged-bronze/10 last:border-b-0">
                <div className="px-4 py-2 bg-obsidian/50 text-xs text-text-secondary uppercase tracking-wider flex items-center gap-2">
                  {icon} {room}
                  <span className="text-text-secondary/50">({roomOrders.length})</span>
                </div>

                <div className="divide-y divide-aged-bronze/5">
                  {roomOrders.map((order) => {
                    const isExpanded = expandedId === order.id;
                    const total = parseFloat(order.total || '0');
                    return (
                      <div key={order.id}>
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : order.id)}
                          className="w-full px-4 py-3 flex items-center justify-between hover:bg-aged-bronze/5 transition-colors text-left cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <svg className={`w-4 h-4 text-text-secondary transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <span className="text-sm font-bold text-text-primary">{order.tableLabel}</span>
                            <span className={`text-[10px] font-bold uppercase ${stateColor(order.state)}`}>{statusLabel(order.state)}</span>
                            {order.items.length > 0 && (
                              <span className="text-[10px] text-text-secondary">{order.items.reduce((s, i) => s + i.quantity, 0)} art.</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-text-secondary">{order.waiterName}</span>
                            <span className="text-xs text-text-secondary/70">{formatTime(order.createdAt)}</span>
                            <span className="text-sm font-mono font-bold text-champagne-gold">${total.toFixed(2)}</span>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="px-10 py-3 bg-obsidian/50 border-t border-aged-bronze/10">
                            {/* Items */}
                            <div className="mb-3">
                              <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-2">Productos ({order.items.reduce((s, i) => s + i.quantity, 0)})</p>
                              <table className="w-full text-xs">
                                <tbody>
                                  {order.items.map((item, ii) => (
                                    <tr key={ii} className="border-b border-aged-bronze/5">
                                      <td className="py-1 text-text-secondary w-8">{item.quantity}x</td>
                                      <td className="py-1 text-text-primary">{item.productName || '—'}</td>
                                      {item.notes && <td className="py-1 text-text-secondary/70 text-[10px]">{item.notes}</td>}
                                      <td className="py-1 text-right font-mono text-text-secondary w-20">${(parseFloat(item.price || '0')).toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {/* Totals */}
                            <div className="text-xs space-y-0.5 border-t border-aged-bronze/10 pt-2">
                              <div className="flex justify-between"><span className="text-text-secondary">Subtotal</span><span className="font-mono">${(parseFloat(order.subtotal || '0')).toFixed(2)}</span></div>
                              <div className="flex justify-between"><span className="text-text-secondary">IVA</span><span className="font-mono">${(parseFloat(order.tax || '0')).toFixed(2)}</span></div>
                              <div className="flex justify-between font-bold mt-1 pt-1 border-t border-aged-bronze/10"><span className="text-text-secondary">Total</span><span className="font-mono text-champagne-gold">${total.toFixed(2)}</span></div>
                            </div>
                            {/* Payments (if any) */}
                            {order.payments.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-aged-bronze/10">
                                <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Pagos realizados</p>
                                {order.payments.map((p, pi) => (
                                  <div key={pi} className="flex justify-between text-xs">
                                    <span className="text-text-primary capitalize">{p.method}</span>
                                    <span className="font-mono">${(parseFloat(p.amount || '0')).toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
