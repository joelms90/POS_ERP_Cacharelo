import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActiveOrder,
  api,
  Branch,
  BranchTable,
  Employee,
  KitchenTicket,
  Product,
} from '../services/api';
import { Heading } from '../components/atoms/Heading';

interface PosSimulatorPageProps {
  businessId: string;
}

type ToastType = 'success' | 'error' | 'warning';

const TAX_RATE = 0.16;

const money = (value: number) => value.toFixed(2);

const grossToNet = (value: number) => value / (1 + TAX_RATE);

const formatCurrency = (value?: string | number) => {
  const parsed = typeof value === 'number' ? value : Number(value || 0);
  return parsed.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
  });
};

const statusLabel = (status?: string) => {
  switch (status) {
    case 'available':
      return 'Disponible';
    case 'occupied':
      return 'Ocupada';
    case 'billing':
      return 'Por cobrar';
    case 'cleaning':
      return 'Limpieza';
    case 'open':
      return 'Abierta';
    case 'pending':
      return 'Pendiente';
    case 'preparing':
      return 'Preparando';
    case 'ready':
      return 'Lista';
    case 'served':
      return 'Servida';
    default:
      return status || 'Sin estado';
  }
};

const userHasRole = (user: Employee, role: string) => {
  const roles = user.roles?.length ? user.roles : [user.role];
  return roles.includes(role as any);
};

export const PosSimulatorPage: React.FC<PosSimulatorPageProps> = ({ businessId }) => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [tables, setTables] = useState<BranchTable[]>([]);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [waiters, setWaiters] = useState<Employee[]>([]);
  const [selectedWaiterId, setSelectedWaiterId] = useState('');
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [kitchenTickets, setKitchenTickets] = useState<KitchenTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 4500);
  }, []);

  const selectedTable = useMemo(
    () => tables.find((table) => table.id === selectedTableId),
    [selectedTableId, tables],
  );

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId),
    [selectedProductId, products],
  );

  const activeOrderForTable = useMemo(
    () => activeOrders.find((order) => order.tableId === selectedTableId),
    [activeOrders, selectedTableId],
  );

  const selectedBranchOrders = useMemo(
    () => [...activeOrders].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')),
    [activeOrders],
  );

  const refreshBranchState = useCallback(async (branchId = selectedBranchId, silent = false) => {
    if (!branchId) return;
    if (!silent) setLoading(true);
    try {
      const [tableData, userData, orderData, ticketData] = await Promise.all([
        api.getBranchTables(branchId),
        api.getUsers(businessId, branchId),
        api.getActiveOrders(branchId),
        api.getActiveKitchenTickets(branchId),
      ]);

      setTables(tableData);
      const activeWaiters = userData.filter((user) => userHasRole(user, 'waiter'));
      setWaiters(activeWaiters);
      setActiveOrders(orderData);
      setKitchenTickets(ticketData);

      if (!selectedTableId && tableData.length > 0) {
        setSelectedTableId(tableData[0].id);
      }
      if (!selectedWaiterId) {
        const firstWaiter = activeWaiters[0];
        if (firstWaiter) setSelectedWaiterId(firstWaiter.id);
      }
    } catch (error: any) {
      showToast(error.message || 'No se pudo sincronizar el estado del POS.', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [businessId, selectedBranchId, selectedTableId, selectedWaiterId, showToast]);

  useEffect(() => {
    let mounted = true;
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const [branchData, productData] = await Promise.all([
          api.getBranches(businessId),
          api.getProducts(businessId),
        ]);
        if (!mounted) return;
        setBranches(branchData);
        setProducts(productData.filter((product) => product.isSellable !== false));
        if (branchData.length > 0) setSelectedBranchId(branchData[0].id);
        if (productData.length > 0) {
          const firstSellable = productData.find((product) => product.isSellable !== false);
          if (firstSellable) setSelectedProductId(firstSellable.id);
        }
      } catch (error: any) {
        showToast(error.message || 'No se pudo cargar la información base.', 'error');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadInitialData();
    return () => {
      mounted = false;
    };
  }, [businessId, showToast]);

  useEffect(() => {
    if (selectedBranchId) {
      refreshBranchState(selectedBranchId);
    }
  }, [selectedBranchId]);

  const handleCreateOrAddOrder = async () => {
    if (!selectedBranchId || !selectedTableId || !selectedProduct || !selectedWaiterId) {
      showToast('Selecciona sucursal, mesa, mesero y producto.', 'warning');
      return;
    }

    const grossUnit = Number(selectedProduct.price || 0);
    if (!Number.isFinite(grossUnit) || grossUnit <= 0) {
      showToast('El producto seleccionado no tiene precio de venta válido.', 'warning');
      return;
    }

    const netUnit = grossToNet(grossUnit);
    const subtotal = netUnit * quantity;
    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax;
    const item = {
      productId: selectedProduct.id,
      quantity,
      price: money(netUnit),
      assignedGuest: 1,
      notes: 'Simulador Business Control',
    };

    setBusy('waiter');
    try {
      const currentOrder = activeOrderForTable;
      const order = currentOrder
        ? await api.addOrderItems(currentOrder.id, [item])
        : await api.createOrder({
            branchId: selectedBranchId,
            tableId: selectedTableId,
            waiterId: selectedWaiterId,
            subtotal: money(subtotal),
            discount: '0.00',
            tax: money(tax),
            total: money(total),
            items: [item],
          });

      const orderId = currentOrder?.id || order.id;
      await api.sendOrderToKitchen(orderId);
      showToast(`Mesero envió ${quantity} x ${selectedProduct.name} a cocina.`);
      await refreshBranchState(selectedBranchId, true);
    } catch (error: any) {
      showToast(error.message || 'No se pudo enviar la orden.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleRequestBilling = async (orderId: string) => {
    setBusy(`billing-${orderId}`);
    try {
      await api.requestOrderBilling(orderId);
      showToast('Cuenta marcada como por cobrar.');
      await refreshBranchState(selectedBranchId, true);
    } catch (error: any) {
      showToast(error.message || 'No se pudo solicitar la cuenta.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const handlePayOrder = async (order: ActiveOrder, method: 'cash' | 'card') => {
    setBusy(`pay-${order.id}`);
    try {
      await api.payOrder(order.id, {
        amount: order.total,
        paymentMethod: method,
        referenceCode: method === 'card' ? 'Simulador BC - **** 5553' : 'Simulador BC efectivo',
      });
      showToast('Cajero cobró la orden y la mesa pasó a limpieza.');
      await refreshBranchState(selectedBranchId, true);
    } catch (error: any) {
      showToast(error.message || 'No se pudo cobrar la orden.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleKitchenStatus = async (ticketId: string, status: KitchenTicket['status']) => {
    setBusy(`ticket-${ticketId}-${status}`);
    try {
      await api.updateKitchenTicketStatus(ticketId, status);
      showToast(`Cocina cambió el ticket a ${statusLabel(status)}.`);
      await refreshBranchState(selectedBranchId, true);
    } catch (error: any) {
      showToast(error.message || 'No se pudo actualizar el ticket.', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 min-h-full lg:h-full overflow-y-auto lg:overflow-hidden animate-fade-in">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-aged-bronze/10 pb-4">
        <div>
          <Heading level={2} className="!border-none !pb-0 font-light !text-lg sm:!text-2xl">
            Simulador POS
          </Heading>
          <p className="text-sm text-text-secondary mt-1 font-sans">
            Ejecuta el flujo real de Mesero, Cocina y Cajero contra la sucursal seleccionada.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
          <select
            value={selectedBranchId}
            onChange={(event) => {
              setSelectedBranchId(event.target.value);
              setSelectedTableId('');
              setSelectedWaiterId('');
            }}
            className="px-3 py-2 bg-onyx-surface text-text-primary border border-aged-bronze/40 focus:border-champagne-gold rounded text-xs font-sans focus:outline-none min-w-[220px]"
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => refreshBranchState(selectedBranchId)}
            disabled={!selectedBranchId || loading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-aged-bronze/40 hover:border-champagne-gold/60 bg-onyx-surface hover:bg-charcoal-surface/60 rounded text-sm text-text-secondary hover:text-champagne-gold font-medium transition-all disabled:opacity-50"
          >
            <span className={loading ? 'animate-spin' : ''}>↻</span>
            <span>Sincronizar</span>
          </button>
        </div>
      </div>

      {toast && (
        <div className={`rounded border px-4 py-3 text-sm ${
          toast.type === 'error'
            ? 'border-error-red/40 bg-error-red/10 text-red-200'
            : toast.type === 'warning'
              ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-100'
              : 'border-green-500/40 bg-green-500/10 text-green-100'
        }`}>
          {toast.message}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 lg:flex-1 lg:min-h-0">
        <section className="bg-onyx-surface border border-aged-bronze/30 rounded p-5 flex flex-col gap-4">
          <div>
            <h3 className="text-champagne-gold text-sm uppercase tracking-widest font-semibold">Mesero</h3>
            <p className="text-xs text-text-secondary mt-1">Crea o agrega comandas y las manda a cocina.</p>
          </div>

          <label className="flex flex-col gap-2 text-xs text-text-secondary uppercase tracking-wider">
            Mesa
            <select
              value={selectedTableId}
              onChange={(event) => setSelectedTableId(event.target.value)}
              className="px-3 py-2 bg-charcoal-surface text-text-primary border border-aged-bronze/40 focus:border-champagne-gold rounded text-sm focus:outline-none"
            >
              {tables.map((table) => (
                <option key={table.id} value={table.id}>
                  {table.label} · {statusLabel(table.state)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-xs text-text-secondary uppercase tracking-wider">
            Mesero
            <select
              value={selectedWaiterId}
              onChange={(event) => setSelectedWaiterId(event.target.value)}
              className="px-3 py-2 bg-charcoal-surface text-text-primary border border-aged-bronze/40 focus:border-champagne-gold rounded text-sm focus:outline-none"
            >
              {waiters.map((waiter) => (
                <option key={waiter.id} value={waiter.id}>
                  {waiter.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-xs text-text-secondary uppercase tracking-wider">
            Producto
            <select
              value={selectedProductId}
              onChange={(event) => setSelectedProductId(event.target.value)}
              className="px-3 py-2 bg-charcoal-surface text-text-primary border border-aged-bronze/40 focus:border-champagne-gold rounded text-sm focus:outline-none"
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} · {formatCurrency(product.price)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-xs text-text-secondary uppercase tracking-wider">
            Cantidad
            <input
              type="number"
              min={1}
              max={20}
              value={quantity}
              onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
              className="px-3 py-2 bg-charcoal-surface text-text-primary border border-aged-bronze/40 focus:border-champagne-gold rounded text-sm focus:outline-none"
            />
          </label>

          <div className="mt-auto rounded border border-aged-bronze/20 bg-charcoal-surface/40 p-3 text-xs text-text-secondary">
            <div className="flex justify-between gap-3">
              <span>Mesa seleccionada</span>
              <span className="text-text-primary">{selectedTable?.label || '-'}</span>
            </div>
            <div className="flex justify-between gap-3 mt-1">
              <span>Orden activa</span>
              <span className="text-text-primary">{activeOrderForTable ? statusLabel(activeOrderForTable.state) : 'No'}</span>
            </div>
          </div>

          <button
            onClick={handleCreateOrAddOrder}
            disabled={busy === 'waiter' || !selectedTableId || !selectedProductId || !selectedWaiterId}
            className="w-full px-4 py-3 rounded bg-champagne-gold text-obsidian text-sm font-bold hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy === 'waiter' ? 'Enviando...' : 'Enviar Comanda'}
          </button>
        </section>

        <section className="bg-onyx-surface border border-aged-bronze/30 rounded p-5 flex flex-col gap-4 min-h-[420px]">
          <div>
            <h3 className="text-champagne-gold text-sm uppercase tracking-widest font-semibold">Cocina</h3>
            <p className="text-xs text-text-secondary mt-1">Lee tickets activos y cambia su estado.</p>
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
            {kitchenTickets.length === 0 ? (
              <div className="h-full min-h-[220px] flex items-center justify-center border border-dashed border-aged-bronze/25 rounded text-sm text-text-secondary">
                Sin tickets activos.
              </div>
            ) : (
              kitchenTickets.map((ticket) => (
                <div key={ticket.id} className="rounded border border-aged-bronze/25 bg-charcoal-surface/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-text-primary font-semibold">
                        {ticket.tableLabel || 'Mesa'} · {ticket.station}
                      </div>
                      <div className="text-xs text-text-secondary mt-1">{statusLabel(ticket.status)}</div>
                    </div>
                    <span className="text-[10px] uppercase tracking-widest text-aged-bronze">
                      {ticket.id.slice(0, 8)}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-col gap-1">
                    {ticket.items.map((item) => (
                      <div key={item.id} className="flex justify-between gap-3 text-xs">
                        <span className="text-text-primary">{item.quantity} x {item.productName || item.productId}</span>
                        <span className="text-text-secondary">G{item.assignedGuest || 1}</span>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4">
                    {(['preparing', 'ready', 'served'] as KitchenTicket['status'][]).map((status) => (
                      <button
                        key={status}
                        onClick={() => handleKitchenStatus(ticket.id, status)}
                        disabled={busy === `ticket-${ticket.id}-${status}`}
                        className="px-2 py-2 rounded border border-aged-bronze/30 text-[11px] text-text-secondary hover:text-champagne-gold hover:border-champagne-gold/50 disabled:opacity-50"
                      >
                        {statusLabel(status)}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="bg-onyx-surface border border-aged-bronze/30 rounded p-5 flex flex-col gap-4 min-h-[420px]">
          <div>
            <h3 className="text-champagne-gold text-sm uppercase tracking-widest font-semibold">Cajero</h3>
            <p className="text-xs text-text-secondary mt-1">Ve órdenes activas, solicita cuenta y cobra.</p>
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
            {selectedBranchOrders.length === 0 ? (
              <div className="h-full min-h-[220px] flex items-center justify-center border border-dashed border-aged-bronze/25 rounded text-sm text-text-secondary">
                Sin órdenes abiertas.
              </div>
            ) : (
              selectedBranchOrders.map((order) => {
                const table = tables.find((item) => item.id === order.tableId);
                return (
                  <div key={order.id} className="rounded border border-aged-bronze/25 bg-charcoal-surface/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm text-text-primary font-semibold">
                          {table?.label || 'Mesa'} · {statusLabel(order.state)}
                        </div>
                        <div className="text-xs text-text-secondary mt-1">
                          {order.items.length} partidas · IVA {formatCurrency(order.tax)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-champagne-gold font-semibold">{formatCurrency(order.total)}</div>
                        <div className="text-[10px] text-text-secondary">{order.id.slice(0, 8)}</div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-col gap-1">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex justify-between gap-3 text-xs">
                          <span className="text-text-primary">{item.quantity} x {item.productName || item.productId.slice(0, 8)}</span>
                          <span className="text-text-secondary">{formatCurrency(Number(item.price) * item.quantity)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-4">
                      <button
                        onClick={() => handleRequestBilling(order.id)}
                        disabled={order.state !== 'open' || busy === `billing-${order.id}`}
                        className="px-2 py-2 rounded border border-aged-bronze/30 text-[11px] text-text-secondary hover:text-champagne-gold hover:border-champagne-gold/50 disabled:opacity-40"
                      >
                        Cuenta
                      </button>
                      <button
                        onClick={() => handlePayOrder(order, 'cash')}
                        disabled={busy === `pay-${order.id}`}
                        className="px-2 py-2 rounded border border-aged-bronze/30 text-[11px] text-text-secondary hover:text-champagne-gold hover:border-champagne-gold/50 disabled:opacity-40"
                      >
                        Efectivo
                      </button>
                      <button
                        onClick={() => handlePayOrder(order, 'card')}
                        disabled={busy === `pay-${order.id}`}
                        className="px-2 py-2 rounded border border-aged-bronze/30 text-[11px] text-text-secondary hover:text-champagne-gold hover:border-champagne-gold/50 disabled:opacity-40"
                      >
                        Tarjeta
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
