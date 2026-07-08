import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './pages/LoginPage';
import { AdminLayout } from './components/templates/AdminLayout';
import { DashboardPage } from './pages/DashboardPage';
import { InventoryPage } from './pages/InventoryPage';
import { ProvidersPage } from './pages/ProvidersPage';
import { InquiriesPage } from './pages/InquiriesPage';
import { WarehousesPage } from './pages/WarehousesPage';
import { ReceiptsPage } from './pages/ReceiptsPage';
import { BranchesPage } from './pages/BranchesPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { AssemblyPage } from './pages/AssemblyPage';
import { TransfersPage } from './pages/TransfersPage';
import { HelpPage } from './pages/HelpPage';
import { ReportsPage } from './pages/ReportsPage';
import { TicketSettingsPage } from './pages/TicketSettingsPage';
import { PosSimulatorPage } from './pages/PosSimulatorPage';
import { AdministratorsPage } from './pages/AdministratorsPage';
import { api } from './services/api';

export type AdminTab = 'administrators' | 'personal' | 'inventory' | 'providers' | 'inquiries' | 'warehouses' | 'receipts' | 'branches' | 'categories' | 'assembly' | 'transfers' | 'help' | 'reports' | 'ticket-settings' | 'pos-simulator';

export const roleTabs: Record<string, AdminTab[]> = {
  owner: ['administrators', 'personal', 'branches', 'ticket-settings', 'pos-simulator', 'inventory', 'categories', 'receipts', 'warehouses', 'providers', 'assembly', 'transfers', 'reports', 'inquiries', 'help'],
  inventory_admin: ['inventory', 'categories', 'receipts', 'warehouses', 'providers', 'assembly', 'help'],
};

function App() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('personal');
  const [activeBusinessId, setActiveBusinessId] = useState<string>('d3b07384-d113-4a0e-a555-e5b12824bf01');
  const [globalError, setGlobalError] = useState<string | null>(null);
  const allowedTabs = roleTabs[user?.role || 'owner'] || roleTabs.owner;
  const allowedBusinessIds = user?.role === 'inventory_admin'
    ? (user.businessAccess?.map((access) => access.businessId) || (user.businessId ? [user.businessId] : []))
    : undefined;

  useEffect(() => {
    if (!allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0]);
    }
  }, [activeTab, allowedTabs]);

  useEffect(() => {
    if (allowedBusinessIds?.length && !allowedBusinessIds.includes(activeBusinessId)) {
      setActiveBusinessId(allowedBusinessIds[0]);
    }
  }, [allowedBusinessIds, activeBusinessId]);

  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      const msg = `${e.message} (en ${e.filename}:${e.lineno}:${e.colno})`;
      setGlobalError(msg);
      api.logError(msg, e.error?.stack || 'no-stack');
    };
    const handleRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason instanceof Error ? e.reason.message : String(e.reason);
      const stack = e.reason instanceof Error ? e.reason.stack : undefined;
      const msg = `Promesa rechazada: ${reason}`;
      setGlobalError(msg);
      api.logError(msg, stack);
    };
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  // Full Screen Loading State
  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-obsidian flex flex-col items-center justify-center gap-4 select-none">
        <svg className="animate-spin h-10 w-10 text-champagne-gold" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-xs font-sans tracking-widest text-text-secondary uppercase">
          Iniciando Consola...
        </span>
      </div>
    );
  }

  // Lock screen if not authenticated
  if (!isAuthenticated) {
    return <LoginPage onUnlock={() => {}} />;
  }

  // Shell Layout when authenticated
  return (
    <>
      <AdminLayout 
        activeTab={activeTab} 
        onTabChange={setActiveTab as any}
        activeBusinessId={activeBusinessId}
        onBusinessChange={setActiveBusinessId}
        allowedTabs={allowedTabs}
        currentUser={user}
        allowedBusinessIds={allowedBusinessIds}
      >
        {activeTab === 'administrators' && <AdministratorsPage businessId={activeBusinessId} />}
        {activeTab === 'personal' && <DashboardPage businessId={activeBusinessId} />}
        {activeTab === 'inventory' && <InventoryPage businessId={activeBusinessId} />}
        {activeTab === 'providers' && <ProvidersPage businessId={activeBusinessId} />}
        {activeTab === 'inquiries' && <InquiriesPage />}
        {activeTab === 'warehouses' && <WarehousesPage businessId={activeBusinessId} />}
        {activeTab === 'receipts' && <ReceiptsPage businessId={activeBusinessId} />}
        {activeTab === 'branches' && <BranchesPage businessId={activeBusinessId} />}
        {activeTab === 'categories' && <CategoriesPage businessId={activeBusinessId} />}
        {activeTab === 'assembly' && <AssemblyPage businessId={activeBusinessId} />}
        {activeTab === 'transfers' && <TransfersPage businessId={activeBusinessId} />}
        {activeTab === 'help' && <HelpPage />}
        {activeTab === 'reports' && <ReportsPage businessId={activeBusinessId} />}
        {activeTab === 'ticket-settings' && <TicketSettingsPage businessId={activeBusinessId} />}
        {activeTab === 'pos-simulator' && <PosSimulatorPage businessId={activeBusinessId} />}
      </AdminLayout>

      {globalError && (
        <div className="bg-error-red border-t border-white/20 text-white p-4 font-mono text-xs z-50 fixed bottom-0 left-0 right-0 max-h-[150px] overflow-y-auto shadow-2xl flex items-center justify-between">
          <div className="flex-1">
            <strong>[Error de Sistema]:</strong> {globalError}
          </div>
          <button 
            onClick={() => setGlobalError(null)} 
            className="ml-4 px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-[10px] uppercase font-bold tracking-widest cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}
    </>
  );
}

export default App;
