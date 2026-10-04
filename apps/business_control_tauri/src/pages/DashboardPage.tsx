import React, { useEffect, useState, useCallback } from 'react';
import { api, Employee, Branch, CashShiftHeader, CashShiftAuditReport, SalesDashboardSummary, PaymentMethodSalesReportLine } from '../services/api';
import { UserForm } from '../components/organisms/UserForm';
import { UsersGrid } from '../components/organisms/UsersGrid';
import { ToastContainer } from '../components/molecules/ToastNotification';
import { Heading } from '../components/atoms/Heading';

interface DashboardPageProps {
  businessId: string;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ businessId }) => {
  const [users, setUsers] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [editingUser, setEditingUser] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' | 'warning' }>>([]);
  const [summary, setSummary] = useState<SalesDashboardSummary | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodSalesReportLine[]>([]);
  const [activeShift, setActiveShift] = useState<CashShiftHeader | null>(null);
  const [lastClosedShift, setLastClosedShift] = useState<CashShiftHeader | null>(null);
  const [shiftAudit, setShiftAudit] = useState<CashShiftAuditReport | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Fetch branches list
  const fetchBranches = useCallback(async () => {
    try {
      const data = await api.getBranches(businessId);
      setBranches(data);
    } catch (error) {
      console.error('Error al cargar sucursales:', error);
    }
  }, [businessId]);

  // Fetch users from API
  const fetchUsers = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await api.getUsers(businessId, selectedBranchId || undefined);
      setUsers(data);
    } catch (error: any) {
      showToast(error.message || 'Error al cargar el roster de personal.', 'error');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [businessId, selectedBranchId, showToast]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    const today = new Date();
    const startDate = today.toISOString().slice(0, 10);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const endDate = tomorrow.toISOString().slice(0, 10);
    try {
      const params = { businessId, startDate, endDate, branchId: selectedBranchId || undefined };
      const [sales, payments, shifts] = await Promise.all([
        api.getSalesDashboard(params),
        api.getPaymentMethodsSalesReport(params),
        api.getCashShiftsList(params),
      ]);
      setSummary(sales);
      setPaymentMethods(payments);
      const open = shifts.filter((shift) => shift.status === 'open').sort((a, b) => b.openedAt.localeCompare(a.openedAt))[0] ?? null;
      const closed = shifts.filter((shift) => shift.status === 'closed').sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''))[0] ?? null;
      setActiveShift(open);
      setLastClosedShift(closed);
      // Shift audit is restricted to the cashier/branch operator who owns the shift.
      // The admin summary already has payment totals, so do not issue an unauthorized
      // audit request that would make the entire dashboard load fail for admin users.
      setShiftAudit(null);
    } catch (error: any) {
      showToast(error.message || 'No se pudo cargar el resumen de sucursal.', 'error');
    } finally {
      setSummaryLoading(false);
    }
  }, [businessId, selectedBranchId, showToast]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Callbacks for UserForm
  const handleUserSaved = (savedUser: Employee) => {
    if (editingUser) {
      setUsers((prev) => prev.map((user) => user.id === savedUser.id ? savedUser : user));
      setEditingUser(null);
      showToast(`Empleado ${savedUser.name} actualizado con éxito.`, 'success');
      fetchUsers(true);
      return;
    }

    setUsers((prev) => [...prev, savedUser]);
    showToast(`Empleado ${savedUser.name} registrado con éxito.`, 'success');
  };

  // Callbacks for UsersGrid
  const handleDeleteUserSuccess = (deletedId: string) => {
    const deletedUser = users.find((u) => u.id === deletedId);
    setUsers((prev) => prev.filter((u) => u.id !== deletedId));
    if (deletedUser) {
      showToast(`Acceso revocado para ${deletedUser.name}.`, 'warning');
    } else {
      showToast(`Acceso revocado correctamente.`, 'warning');
    }
  };

  return (
    <div className="flex flex-col gap-8 min-h-full animate-fade-in relative">
      <section aria-label="Resumen de sucursal" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded border border-aged-bronze/20 bg-onyx-surface p-4"><p className="text-xs uppercase tracking-widest text-text-secondary">Ventas del día</p><p className="text-2xl text-champagne-gold mt-2">{summaryLoading ? '—' : `$${Number(summary?.totalSales ?? 0).toFixed(2)}`}</p><p className="text-xs text-text-secondary mt-1">{summary?.totalOrdersCount ?? 0} tickets</p></div>
        <div className="rounded border border-aged-bronze/20 bg-onyx-surface p-4"><p className="text-xs uppercase tracking-widest text-text-secondary">Efectivo</p><p className="text-2xl text-text-primary mt-2">${Number(paymentMethods.find((p) => p.paymentMethod.toLowerCase() === 'cash')?.totalAmount ?? shiftAudit?.salesSummary.cashSales ?? 0).toFixed(2)}</p></div>
        <div className="rounded border border-aged-bronze/20 bg-onyx-surface p-4"><p className="text-xs uppercase tracking-widest text-text-secondary">Tarjeta</p><p className="text-2xl text-text-primary mt-2">${Number(paymentMethods.find((p) => ['card','tarjeta'].includes(p.paymentMethod.toLowerCase()))?.totalAmount ?? shiftAudit?.salesSummary.cardSales ?? 0).toFixed(2)}</p></div>
        <div className="rounded border border-aged-bronze/20 bg-onyx-surface p-4"><p className="text-xs uppercase tracking-widest text-text-secondary">Corte X</p><p className="text-lg text-text-primary mt-2">{activeShift ? `${activeShift.cashierName} · Abierto` : 'Sin turno abierto'}</p><p className="text-xs text-text-secondary mt-1">{activeShift ? `Desde ${new Date(activeShift.openedAt).toLocaleTimeString()}` : 'No hay arqueo parcial activo'}</p></div>
        <div className="rounded border border-aged-bronze/20 bg-onyx-surface p-4"><p className="text-xs uppercase tracking-widest text-text-secondary">Corte Z</p><p className="text-lg text-text-primary mt-2">{lastClosedShift ? 'Cerrado' : 'Pendiente'}</p><p className="text-xs text-text-secondary mt-1">{lastClosedShift?.closedAt ? new Date(lastClosedShift.closedAt).toLocaleString() : 'Se genera al cerrar la caja'}</p></div>
      </section>

      {/* Top action header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-aged-bronze/10 pb-4">
        <div>
          <Heading level={2} className="!border-none !pb-0 font-light">
            Control de Acceso de Personal
          </Heading>
          <p className="text-sm text-text-secondary mt-1 font-sans">
            Administra el personal del local y sus códigos PIN de acceso para las terminales de caja y meseros.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* Branch filter selection */}
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            disabled={isLoading}
            className="px-3 py-1.5 bg-onyx-surface text-text-primary border border-aged-bronze/40 focus:border-champagne-gold rounded text-xs font-sans focus:outline-none transition-all cursor-pointer min-w-[180px]"
          >
            <option value="">Todas las Sucursales</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => { fetchUsers(); fetchSummary(); }}
            disabled={isLoading || summaryLoading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-aged-bronze/40 hover:border-champagne-gold/60 bg-onyx-surface hover:bg-charcoal-surface/60 rounded text-sm text-text-secondary hover:text-champagne-gold font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-98"
          >
            <svg
              className={`w-4 h-4 ${isLoading ? 'animate-spin text-champagne-gold' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 3v2m-2.837 5.828l-2.83-2.829m0 0l-3.07 3.07M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Sincronizar Lista</span>
          </button>
        </div>
      </div>

      {isLoading && users.length === 0 ? (
        /* Loader screen */
        <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] gap-4">
          <svg className="animate-spin h-10 w-10 text-champagne-gold" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-xs text-text-secondary tracking-widest uppercase font-sans">
            Cargando Personal...
          </span>
        </div>
      ) : (
        /* Content layout split */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Create User Form Block */}
          <div className="lg:col-span-1">
            <UserForm 
              onSuccess={handleUserSaved}
              onErrorToast={(msg) => showToast(msg, 'error')} 
              businessId={businessId} 
              branches={branches}
              editingUser={editingUser}
              onCancelEdit={() => setEditingUser(null)}
            />
          </div>

          {/* Users Grid Table Block */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="flex justify-between items-center text-xs font-semibold text-text-secondary uppercase tracking-widest pl-1">
              <span>Roster de Personal Registrado</span>
              <span>{users.length} {users.length === 1 ? 'Empleado' : 'Empleados'}</span>
            </div>
            <UsersGrid
              users={users}
              branches={branches}
              onEdit={setEditingUser}
              onDeleteSuccess={handleDeleteUserSuccess}
              onErrorToast={(msg) => showToast(msg, 'error')}
            />
          </div>
        </div>
      )}

      {/* Global Toast Message Queue */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
};
