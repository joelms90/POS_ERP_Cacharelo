import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api, LiveOrder, Branch, BranchTable } from '../services/api';
import { Heading } from '../components/atoms/Heading';
import { Badge } from '../components/atoms/Badge';
import { Autocomplete } from '../components/molecules/Autocomplete';

interface MesasActivasPageProps {
  businessId: string;
  onNavigateTab?: (tab: string) => void;
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

export const MesasActivasPage: React.FC<MesasActivasPageProps> = ({ businessId, onNavigateTab }) => {
  const [orders, setOrders] = useState<LiveOrder[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [tablesByBranchId, setTablesByBranchId] = useState<Record<string, BranchTable[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch branches and their configured tables for this business
  const fetchBranchesAndTables = useCallback(async () => {
    try {
      const branchesData = await api.getBranches(businessId);
      setBranches(branchesData);

      // Fetch tables for each branch in parallel to know if tables are configured
      const tablesMap: Record<string, BranchTable[]> = {};
      await Promise.all(
        branchesData.map(async (b) => {
          try {
            const tbls = await api.getBranchTables(b.id);
            tablesMap[b.id] = tbls;
          } catch {
            tablesMap[b.id] = [];
          }
        })
      );
      setTablesByBranchId(tablesMap);
    } catch {
      setBranches([]);
      setTablesByBranchId({});
    }
  }, [businessId]);

  // Fetch live orders across the business
  const fetchOrders = useCallback(async () => {
    try {
      const liveOrders = await api.getActiveOrdersByBusiness(businessId);
      setOrders(liveOrders);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar órdenes de mesas activas');
    } finally {
      setIsLoading(false);
    }
  }, [businessId]);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchOrders(), fetchBranchesAndTables()]);
  }, [fetchOrders, fetchBranchesAndTables]);

  useEffect(() => {
    setIsLoading(true);
    setSelectedBranchId('all');
    refreshAll();
  }, [businessId, refreshAll]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchOrders, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchOrders]);

  const branchOptions = useMemo(() => {
    const opts = [{ id: 'all', label: 'Todas las sucursales' }];
    for (const b of branches) {
      opts.push({ id: b.id, label: b.name });
    }
    return opts;
  }, [branches]);

  const selectedBranchName = useMemo(() => {
    if (selectedBranchId === 'all') return 'Todas las sucursales';
    const found = branches.find((b) => b.id === selectedBranchId);
    return found ? found.name : 'Sucursal seleccionada';
  }, [branches, selectedBranchId]);

  // Filter orders by branch
  const filteredOrders = useMemo(() => {
    if (selectedBranchId === 'all') return orders;
    return orders.filter((o) => o.branchId === selectedBranchId);
  }, [orders, selectedBranchId]);

  // Relevant configured tables in current scope
  const relevantTables = useMemo(() => {
    if (selectedBranchId === 'all') {
      return Object.values(tablesByBranchId).flat();
    }
    return tablesByBranchId[selectedBranchId] || [];
  }, [tablesByBranchId, selectedBranchId]);

  const totalTablesConfigured = relevantTables.length;
  const totalCapacity = useMemo(() => {
    return relevantTables.reduce((acc, t) => acc + (t.capacity || 4), 0);
  }, [relevantTables]);

  const distinctRooms = useMemo(() => {
    const set = new Set<string>();
    relevantTables.forEach((t) => {
      if (t.room) set.add(t.room);
    });
    return Array.from(set);
  }, [relevantTables]);

  // Group active orders by branch → room → table
  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, LiveOrder[]>>();
    for (const o of filteredOrders) {
      const branch = o.branchName || 'Sucursal';
      if (!map.has(branch)) map.set(branch, new Map());
      const roomMap = map.get(branch)!;
      const room = o.tableRoom || 'Sin sala';
      if (!roomMap.has(room)) roomMap.set(room, []);
      roomMap.get(room)!.push(o);
    }
    return map;
  }, [filteredOrders]);

  const totalActive = filteredOrders.length;
  const totalAmount = filteredOrders.reduce((s, o) => s + (parseFloat(o.total) || 0), 0);
  const totalItems = filteredOrders.reduce((s, o) => s + o.items.reduce((si, i) => si + i.quantity, 0), 0);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' });

  const isAccessForbidden = error && (
    error.toLowerCase().includes('forbidden') ||
    error.toLowerCase().includes('403') ||
    error.toLowerCase().includes('acceso')
  );

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
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Heading level={1}>Mesas Activas</Heading>
          <p className="text-xs text-text-secondary mt-0.5">
            Monitoreo en tiempo real de salones, comandas de meseros y cuentas de comensales
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {branches.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary">Sucursal:</span>
              <Autocomplete
                value={selectedBranchId}
                onChange={setSelectedBranchId}
                options={branchOptions}
                placeholder="Filtrar por sucursal…"
                className="w-56"
              />
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={() => setAutoRefresh(!autoRefresh)}
              className="cursor-pointer"
            />
            Auto-refresh (15s)
          </label>

          <button
            onClick={refreshAll}
            className="px-3 py-1.5 bg-charcoal-surface border border-aged-bronze/30 rounded text-xs text-text-primary hover:bg-charcoal-surface/70 cursor-pointer"
          >
            ↻ Refrescar
          </button>
        </div>
      </div>

      {/* Access Error Banner (e.g. 403 / No Access) */}
      {isAccessForbidden && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 text-center my-2">
          <div className="text-3xl mb-2">⚠️</div>
          <h3 className="text-base font-bold text-amber-300">Negocio no disponible o sin acceso</h3>
          <p className="text-xs text-text-secondary mt-1 max-w-lg mx-auto">
            No tienes permisos asignados para consultar este negocio con tu sesión actual o la entidad no se encuentra accesible. Selecciona otro negocio en la barra superior del panel de control.
          </p>
          <button
            onClick={refreshAll}
            className="mt-4 px-4 py-2 bg-charcoal-surface border border-aged-bronze/30 rounded text-xs text-text-primary hover:bg-charcoal-surface/70 cursor-pointer"
          >
            Reintentar conexión
          </button>
        </div>
      )}

      {/* General Error Banner */}
      {error && !isAccessForbidden && (
        <div className="bg-error-red/10 border border-error-red/30 rounded p-4 text-error-red text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={refreshAll} className="underline cursor-pointer text-xs">Reintentar</button>
        </div>
      )}

      {/* KPI row */}
      {!isAccessForbidden && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-charcoal-surface border border-aged-bronze/20 rounded-lg p-4">
            <p className="text-[10px] text-text-secondary uppercase tracking-widest">Mesas Ocupadas</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-champagne-gold">{totalActive}</span>
              {totalTablesConfigured > 0 && (
                <span className="text-xs text-text-secondary">
                  de {totalTablesConfigured} configuradas ({Math.round((totalActive / totalTablesConfigured) * 100)}%)
                </span>
              )}
            </div>
          </div>
          <div className="bg-charcoal-surface border border-aged-bronze/20 rounded-lg p-4">
            <p className="text-[10px] text-text-secondary uppercase tracking-widest">Artículos en Consumo</p>
            <p className="text-xl font-bold text-text-primary mt-1">{totalItems}</p>
          </div>
          <div className="bg-charcoal-surface border border-aged-bronze/20 rounded-lg p-4">
            <p className="text-[10px] text-text-secondary uppercase tracking-widest">Total por Cobrar</p>
            <p className="text-xl font-bold text-champagne-gold mt-1">${totalAmount.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* CASE 1: No branches found for this business */}
      {!isAccessForbidden && branches.length === 0 && (
        <div className="bg-charcoal-surface border border-aged-bronze/20 rounded-xl p-8 text-center my-4">
          <div className="text-4xl mb-3">📍</div>
          <h3 className="text-base font-bold text-text-primary">Sin sucursales registradas</h3>
          <p className="text-xs text-text-secondary mt-1 max-w-md mx-auto">
            Este negocio aún no tiene sucursales dadas de alta en el sistema. Para empezar a operar mesas o mostrador, registra tu primera sucursal.
          </p>
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('branches')}
              className="mt-4 px-4 py-2 bg-champagne-gold/20 text-champagne-gold border border-champagne-gold/30 rounded text-xs font-semibold hover:bg-champagne-gold/30 cursor-pointer"
            >
              🛠️ Ir al Catálogo de Sucursales
            </button>
          )}
        </div>
      )}

      {/* CASE 2: Branch has 0 tables configured (Quick-service or unconfigured) */}
      {!isAccessForbidden && branches.length > 0 && totalTablesConfigured === 0 && filteredOrders.length === 0 && (
        <div className="bg-charcoal-surface border border-aged-bronze/20 rounded-xl p-8 text-center my-4">
          <div className="text-4xl mb-3">🪑</div>
          <h3 className="text-lg font-bold text-champagne-gold">
            {selectedBranchId === 'all'
              ? 'Este negocio no tiene mesas configuradas'
              : `La sucursal "${selectedBranchName}" no tiene mesas configuradas`}
          </h3>
          <div className="text-xs text-text-secondary mt-4 max-w-xl mx-auto space-y-3 text-left bg-obsidian/60 p-4 rounded-lg border border-aged-bronze/10">
            <p className="flex items-start gap-2">
              <span className="text-champagne-gold font-bold">•</span>
              <span>
                <strong>Área de Comedor / Mesas (Cafetería / Restaurante):</strong> Si este local atiende comensales en sala, terraza o jardín, puedes dar de alta el plano y numeración de mesas en el diseñador de sucursales.
              </span>
            </p>
            <p className="flex items-start gap-2">
              <span className="text-champagne-gold font-bold">•</span>
              <span>
                <strong>Modalidad Mostrador / Venta Rápida (Empanadas, Tortas, Kiosco):</strong> Si la sucursal despacha al instante a través de un Operador de Sucursal o cajero, las ventas se cobran y cierran de inmediato en caja sin necesidad de mesas físicas.
              </span>
            </p>
          </div>
          {onNavigateTab && (
            <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
              <button
                onClick={() => onNavigateTab('branches')}
                className="px-4 py-2 bg-champagne-gold text-obsidian font-bold rounded text-xs hover:bg-champagne-gold/90 transition-colors cursor-pointer shadow-lg shadow-champagne-gold/10"
              >
                🛠️ Configurar Mesas en Sucursales
              </button>
              <button
                onClick={() => onNavigateTab('tickets')}
                className="px-4 py-2 bg-charcoal-surface border border-aged-bronze/30 text-text-primary rounded text-xs hover:bg-charcoal-surface/70 transition-colors cursor-pointer"
              >
                🧾 Ver Tickets del Día
              </button>
            </div>
          )}
        </div>
      )}

      {/* CASE 3: Branch has tables, but all are currently free */}
      {!isAccessForbidden && totalTablesConfigured > 0 && filteredOrders.length === 0 && (
        <div className="bg-charcoal-surface border border-aged-bronze/20 rounded-xl p-8 text-center my-4">
          <div className="text-4xl mb-3">🟢</div>
          <h3 className="text-lg font-bold text-text-primary">Todas las mesas están disponibles</h3>
          <p className="text-xs text-text-secondary mt-1 max-w-lg mx-auto">
            {selectedBranchId === 'all'
              ? `Hay ${totalTablesConfigured} mesas configuradas en el negocio y actualmente no hay comandas abiertas.`
              : `Hay ${totalTablesConfigured} mesas configuradas en ${selectedBranchName}${distinctRooms.length ? ` (Salas: ${distinctRooms.join(', ')})` : ''} y ninguna comanda está abierta en este momento.`}
          </p>
          <p className="text-[11px] text-text-secondary/60 mt-2">
            En cuanto un mesero o cajero abra una orden en el POS, aparecerá aquí reflejada en tiempo real.
          </p>
          <div className="mt-5 inline-flex flex-wrap items-center justify-center gap-3 px-4 py-2 bg-obsidian/70 rounded-full border border-aged-bronze/20 text-xs">
            <span className="text-green-400 font-bold">● {totalTablesConfigured} Libres</span>
            <span className="text-text-secondary/40">|</span>
            <span className="text-text-secondary">Ocupación: 0%</span>
            <span className="text-text-secondary/40">|</span>
            <span className="text-text-secondary">Capacidad estimada: ~{totalCapacity} comensales</span>
          </div>
        </div>
      )}

      {/* CASE 4: Active Orders List (Per branch → room → table) */}
      {!isAccessForbidden && Array.from(grouped.entries()).map(([branch, roomMap]) => (
        <div key={branch} className="bg-charcoal-surface border border-aged-bronze/20 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-aged-bronze/10 border-b border-aged-bronze/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-champagne-gold">📍 {branch}</span>
              <Badge>{Array.from(roomMap.values()).flat().length} mesas activas</Badge>
            </div>
            {tablesByBranchId[branch] && (
              <span className="text-xs text-text-secondary">
                {tablesByBranchId[branch].length} mesas totales
              </span>
            )}
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
                            <svg
                              className={`w-4 h-4 text-text-secondary transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <span className="text-sm font-bold text-text-primary">{order.tableLabel}</span>
                            <span className={`text-[10px] font-bold uppercase ${stateColor(order.state)}`}>
                              {statusLabel(order.state)}
                            </span>
                            {order.items.length > 0 && (
                              <span className="text-[10px] text-text-secondary">
                                {order.items.reduce((s, i) => s + i.quantity, 0)} art.
                              </span>
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
                              <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-2">
                                Productos ({order.items.reduce((s, i) => s + i.quantity, 0)})
                              </p>
                              <table className="w-full text-xs">
                                <tbody>
                                  {order.items.map((item, ii) => (
                                    <tr key={ii} className="border-b border-aged-bronze/5">
                                      <td className="py-1 text-text-secondary w-8">{item.quantity}x</td>
                                      <td className="py-1 text-text-primary">{item.productName || '—'}</td>
                                      {item.notes && <td className="py-1 text-text-secondary/70 text-[10px]">{item.notes}</td>}
                                      <td className="py-1 text-right font-mono text-text-secondary w-20">
                                        ${(parseFloat(item.price || '0')).toFixed(2)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {/* Totals */}
                            <div className="text-xs space-y-0.5 border-t border-aged-bronze/10 pt-2">
                              <div className="flex justify-between">
                                <span className="text-text-secondary">Subtotal</span>
                                <span className="font-mono">${(parseFloat(order.subtotal || '0')).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-text-secondary">IVA</span>
                                <span className="font-mono">${(parseFloat(order.tax || '0')).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between font-bold mt-1 pt-1 border-t border-aged-bronze/10">
                                <span className="text-text-secondary">Total</span>
                                <span className="font-mono text-champagne-gold">${total.toFixed(2)}</span>
                              </div>
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
