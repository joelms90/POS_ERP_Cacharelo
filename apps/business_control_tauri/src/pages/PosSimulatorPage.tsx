import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActiveOrder,
  api,
  Branch,
  BranchTable,
  Category,
  Employee,
  KitchenTicket,
  Product,
} from '../services/api';
import { Heading } from '../components/atoms/Heading';
import { Badge } from '../components/atoms/Badge';

interface PosSimulatorPageProps {
  businessId: string;
}

type ToastType = 'success' | 'error' | 'warning';
type CorteSimulationType = 'x' | 'z';
type RolePerspective = 'waiter' | 'kitchen' | 'cashier' | 'admin';

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
    case 'free':
      return 'Disponible';
    case 'occupied':
      return 'Ocupada';
    case 'billing':
      return 'Por cobrar';
    case 'cleaning':
      return 'En Limpieza';
    case 'open':
      return 'Abierta';
    case 'pending':
      return 'Pendiente';
    case 'preparing':
      return 'En preparación';
    case 'ready':
      return 'Lista para servir';
    case 'served':
      return 'Servida';
    case 'closed':
      return 'Cerrada';
    default:
      return status || 'Sin estado';
  }
};

const statusBadgeVariant = (status?: string): 'success' | 'warning' | 'error' | 'info' | 'gold' | 'bronze' => {
  switch (status) {
    case 'available':
    case 'free':
    case 'ready':
      return 'success';
    case 'occupied':
    case 'preparing':
      return 'warning';
    case 'billing':
      return 'gold';
    case 'cleaning':
      return 'bronze';
    case 'pending':
      return 'warning';
    case 'served':
      return 'info';
    default:
      return 'info';
  }
};

const roleTranslate = (role: string) => {
  switch (role) {
    case 'waiter':
      return 'Mesero';
    case 'cashier':
      return 'Cajero';
    case 'kitchen':
      return 'Cocina';
    case 'admin':
      return 'Admin';
    case 'owner':
      return 'Propietario';
    case 'encargado':
      return 'Encargado';
    case 'vendedor':
      return 'Vendedor';
    case 'inventory_admin':
      return 'Inventario';
    case 'support_tech':
      return 'Soporte';
    default:
      return role;
  }
};

const userHasRole = (user: Employee, role: string) => {
  const roles = user.roles?.length ? user.roles : [user.role];
  return roles.includes(role as any);
};

interface CartItem {
  product: Product;
  quantity: number;
  notes: string;
  guest: number;
}

const buildCorteSimulation = (
  type: CorteSimulationType,
  branchName: string,
  cashierName: string,
) => {
  const openedAt = new Date(Date.now() - 1000 * 60 * 60 * 6);
  const generatedAt = new Date();
  const initialFloat = 1000;
  const cashSales = 1840;
  const cardSales = 1265;
  const otherSales = 0;
  const manualCashIn = 250;
  const manualCashOut = 400;
  const expectedCash = initialFloat + cashSales + manualCashIn - manualCashOut;
  const denominationCounts = {
    '500': 3,
    '200': 4,
    '100': 2,
    '50': 1,
    '20': 7,
  };
  const actualCash =
    type === 'z'
      ? Object.entries(denominationCounts).reduce(
          (sum, [value, count]) => sum + Number(value) * count,
          0,
        )
      : null;
  const cashDifference = actualCash === null ? null : actualCash - expectedCash;
  const title =
    type === 'x' ? 'Corte X - Arqueo Parcial' : 'Corte Z - Cierre de Caja';
  const snapshot = {
    shiftInfo: {
      id: 'sim_shift_0001',
      cashierName,
      branchName,
      status: type === 'x' ? 'open' : 'closed',
      openedAt: openedAt.toISOString(),
      closedAt: type === 'z' ? generatedAt.toISOString() : null,
    },
    summary: {
      initialFloat,
      cashSales,
      cardSales,
      otherSales,
      totalSales: cashSales + cardSales + otherSales,
      manualCashIn,
      manualCashOut,
      expectedCash,
      actualCash,
      cashDifference,
    },
    salesByPaymentMethod: [
      { paymentMethod: 'cash', total: cashSales, count: 12 },
      { paymentMethod: 'card', total: cardSales, count: 7 },
    ],
    cashMovements: [
      {
        type: 'cash-in',
        amount: manualCashIn,
        reason: 'Cambio adicional',
        createdAt: new Date(openedAt.getTime() + 1000 * 60 * 90).toISOString(),
      },
      {
        type: 'cash-out',
        amount: manualCashOut,
        reason: 'Retiro a administracion',
        createdAt: new Date(openedAt.getTime() + 1000 * 60 * 220).toISOString(),
      },
    ],
    denominationCounts: type === 'z' ? denominationCounts : null,
    closeNotes:
      type === 'z'
        ? 'Simulacion: el cajero documenta la diferencia antes de cerrar.'
        : null,
    generatedAt: generatedAt.toISOString(),
    simulated: true,
  };

  const ticketLines = [
    title.toUpperCase(),
    `Fecha: ${generatedAt.toLocaleString('es-MX')}`,
    `Sucursal: ${branchName}`,
    `Operador: ${cashierName}`,
    `Apertura: ${openedAt.toLocaleString('es-MX')}`,
    type === 'z' ? `Cierre: ${generatedAt.toLocaleString('es-MX')}` : '',
    '',
    'VENTAS',
    `Efectivo: ${formatCurrency(cashSales)}`,
    `Tarjeta: ${formatCurrency(cardSales)}`,
    `Otros: ${formatCurrency(otherSales)}`,
    `Total ventas: ${formatCurrency(cashSales + cardSales + otherSales)}`,
    '',
    'EFECTIVO EN CAJA',
    `Fondo inicial: ${formatCurrency(initialFloat)}`,
    `Ventas efectivo: ${formatCurrency(cashSales)}`,
    `Ingresos: ${formatCurrency(manualCashIn)}`,
    `Retiros: ${formatCurrency(manualCashOut)}`,
    `Esperado sistema: ${formatCurrency(expectedCash)}`,
    type === 'z' ? `Contado fisico: ${formatCurrency(actualCash || 0)}` : '',
    type === 'z' ? `Diferencia: ${formatCurrency(cashDifference || 0)}` : '',
    type === 'z' ? '' : '',
    type === 'z' ? 'DENOMINACIONES' : '',
    ...(type === 'z'
      ? Object.entries(denominationCounts).map(
          ([value, count]) =>
            `$${value} x ${count} = ${formatCurrency(Number(value) * count)}`,
        )
      : []),
    '',
    'MOVIMIENTOS',
    `cash-in ${formatCurrency(manualCashIn)} - Cambio adicional`,
    `cash-out ${formatCurrency(manualCashOut)} - Retiro a administracion`,
    type === 'z' ? '' : '',
    type === 'z' ? 'NOTAS' : '',
    type === 'z'
      ? 'Simulacion: el cajero documenta la diferencia antes de cerrar.'
      : '',
  ].filter((line, index, lines) => line !== '' || lines[index - 1] !== '');

  return {
    type,
    title,
    ticket: ticketLines.join('\n'),
    snapshot,
  };
};

export const PosSimulatorPage: React.FC<PosSimulatorPageProps> = ({ businessId }) => {
  // Main Data
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [isChangingEmployee, setIsChangingEmployee] = useState(false);
  const [employeeFilterRole, setEmployeeFilterRole] = useState<'all' | 'waiter' | 'cashier' | 'kitchen'>('all');

  // Role perspective being simulated
  const [activeRolePerspective, setActiveRolePerspective] = useState<RolePerspective>('waiter');

  // Operational State
  const [tables, setTables] = useState<BranchTable[]>([]);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<string>('all');
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [kitchenTickets, setKitchenTickets] = useState<KitchenTicket[]>([]);

  // Menu and Cart for Waiter Mode
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [menuSearch, setMenuSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);

  // Cashier Mode State
  const [payingOrder, setPayingOrder] = useState<ActiveOrder | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [receivedCash, setReceivedCash] = useState<string>('');
  const [cardAuthCode, setCardAuthCode] = useState('AUTH-' + Math.floor(100000 + Math.random() * 900000));
  const [corteSimulation, setCorteSimulation] = useState<ReturnType<typeof buildCorteSimulation> | null>(null);

  // Status and Loading
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 4500);
  }, []);

  const selectedBranch = useMemo(
    () => branches.find((b) => b.id === selectedBranchId),
    [branches, selectedBranchId],
  );

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === selectedEmployeeId),
    [employees, selectedEmployeeId],
  );

  const selectedTable = useMemo(
    () => tables.find((table) => table.id === selectedTableId),
    [selectedTableId, tables],
  );

  const activeOrderForTable = useMemo(
    () => activeOrders.find((order) => order.tableId === selectedTableId),
    [activeOrders, selectedTableId],
  );

  const rooms = useMemo(() => {
    const list = Array.from(new Set(tables.map((t) => t.room || 'General')));
    return list;
  }, [tables]);

  const filteredTables = useMemo(() => {
    if (selectedRoom === 'all') return tables;
    return tables.filter((t) => (t.room || 'General') === selectedRoom);
  }, [tables, selectedRoom]);

  // Sync Branch Data
  const refreshBranchState = useCallback(
    async (branchId = selectedBranchId, silent = false) => {
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
        setEmployees(userData);
        setActiveOrders(orderData);
        setKitchenTickets(ticketData);

        // Auto select first table if none selected
        if (!selectedTableId && tableData.length > 0) {
          setSelectedTableId(tableData[0].id);
        }

        // Auto select first employee if none selected
        if (!selectedEmployeeId && userData.length > 0) {
          // Prefer a waiter or cashier
          const preferred =
            userData.find((u) => userHasRole(u, 'waiter')) ||
            userData.find((u) => userHasRole(u, 'cashier')) ||
            userData[0];
          setSelectedEmployeeId(preferred.id);
          if (userHasRole(preferred, 'cashier') && !userHasRole(preferred, 'waiter')) {
            setActiveRolePerspective('cashier');
          } else if (userHasRole(preferred, 'kitchen') && !userHasRole(preferred, 'waiter')) {
            setActiveRolePerspective('kitchen');
          } else {
            setActiveRolePerspective('waiter');
          }
        }
      } catch (error: any) {
        showToast(error.message || 'No se pudo sincronizar el estado de la sucursal.', 'error');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [businessId, selectedBranchId, selectedEmployeeId, selectedTableId, showToast],
  );

  // Initial Load (Branches, Products, Categories)
  useEffect(() => {
    let mounted = true;
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const [branchData, productData, categoryData] = await Promise.all([
          api.getBranches(businessId),
          api.getProducts(businessId),
          api.getCategories(businessId),
        ]);
        if (!mounted) return;
        setBranches(branchData);
        setProducts(productData.filter((p) => p.isSellable !== false));
        setCategories(categoryData);

        if (branchData.length > 0) {
          setSelectedBranchId(branchData[0].id);
        }
      } catch (error: any) {
        showToast(error.message || 'No se pudo cargar la información inicial.', 'error');
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

  // When selected employee changes, adjust default perspective if appropriate
  const handleSelectEmployee = (emp: Employee) => {
    setSelectedEmployeeId(emp.id);
    setIsChangingEmployee(false);
    if (userHasRole(emp, 'waiter')) {
      setActiveRolePerspective('waiter');
    } else if (userHasRole(emp, 'cashier')) {
      setActiveRolePerspective('cashier');
    } else if (userHasRole(emp, 'kitchen')) {
      setActiveRolePerspective('kitchen');
    } else {
      setActiveRolePerspective('admin');
    }
    showToast(`Simulando ahora como: ${emp.name} (${roleTranslate(emp.role)})`);
  };

  // Cart operations
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [
        ...prev,
        {
          product,
          quantity: 1,
          notes: '',
          guest: 1,
        },
      ];
    });
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[],
    );
  };

  const updateCartNotes = (productId: string, notes: string) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, notes } : item,
      ),
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => setCart([]);

  // Financial calculations for the cart
  const cartSummary = useMemo(() => {
    const grossTotal = cart.reduce((sum, item) => {
      const price = Number(item.product.price || 0);
      return sum + price * item.quantity;
    }, 0);

    const netSubtotal = grossToNet(grossTotal);
    const tax = netSubtotal * TAX_RATE;
    return {
      subtotal: netSubtotal,
      tax,
      total: grossTotal,
      itemCount: cart.reduce((count, item) => count + item.quantity, 0),
    };
  }, [cart]);

  // Submit Comanda (Create Order or Add Items + Send to Kitchen)
  const handleSendComanda = async () => {
    if (!selectedBranchId || !selectedTableId || cart.length === 0) {
      showToast('Selecciona mesa y agrega productos a la comanda.', 'warning');
      return;
    }

    const waiterId =
      selectedEmployee?.id ||
      employees.find((e) => userHasRole(e, 'waiter'))?.id ||
      employees[0]?.id;

    if (!waiterId) {
      showToast('No hay empleado activo asignado como mesero.', 'warning');
      return;
    }

    const payloadItems = cart.map((item) => {
      const grossUnit = Number(item.product.price || 0);
      const netUnit = grossToNet(grossUnit);
      return {
        productId: item.product.id,
        quantity: item.quantity,
        price: money(netUnit),
        assignedGuest: item.guest || 1,
        notes: item.notes || `Pedido vía ${selectedEmployee?.name || 'Mesero'}`,
      };
    });

    setBusy('comanda');
    try {
      const currentOrder = activeOrderForTable;
      let orderId = currentOrder?.id;

      if (currentOrder) {
        await api.addOrderItems(currentOrder.id, payloadItems);
      } else {
        const newOrder = await api.createOrder({
          branchId: selectedBranchId,
          tableId: selectedTableId,
          waiterId,
          subtotal: money(cartSummary.subtotal),
          discount: '0.00',
          tax: money(cartSummary.tax),
          total: money(cartSummary.total),
          items: payloadItems,
        });
        orderId = newOrder.id;
      }

      if (orderId) {
        await api.sendOrderToKitchen(orderId);
      }

      showToast(
        `¡Comanda enviada a cocina! (${cartSummary.itemCount} productos para ${selectedTable?.label || 'Mesa'})`,
        'success',
      );
      clearCart();
      await refreshBranchState(selectedBranchId, true);
    } catch (error: any) {
      showToast(error.message || 'Error al enviar la comanda.', 'error');
    } finally {
      setBusy(null);
    }
  };

  // Kitchen Actions
  const handleKitchenStatus = async (ticketId: string, status: KitchenTicket['status']) => {
    setBusy(`ticket-${ticketId}-${status}`);
    try {
      await api.updateKitchenTicketStatus(ticketId, status);
      showToast(`Ticket actualizado a: ${statusLabel(status)}`);
      await refreshBranchState(selectedBranchId, true);
    } catch (error: any) {
      showToast(error.message || 'No se pudo actualizar el ticket de cocina.', 'error');
    } finally {
      setBusy(null);
    }
  };

  // Cashier Actions
  const handleRequestBilling = async (orderId: string) => {
    setBusy(`billing-${orderId}`);
    try {
      await api.requestOrderBilling(orderId);
      showToast('Pre-cuenta solicitada. La mesa ahora está por cobrar.');
      await refreshBranchState(selectedBranchId, true);
    } catch (error: any) {
      showToast(error.message || 'No se pudo solicitar la cuenta.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleOpenPaymentModal = (order: ActiveOrder) => {
    setPayingOrder(order);
    setPaymentMethod('cash');
    setReceivedCash(order.total);
    setCardAuthCode('AUTH-' + Math.floor(100000 + Math.random() * 900000));
  };

  const handleConfirmPayment = async () => {
    if (!payingOrder) return;
    setBusy(`pay-${payingOrder.id}`);
    try {
      await api.payOrder(payingOrder.id, {
        amount: payingOrder.total,
        paymentMethod,
        referenceCode:
          paymentMethod === 'card'
            ? cardAuthCode
            : `Cobrado por ${selectedEmployee?.name || 'Cajero'}`,
      });
      showToast(
        `Cobro exitoso de ${formatCurrency(payingOrder.total)}. Mesa lista para limpieza.`,
        'success',
      );
      setPayingOrder(null);
      await refreshBranchState(selectedBranchId, true);
    } catch (error: any) {
      showToast(error.message || 'Error al registrar el cobro.', 'error');
    } finally {
      setBusy(null);
    }
  };

  // Mark table as clean/available
  const handleCleanTable = async (tableId: string) => {
    setBusy(`clean-${tableId}`);
    try {
      await api.updateBranchTable(selectedBranchId, tableId, { state: 'available' });
      showToast('Mesa limpiada y lista para recibir nuevos comensales.');
      await refreshBranchState(selectedBranchId, true);
    } catch (error: any) {
      showToast(error.message || 'No se pudo actualizar el estado de la mesa.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleSimulateCorte = (type: CorteSimulationType) => {
    const branchName = selectedBranch?.name || 'Sucursal simulada';
    const cashierName = selectedEmployee?.name || 'Cajero Simulador';
    setCorteSimulation(buildCorteSimulation(type, branchName, cashierName));
  };

  // Filtered Products for Menu
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat =
        selectedCategoryId === 'all' || p.categoryId === selectedCategoryId;
      const matchSearch =
        !menuSearch.trim() ||
        p.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
        (p.barcode && p.barcode.includes(menuSearch));
      return matchCat && matchSearch;
    });
  }, [products, selectedCategoryId, menuSearch]);

  // Filtered Employees in Selector
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (employeeFilterRole === 'all') return true;
      return userHasRole(emp, employeeFilterRole);
    });
  }, [employees, employeeFilterRole]);

  return (
    <div className="flex flex-col gap-4 min-h-full lg:h-full overflow-y-auto lg:overflow-hidden animate-fade-in text-text-primary">
      {/* Title & Introduction */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-aged-bronze/15 pb-2">
        <div>
          <Heading level={2} className="!border-none !pb-0 font-light !text-lg sm:!text-2xl text-champagne-gold">
            Simulador POS Multi-Rol
          </Heading>
          <p className="text-xs text-text-secondary mt-0.5 font-sans">
            Prueba el ciclo operativo completo: Elige la sucursal y empleado a simular, comanda desde el menú interactivo, atiende en cocina y cobra en caja.
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. TOP HEADER: Sucursal & Empleado Activo                                  */}
      {/* ========================================================================= */}
      <div className="bg-onyx-surface border border-aged-bronze/30 rounded-lg p-4 shadow-md flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
        {/* Branch Info & Switcher */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏪</span>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-text-secondary font-bold block">
                Sucursal Activa
              </span>
              <select
                value={selectedBranchId}
                onChange={(e) => {
                  setSelectedBranchId(e.target.value);
                  setSelectedTableId('');
                  setSelectedEmployeeId('');
                }}
                className="bg-charcoal-surface text-text-primary border border-aged-bronze/40 focus:border-champagne-gold rounded px-3 py-1.5 text-sm font-semibold focus:outline-none"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="h-8 w-px bg-aged-bronze/20 hidden sm:block" />

          {/* Quick Metrics */}
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <span className="bg-charcoal-surface/60 border border-aged-bronze/20 px-2.5 py-1 rounded">
              🪑 <strong>{tables.length}</strong> Mesas
            </span>
            <span className="bg-charcoal-surface/60 border border-aged-bronze/20 px-2.5 py-1 rounded">
              🧾 <strong>{activeOrders.length}</strong> Órdenes abiertas
            </span>
            <span className="bg-charcoal-surface/60 border border-aged-bronze/20 px-2.5 py-1 rounded">
              🍳 <strong>{kitchenTickets.length}</strong> Tickets cocina
            </span>
          </div>
        </div>

        {/* Employee Simulation Badge & Switcher */}
        <div className="flex items-center gap-3 bg-charcoal-surface/70 border border-aged-bronze/30 rounded-lg px-3 py-2">
          {selectedEmployee ? (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-champagne-gold/20 border border-champagne-gold/60 flex items-center justify-center text-champagne-gold font-bold text-sm">
                {selectedEmployee.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-secondary">Simulando como:</span>
                  <span className="text-sm font-bold text-champagne-gold">
                    {selectedEmployee.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {(selectedEmployee.roles?.length
                    ? selectedEmployee.roles
                    : [selectedEmployee.role]
                  ).map((r) => (
                    <Badge key={r} variant="gold" className="text-[10px] py-0 px-1.5">
                      {roleTranslate(r)}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-text-secondary flex items-center gap-2">
              <span className="animate-pulse text-champagne-gold">●</span>
              <span>Sin empleado seleccionado</span>
            </div>
          )}

          <button
            onClick={() => setIsChangingEmployee(true)}
            className="ml-auto sm:ml-2 px-3 py-1.5 rounded bg-aged-bronze/20 hover:bg-champagne-gold hover:text-obsidian text-text-primary text-xs font-semibold border border-aged-bronze/40 transition-all flex items-center gap-1.5"
          >
            <span>🔄</span>
            <span>{selectedEmployee ? 'Cambiar Empleado' : 'Elegir Empleado'}</span>
          </button>

          <button
            onClick={() => refreshBranchState(selectedBranchId)}
            disabled={loading}
            title="Refrescar datos del servidor"
            className="p-1.5 rounded hover:bg-aged-bronze/20 text-text-secondary hover:text-champagne-gold transition-colors"
          >
            <span className={loading ? 'inline-block animate-spin' : ''}>↻</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. ROLE PERSPECTIVE TABS (Mesero, Cocina, Cajero, etc.)                   */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-aged-bronze/20 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-text-secondary font-semibold mr-1">
            Perspectiva:
          </span>

          <button
            onClick={() => setActiveRolePerspective('waiter')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs sm:text-sm font-bold transition-all ${
              activeRolePerspective === 'waiter'
                ? 'bg-champagne-gold text-obsidian shadow-md'
                : 'bg-onyx-surface text-text-secondary hover:text-text-primary hover:bg-charcoal-surface border border-aged-bronze/30'
            }`}
          >
            <span>🍽️</span>
            <span>Mesero (Comandar y Menú)</span>
          </button>

          <button
            onClick={() => setActiveRolePerspective('kitchen')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs sm:text-sm font-bold transition-all relative ${
              activeRolePerspective === 'kitchen'
                ? 'bg-champagne-gold text-obsidian shadow-md'
                : 'bg-onyx-surface text-text-secondary hover:text-text-primary hover:bg-charcoal-surface border border-aged-bronze/30'
            }`}
          >
            <span>🍳</span>
            <span>Cocina (KDS)</span>
            {kitchenTickets.length > 0 && (
              <span className="bg-error-red text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                {kitchenTickets.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveRolePerspective('cashier')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs sm:text-sm font-bold transition-all relative ${
              activeRolePerspective === 'cashier'
                ? 'bg-champagne-gold text-obsidian shadow-md'
                : 'bg-onyx-surface text-text-secondary hover:text-text-primary hover:bg-charcoal-surface border border-aged-bronze/30'
            }`}
          >
            <span>💵</span>
            <span>Cajero (Caja & Cobros)</span>
            {activeOrders.length > 0 && (
              <span className="bg-champagne-gold/30 text-champagne-gold text-[10px] font-extrabold px-1.5 py-0.2 rounded-full border border-champagne-gold/50">
                {activeOrders.length}
              </span>
            )}
          </button>
        </div>

        {/* Quick simulator helper step indicator */}
        <div className="hidden lg:flex items-center gap-2 text-[11px] text-text-secondary">
          <span className="text-champagne-gold font-mono">Paso a paso:</span>
          <span>1. Mesero crea comanda</span>
          <span>➔</span>
          <span>2. Cocina prepara</span>
          <span>➔</span>
          <span>3. Cajero cobra</span>
        </div>
      </div>

      {/* Global Toast */}
      {toast && (
        <div
          className={`rounded border px-4 py-2.5 text-xs sm:text-sm flex items-center justify-between gap-3 shadow-lg ${
            toast.type === 'error'
              ? 'border-error-red/40 bg-error-red/10 text-red-200'
              : toast.type === 'warning'
                ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-100'
                : 'border-green-500/40 bg-green-500/10 text-green-100'
          }`}
        >
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="text-white/60 hover:text-white font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MAIN WORKSPACE VIEW ACCORDING TO ACTIVE PERSPECTIVE                     */}
      {/* ========================================================================= */}

      {/* ------------------------------------------------------------------------- */}
      {/* A. MESERO PERSPECTIVE: Table Selector + Menu Explorer + Order Cart        */}
      {/* ------------------------------------------------------------------------- */}
      {activeRolePerspective === 'waiter' && (
        <div className="flex-1 flex flex-col lg:flex-row gap-5 min-h-0 overflow-y-auto lg:overflow-hidden">
          {/* Left / Center Section: Tables & Menu Explorer */}
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
            {/* Table Selection Bar */}
            <div className="bg-onyx-surface border border-aged-bronze/30 rounded-lg p-3.5 flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-champagne-gold uppercase tracking-wider">
                    Mesas de la Sucursal
                  </span>
                  <span className="text-xs text-text-secondary">
                    (Selecciona una mesa para comensales)
                  </span>
                </div>

                {/* Room Filter Pills */}
                {rooms.length > 1 && (
                  <div className="flex items-center gap-1 text-xs">
                    <button
                      onClick={() => setSelectedRoom('all')}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        selectedRoom === 'all'
                          ? 'bg-champagne-gold text-obsidian'
                          : 'bg-charcoal-surface text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      Todas
                    </button>
                    {rooms.map((r) => (
                      <button
                        key={r}
                        onClick={() => setSelectedRoom(r)}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          selectedRoom === r
                            ? 'bg-champagne-gold text-obsidian'
                            : 'bg-charcoal-surface text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Table Grid / Badges */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-2 max-h-36 overflow-y-auto p-1">
                {filteredTables.map((tbl) => {
                  const hasOrder = activeOrders.some((o) => o.tableId === tbl.id);
                  const isSelected = tbl.id === selectedTableId;
                  const isCleaning = tbl.state === 'cleaning';

                  return (
                    <button
                      key={tbl.id}
                      onClick={() => setSelectedTableId(tbl.id)}
                      className={`p-2 rounded border text-left flex flex-col justify-between transition-all relative ${
                        isSelected
                          ? 'border-champagne-gold bg-champagne-gold/15 shadow-sm scale-102 ring-1 ring-champagne-gold'
                          : 'border-aged-bronze/30 bg-charcoal-surface/60 hover:border-champagne-gold/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold truncate text-text-primary">
                          {tbl.label}
                        </span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isCleaning
                              ? 'bg-purple-400'
                              : hasOrder
                                ? 'bg-amber-400 animate-pulse'
                                : 'bg-emerald-400'
                          }`}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-text-secondary mt-1">
                        <span>{tbl.room || 'General'}</span>
                        <span>{statusLabel(tbl.state)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Table Status Bar */}
              {selectedTable && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-aged-bronze/15 pt-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-text-secondary">Mesa activa:</span>
                    <strong className="text-champagne-gold text-sm">
                      {selectedTable.label}
                    </strong>
                    <Badge variant={statusBadgeVariant(selectedTable.state)}>
                      {statusLabel(selectedTable.state)}
                    </Badge>
                    {activeOrderForTable && (
                      <span className="text-[11px] text-amber-300 bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 rounded">
                        Tiene orden activa: {formatCurrency(activeOrderForTable.total)}
                      </span>
                    )}
                  </div>

                  {selectedTable.state === 'cleaning' && (
                    <button
                      onClick={() => handleCleanTable(selectedTable.id)}
                      disabled={busy === `clean-${selectedTable.id}`}
                      className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-all"
                    >
                      🧹 Marcar Mesa Limpia y Lista
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Interactive Menu Explorer */}
            <div className="bg-onyx-surface border border-aged-bronze/30 rounded-lg p-4 flex-1 flex flex-col gap-3 min-h-[400px]">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📖</span>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-champagne-gold">
                      Menú Cafetería Cacharelo
                    </h3>
                    <p className="text-[11px] text-text-secondary">
                      Selecciona productos para armar la comanda del mesero.
                    </p>
                  </div>
                </div>

                {/* Product Search */}
                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="Buscar platillo o bebida..."
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    className="w-full bg-charcoal-surface text-text-primary placeholder:text-text-secondary/50 border border-aged-bronze/30 focus:border-champagne-gold rounded px-3 py-1.5 text-xs focus:outline-none"
                  />
                  {menuSearch && (
                    <button
                      onClick={() => setMenuSearch('')}
                      className="absolute right-2.5 top-1.5 text-xs text-text-secondary hover:text-white"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-thin">
                <button
                  onClick={() => setSelectedCategoryId('all')}
                  className={`px-3 py-1 rounded-full whitespace-nowrap text-xs font-semibold transition-all ${
                    selectedCategoryId === 'all'
                      ? 'bg-champagne-gold text-obsidian shadow'
                      : 'bg-charcoal-surface text-text-secondary hover:text-text-primary hover:bg-charcoal-surface/80 border border-aged-bronze/20'
                  }`}
                >
                  Todos ({products.length})
                </button>
                {categories.map((cat) => {
                  const count = products.filter((p) => p.categoryId === cat.id).length;
                  if (count === 0) return null;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className={`px-3 py-1 rounded-full whitespace-nowrap text-xs font-semibold transition-all ${
                        selectedCategoryId === cat.id
                          ? 'bg-champagne-gold text-obsidian shadow'
                          : 'bg-charcoal-surface text-text-secondary hover:text-text-primary hover:bg-charcoal-surface/80 border border-aged-bronze/20'
                      }`}
                    >
                      {cat.name} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Dish Cards Grid */}
              <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 p-1">
                {filteredProducts.length === 0 ? (
                  <div className="col-span-full h-48 flex flex-col items-center justify-center text-text-secondary border border-dashed border-aged-bronze/20 rounded-lg">
                    <span>No se encontraron productos en esta categoría o búsqueda.</span>
                  </div>
                ) : (
                  filteredProducts.map((p) => {
                    const inCart = cart.find((item) => item.product.id === p.id);
                    const category = categories.find((c) => c.id === p.categoryId);

                    return (
                      <div
                        key={p.id}
                        className={`rounded-lg border bg-charcoal-surface/60 overflow-hidden flex flex-col justify-between transition-all hover:border-champagne-gold/60 ${
                          inCart
                            ? 'border-champagne-gold/60 ring-1 ring-champagne-gold/40'
                            : 'border-aged-bronze/25'
                        }`}
                      >
                        {/* Image banner */}
                        <div className="h-28 bg-black/40 relative overflow-hidden flex items-center justify-center">
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <span className="text-3xl opacity-40">☕</span>
                          )}
                          {category && (
                            <span className="absolute top-1.5 left-1.5 bg-black/70 backdrop-blur-xs text-[10px] text-champagne-gold px-2 py-0.5 rounded font-medium">
                              {category.name}
                            </span>
                          )}
                          {inCart && (
                            <span className="absolute top-1.5 right-1.5 bg-champagne-gold text-obsidian text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shadow">
                              {inCart.quantity} en comanda
                            </span>
                          )}
                        </div>

                        {/* Product Info */}
                        <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                          <div>
                            <h4 className="text-xs font-bold text-text-primary line-clamp-2 leading-tight">
                              {p.name}
                            </h4>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-aged-bronze/15">
                            <span className="text-sm font-bold text-champagne-gold">
                              {formatCurrency(p.price)}
                            </span>
                            <button
                              onClick={() => addToCart(p)}
                              className="px-2.5 py-1 rounded bg-champagne-gold/20 hover:bg-champagne-gold text-champagne-gold hover:text-obsidian text-xs font-bold transition-all border border-champagne-gold/40"
                            >
                              + Agregar
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Section: Comanda Pad / Order Cart */}
          <div className="w-full lg:w-96 bg-onyx-surface border border-aged-bronze/30 rounded-lg p-4 flex flex-col justify-between shadow-lg">
            <div>
              <div className="flex items-start justify-between border-b border-aged-bronze/20 pb-3">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-text-secondary font-bold block">
                    Comanda en Construcción
                  </span>
                  <h3 className="text-sm font-bold text-champagne-gold flex items-center gap-1.5">
                    <span>📝</span>
                    <span>{selectedTable?.label || 'Sin Mesa'}</span>
                  </h3>
                </div>
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-[11px] text-text-secondary hover:text-error-red underline"
                  >
                    Vaciar
                  </button>
                )}
              </div>

              {/* Waiter signature */}
              <div className="flex items-center justify-between text-xs py-2 text-text-secondary border-b border-aged-bronze/10">
                <span>Mesero que atiende:</span>
                <span className="font-semibold text-text-primary">
                  {selectedEmployee?.name || 'Mesero General'}
                </span>
              </div>

              {/* Items List */}
              <div className="my-3 flex flex-col gap-2.5 max-h-[360px] overflow-y-auto pr-1">
                {cart.length === 0 ? (
                  <div className="h-44 flex flex-col items-center justify-center text-center text-text-secondary border border-dashed border-aged-bronze/20 rounded p-4">
                    <span className="text-2xl mb-1">🛒</span>
                    <span className="text-xs">La comanda está vacía.</span>
                    <span className="text-[11px] text-text-secondary/70 mt-1">
                      Haz clic en "+ Agregar" sobre los platillos del menú.
                    </span>
                  </div>
                ) : (
                  cart.map((item) => {
                    const price = Number(item.product.price || 0);
                    const lineTotal = price * item.quantity;

                    return (
                      <div
                        key={item.product.id}
                        className="bg-charcoal-surface/60 border border-aged-bronze/20 rounded p-2.5 flex flex-col gap-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <h5 className="text-xs font-semibold text-text-primary leading-snug">
                              {item.product.name}
                            </h5>
                            <span className="text-[11px] text-champagne-gold font-bold">
                              {formatCurrency(price)} c/u
                            </span>
                          </div>
                          <span className="text-xs font-bold text-text-primary">
                            {formatCurrency(lineTotal)}
                          </span>
                        </div>

                        {/* Controls & Notes */}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-aged-bronze/10">
                          {/* Qty +/- */}
                          <div className="flex items-center gap-1 bg-black/30 rounded border border-aged-bronze/20 px-1 py-0.5">
                            <button
                              onClick={() => updateCartQty(item.product.id, -1)}
                              className="w-5 h-5 flex items-center justify-center rounded hover:bg-aged-bronze/30 text-xs font-bold"
                            >
                              -
                            </button>
                            <span className="w-6 text-center text-xs font-bold text-champagne-gold">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateCartQty(item.product.id, 1)}
                              className="w-5 h-5 flex items-center justify-center rounded hover:bg-aged-bronze/30 text-xs font-bold"
                            >
                              +
                            </button>
                          </div>

                          {/* Notes */}
                          <input
                            type="text"
                            placeholder="Nota: Sin cebolla, etc."
                            value={item.notes}
                            onChange={(e) =>
                              updateCartNotes(item.product.id, e.target.value)
                            }
                            className="flex-1 bg-black/20 border border-aged-bronze/20 rounded px-2 py-0.5 text-[11px] text-text-primary placeholder:text-text-secondary/40 focus:border-champagne-gold focus:outline-none"
                          />

                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            className="text-text-secondary hover:text-error-red text-sm font-bold px-1"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Cart Footer with Totals and Action */}
            <div className="border-t border-aged-bronze/20 pt-3 flex flex-col gap-3">
              <div className="flex flex-col gap-1 text-xs">
                <div className="flex justify-between text-text-secondary">
                  <span>Subtotal (Neto):</span>
                  <span>{formatCurrency(cartSummary.subtotal)}</span>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <span>IVA (16%):</span>
                  <span>{formatCurrency(cartSummary.tax)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-champagne-gold border-t border-aged-bronze/15 pt-1">
                  <span>Total:</span>
                  <span>{formatCurrency(cartSummary.total)}</span>
                </div>
              </div>

              <button
                onClick={handleSendComanda}
                disabled={
                  busy === 'comanda' ||
                  cart.length === 0 ||
                  !selectedTableId
                }
                className="w-full py-3 rounded-lg bg-champagne-gold text-obsidian text-sm font-bold hover:bg-white transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span>{busy === 'comanda' ? 'Enviando...' : '🚀 Mandar Comanda a Cocina'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* B. COCINA PERSPECTIVE: Kitchen Display System (KDS)                       */}
      {/* ------------------------------------------------------------------------- */}
      {activeRolePerspective === 'kitchen' && (
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
          <div className="bg-onyx-surface border border-aged-bronze/30 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🍳</span>
                <h3 className="text-sm sm:text-base font-bold text-champagne-gold uppercase tracking-wider">
                  Pantalla de Cocina / KDS ({selectedBranch?.name})
                </h3>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">
                Tickets activos en cocina esperando preparación o listos para servir.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="gold">
                {kitchenTickets.length} Tickets Activos
              </Badge>
            </div>
          </div>

          {/* Tickets Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {kitchenTickets.length === 0 ? (
              <div className="col-span-full h-64 flex flex-col items-center justify-center text-text-secondary border border-dashed border-aged-bronze/25 rounded-lg bg-onyx-surface/40 p-6 text-center">
                <span className="text-4xl mb-2">🍽️</span>
                <h4 className="text-sm font-bold text-text-primary">
                  No hay comandas pendientes en cocina
                </h4>
                <p className="text-xs text-text-secondary mt-1 max-w-sm">
                  Cambia a la perspectiva de <strong>Mesero</strong>, selecciona una mesa y envía una comanda para ver cómo aparece en esta pantalla.
                </p>
                <button
                  onClick={() => setActiveRolePerspective('waiter')}
                  className="mt-3 px-3 py-1.5 rounded bg-champagne-gold text-obsidian text-xs font-bold hover:bg-white transition-all"
                >
                  Ir a Crear Comanda (Mesero)
                </button>
              </div>
            ) : (
              kitchenTickets.map((ticket) => {
                const isBusy = busy?.startsWith(`ticket-${ticket.id}`);

                return (
                  <div
                    key={ticket.id}
                    className="rounded-lg border border-aged-bronze/30 bg-onyx-surface overflow-hidden shadow flex flex-col justify-between"
                  >
                    {/* Header */}
                    <div className="bg-charcoal-surface/80 border-b border-aged-bronze/20 p-3.5 flex items-start justify-between">
                      <div>
                        <div className="text-base font-bold text-champagne-gold">
                          {ticket.tableLabel || ticket.tableName || 'Mesa'}
                        </div>
                        <span className="text-[11px] text-text-secondary">
                          Estación: <strong className="uppercase">{ticket.station}</strong>
                        </span>
                      </div>
                      <div className="text-right">
                        <Badge variant={statusBadgeVariant(ticket.status)}>
                          {statusLabel(ticket.status)}
                        </Badge>
                        <span className="block text-[10px] text-text-secondary mt-1 font-mono">
                          ID: {ticket.id.slice(0, 8)}
                        </span>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="p-4 flex-1 flex flex-col gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-text-secondary font-bold">
                        Platillos a Preparar:
                      </span>
                      <div className="flex flex-col gap-2">
                        {ticket.items.map((item) => (
                          <div
                            key={item.id}
                            className="bg-charcoal-surface/40 border border-aged-bronze/15 rounded p-2.5 flex items-start justify-between gap-3 text-xs"
                          >
                            <div>
                              <div className="font-bold text-text-primary text-sm">
                                <span className="text-champagne-gold mr-1.5">
                                  {item.quantity}x
                                </span>
                                {item.productName || item.productId}
                              </div>
                              {item.notes && (
                                <div className="text-[11px] text-amber-300 italic mt-0.5">
                                  Nota: {item.notes}
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] text-text-secondary bg-black/30 px-1.5 py-0.5 rounded">
                              G{item.assignedGuest || 1}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="border-t border-aged-bronze/20 p-3 bg-charcoal-surface/30 grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleKitchenStatus(ticket.id, 'preparing')}
                        disabled={isBusy || ticket.status === 'preparing'}
                        className={`py-2 px-2 rounded text-xs font-bold transition-all text-center ${
                          ticket.status === 'preparing'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'border border-aged-bronze/30 text-text-secondary hover:text-white hover:border-champagne-gold'
                        }`}
                      >
                        En Cocina
                      </button>

                      <button
                        onClick={() => handleKitchenStatus(ticket.id, 'ready')}
                        disabled={isBusy || ticket.status === 'ready'}
                        className={`py-2 px-2 rounded text-xs font-bold transition-all text-center ${
                          ticket.status === 'ready'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'border border-aged-bronze/30 text-text-secondary hover:text-white hover:border-champagne-gold'
                        }`}
                      >
                        ✓ Listo
                      </button>

                      <button
                        onClick={() => handleKitchenStatus(ticket.id, 'served')}
                        disabled={isBusy || ticket.status === 'served'}
                        className={`py-2 px-2 rounded text-xs font-bold transition-all text-center ${
                          ticket.status === 'served'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                            : 'border border-aged-bronze/30 text-text-secondary hover:text-white hover:border-champagne-gold'
                        }`}
                      >
                        ★ Servido
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* C. CAJERO PERSPECTIVE: Active Tables, Pre-cuentas, Cobros & Cortes X/Z   */}
      {/* ------------------------------------------------------------------------- */}
      {activeRolePerspective === 'cashier' && (
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
          {/* Cashier Control Bar & Cortes */}
          <div className="bg-onyx-surface border border-aged-bronze/30 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">💵</span>
                <h3 className="text-sm sm:text-base font-bold text-champagne-gold uppercase tracking-wider">
                  Módulo de Caja y Cobros ({selectedBranch?.name})
                </h3>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">
                Cobra cuentas activas, solicita pre-cuentas y genera cortes de caja X y Z.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSimulateCorte('x')}
                className="px-3 py-1.5 rounded border border-aged-bronze/40 text-xs font-semibold text-text-secondary hover:text-champagne-gold hover:border-champagne-gold transition-all"
              >
                📊 Corte X (Arqueo)
              </button>
              <button
                onClick={() => handleSimulateCorte('z')}
                className="px-3 py-1.5 rounded bg-champagne-gold text-obsidian text-xs font-bold hover:bg-white transition-all shadow"
              >
                🔒 Corte Z (Cierre)
              </button>
            </div>
          </div>

          {/* Active Orders List */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {activeOrders.length === 0 ? (
              <div className="col-span-full h-64 flex flex-col items-center justify-center text-text-secondary border border-dashed border-aged-bronze/25 rounded-lg bg-onyx-surface/40 p-6 text-center">
                <span className="text-4xl mb-2">🧾</span>
                <h4 className="text-sm font-bold text-text-primary">
                  No hay cuentas pendientes de cobro
                </h4>
                <p className="text-xs text-text-secondary mt-1 max-w-sm">
                  Para cobrar una orden, primero envía una comanda desde la vista de <strong>Mesero</strong>.
                </p>
                <button
                  onClick={() => setActiveRolePerspective('waiter')}
                  className="mt-3 px-3 py-1.5 rounded bg-champagne-gold text-obsidian text-xs font-bold hover:bg-white transition-all"
                >
                  Ir a Crear Comanda (Mesero)
                </button>
              </div>
            ) : (
              activeOrders.map((order) => {
                const table = tables.find((t) => t.id === order.tableId);
                const isBilling = order.state === 'billing';

                return (
                  <div
                    key={order.id}
                    className="rounded-lg border border-aged-bronze/30 bg-onyx-surface overflow-hidden shadow flex flex-col justify-between"
                  >
                    {/* Header */}
                    <div className="bg-charcoal-surface/80 border-b border-aged-bronze/20 p-3.5 flex items-start justify-between">
                      <div>
                        <div className="text-base font-bold text-champagne-gold">
                          {table?.label || 'Mesa'}
                        </div>
                        <span className="text-[11px] text-text-secondary">
                          {order.items.length} partidas registradas
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-bold text-champagne-gold">
                          {formatCurrency(order.total)}
                        </div>
                        <Badge variant={statusBadgeVariant(order.state)}>
                          {statusLabel(order.state)}
                        </Badge>
                      </div>
                    </div>

                    {/* Breakdown */}
                    <div className="p-3.5 flex-1 flex flex-col gap-2">
                      <div className="flex flex-col gap-1 max-h-40 overflow-y-auto pr-1">
                        {order.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex justify-between items-center text-xs py-1 border-b border-aged-bronze/10"
                          >
                            <span className="text-text-primary">
                              {item.quantity}x {item.productName || item.productId}
                            </span>
                            <span className="text-text-secondary font-mono">
                              {formatCurrency(Number(item.price) * item.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-auto pt-2 border-t border-aged-bronze/15 flex flex-col gap-0.5 text-xs text-text-secondary">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span>{formatCurrency(order.subtotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>IVA (16%):</span>
                          <span>{formatCurrency(order.tax)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-text-primary text-sm pt-1 border-t border-aged-bronze/10">
                          <span>Total por Cobrar:</span>
                          <span className="text-champagne-gold">
                            {formatCurrency(order.total)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="border-t border-aged-bronze/20 p-3 bg-charcoal-surface/30 flex items-center gap-2">
                      <button
                        onClick={() => handleRequestBilling(order.id)}
                        disabled={isBilling || busy === `billing-${order.id}`}
                        className="flex-1 py-2 rounded border border-aged-bronze/40 text-xs font-semibold text-text-secondary hover:text-champagne-gold hover:border-champagne-gold disabled:opacity-40 transition-all text-center"
                      >
                        {isBilling ? '✓ Pre-cuenta Solicitada' : '📋 Pedir Cuenta'}
                      </button>

                      <button
                        onClick={() => handleOpenPaymentModal(order)}
                        className="flex-1 py-2 rounded bg-champagne-gold text-obsidian text-xs font-bold hover:bg-white transition-all shadow text-center"
                      >
                        💳 Cobrar Mesa
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODALS: Employee Picker, Payment Drawer, Corte Ticket Viewer            */}
      {/* ========================================================================= */}

      {/* A. EMPLOYEE SELECTION MODAL */}
      {isChangingEmployee && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-obsidian border border-aged-bronze/40 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-aged-bronze/20 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-champagne-gold">
                  Seleccionar Empleado a Simular
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Elige con qué perfil deseas operar el sistema en esta sucursal ({selectedBranch?.name}).
                </p>
              </div>
              <button
                onClick={() => setIsChangingEmployee(false)}
                className="text-text-secondary hover:text-white p-1 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Filter Roles */}
            <div className="px-4 py-2 bg-charcoal-surface/50 border-b border-aged-bronze/15 flex items-center gap-1.5 overflow-x-auto text-xs">
              <button
                onClick={() => setEmployeeFilterRole('all')}
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  employeeFilterRole === 'all'
                    ? 'bg-champagne-gold text-obsidian'
                    : 'bg-onyx-surface text-text-secondary hover:text-text-primary'
                }`}
              >
                Todos ({employees.length})
              </button>
              <button
                onClick={() => setEmployeeFilterRole('waiter')}
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  employeeFilterRole === 'waiter'
                    ? 'bg-champagne-gold text-obsidian'
                    : 'bg-onyx-surface text-text-secondary hover:text-text-primary'
                }`}
              >
                Meseros
              </button>
              <button
                onClick={() => setEmployeeFilterRole('cashier')}
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  employeeFilterRole === 'cashier'
                    ? 'bg-champagne-gold text-obsidian'
                    : 'bg-onyx-surface text-text-secondary hover:text-text-primary'
                }`}
              >
                Cajeros
              </button>
              <button
                onClick={() => setEmployeeFilterRole('kitchen')}
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  employeeFilterRole === 'kitchen'
                    ? 'bg-champagne-gold text-obsidian'
                    : 'bg-onyx-surface text-text-secondary hover:text-text-primary'
                }`}
              >
                Cocina
              </button>
            </div>

            {/* Employee Cards Grid */}
            <div className="p-4 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredEmployees.map((emp) => {
                const isCurrent = emp.id === selectedEmployeeId;
                const roles = emp.roles?.length ? emp.roles : [emp.role];

                return (
                  <button
                    key={emp.id}
                    onClick={() => handleSelectEmployee(emp)}
                    className={`p-3 rounded-lg border text-left flex items-start gap-3 transition-all ${
                      isCurrent
                        ? 'border-champagne-gold bg-champagne-gold/15 ring-1 ring-champagne-gold'
                        : 'border-aged-bronze/30 bg-charcoal-surface/60 hover:border-champagne-gold/60 hover:bg-charcoal-surface'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-champagne-gold/20 border border-champagne-gold/50 flex items-center justify-center text-champagne-gold font-bold text-sm shrink-0">
                      {emp.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-text-primary truncate">
                        {emp.name}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {roles.map((r) => (
                          <Badge key={r} variant="gold" className="text-[10px] py-0 px-1.5">
                            {roleTranslate(r)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {isCurrent && (
                      <span className="text-champagne-gold text-xs font-bold">✓ Activo</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* B. CHECKOUT / PAYMENT MODAL */}
      {payingOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-obsidian border border-aged-bronze/40 rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-aged-bronze/20 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-champagne-gold">
                  Cobrar Orden · {tables.find((t) => t.id === payingOrder.tableId)?.label || 'Mesa'}
                </h3>
                <span className="text-xs text-text-secondary">
                  Cajero: <strong>{selectedEmployee?.name || 'Cajero General'}</strong>
                </span>
              </div>
              <button
                onClick={() => setPayingOrder(null)}
                className="text-text-secondary hover:text-white p-1 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              {/* Total Banner */}
              <div className="bg-charcoal-surface/60 border border-aged-bronze/25 rounded-lg p-4 text-center">
                <span className="text-xs uppercase tracking-wider text-text-secondary font-bold block">
                  Total a Cobrar
                </span>
                <span className="text-3xl font-extrabold text-champagne-gold mt-1 block">
                  {formatCurrency(payingOrder.total)}
                </span>
              </div>

              {/* Payment Method Selector */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-wider text-text-secondary font-bold">
                  Método de Pago:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentMethod('cash')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      paymentMethod === 'cash'
                        ? 'bg-champagne-gold text-obsidian border-champagne-gold shadow'
                        : 'border-aged-bronze/30 bg-charcoal-surface text-text-secondary hover:text-white'
                    }`}
                  >
                    <span>💵</span>
                    <span>Efectivo</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod('card')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      paymentMethod === 'card'
                        ? 'bg-champagne-gold text-obsidian border-champagne-gold shadow'
                        : 'border-aged-bronze/30 bg-charcoal-surface text-text-secondary hover:text-white'
                    }`}
                  >
                    <span>💳</span>
                    <span>Tarjeta</span>
                  </button>
                </div>
              </div>

              {/* Cash Calculator */}
              {paymentMethod === 'cash' ? (
                <div className="bg-charcoal-surface/40 border border-aged-bronze/20 rounded-lg p-3 flex flex-col gap-3">
                  <label className="flex flex-col gap-1.5 text-xs text-text-secondary">
                    <span className="font-bold">Paga con ($):</span>
                    <input
                      type="number"
                      value={receivedCash}
                      onChange={(e) => setReceivedCash(e.target.value)}
                      className="bg-black/40 text-text-primary border border-aged-bronze/40 focus:border-champagne-gold rounded px-3 py-2 text-base font-bold font-mono focus:outline-none"
                    />
                  </label>

                  {/* Quick Cash Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <button
                      onClick={() => setReceivedCash(payingOrder.total)}
                      className="px-2 py-1 bg-black/30 hover:bg-champagne-gold/20 rounded border border-aged-bronze/30 text-text-secondary hover:text-champagne-gold"
                    >
                      Exacto
                    </button>
                    {[100, 200, 500, 1000].map((val) => (
                      <button
                        key={val}
                        onClick={() => setReceivedCash(val.toString())}
                        className="px-2 py-1 bg-black/30 hover:bg-champagne-gold/20 rounded border border-aged-bronze/30 text-text-secondary hover:text-champagne-gold"
                      >
                        ${val}
                      </button>
                    ))}
                  </div>

                  {/* Change Output */}
                  <div className="border-t border-aged-bronze/15 pt-2 flex items-center justify-between text-sm">
                    <span className="text-text-secondary">Cambio a entregar:</span>
                    <strong
                      className={`text-base font-bold font-mono ${
                        Number(receivedCash || 0) >= Number(payingOrder.total)
                          ? 'text-emerald-400'
                          : 'text-error-red'
                      }`}
                    >
                      {Number(receivedCash || 0) >= Number(payingOrder.total)
                        ? formatCurrency(Number(receivedCash) - Number(payingOrder.total))
                        : 'Monto insuficiente'}
                    </strong>
                  </div>
                </div>
              ) : (
                <div className="bg-charcoal-surface/40 border border-aged-bronze/20 rounded-lg p-3 flex flex-col gap-2">
                  <label className="flex flex-col gap-1.5 text-xs text-text-secondary">
                    <span className="font-bold">Referencia / Voucher de Terminal:</span>
                    <input
                      type="text"
                      value={cardAuthCode}
                      onChange={(e) => setCardAuthCode(e.target.value)}
                      className="bg-black/40 text-text-primary border border-aged-bronze/40 focus:border-champagne-gold rounded px-3 py-2 text-xs font-mono focus:outline-none"
                    />
                  </label>
                  <span className="text-[11px] text-text-secondary">
                    Terminal bancaria autorizada y vinculada automáticamente.
                  </span>
                </div>
              )}

              {/* Confirm Payment Button */}
              <button
                onClick={handleConfirmPayment}
                disabled={
                  busy === `pay-${payingOrder.id}` ||
                  (paymentMethod === 'cash' &&
                    Number(receivedCash || 0) < Number(payingOrder.total))
                }
                className="w-full py-3 rounded-lg bg-champagne-gold text-obsidian text-sm font-bold hover:bg-white transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy === `pay-${payingOrder.id}`
                  ? 'Registrando Cobro...'
                  : `✓ Finalizar Cobro (${formatCurrency(payingOrder.total)})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* C. CORTE MODAL (X o Z) */}
      {corteSimulation && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-xl border border-aged-bronze/40 bg-obsidian shadow-2xl flex flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-aged-bronze/20 p-4">
              <div>
                <h3 className="text-champagne-gold text-base sm:text-lg font-bold">
                  {corteSimulation.title}
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Reporte simulado de corte de caja de la sucursal activa.
                </p>
              </div>
              <button
                onClick={() => setCorteSimulation(null)}
                className="px-3 py-1 rounded border border-aged-bronze/40 text-text-secondary hover:text-champagne-gold hover:border-champagne-gold/60 text-xs"
              >
                Cerrar
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto p-4">
              <section className="rounded-lg border border-aged-bronze/25 bg-charcoal-surface/40 p-3.5">
                <h4 className="text-xs uppercase tracking-widest text-text-secondary mb-2 font-bold">
                  Ticket de Impresión
                </h4>
                <pre className="whitespace-pre-wrap font-mono text-xs leading-5 text-text-primary bg-black/30 rounded p-3 overflow-x-auto">
                  {corteSimulation.ticket}
                </pre>
              </section>

              <section className="rounded-lg border border-aged-bronze/25 bg-charcoal-surface/40 p-3.5">
                <h4 className="text-xs uppercase tracking-widest text-text-secondary mb-2 font-bold">
                  Datos de Auditoría (Snapshot)
                </h4>
                <pre className="whitespace-pre-wrap font-mono text-[11px] leading-4 text-text-primary bg-black/30 rounded p-3 overflow-x-auto max-h-[480px]">
                  {JSON.stringify(corteSimulation.snapshot, null, 2)}
                </pre>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
