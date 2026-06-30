import { useState } from 'react';
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

function App() {
  const { isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'personal' | 'inventory' | 'providers' | 'inquiries' | 'warehouses' | 'receipts' | 'branches' | 'categories' | 'assembly' | 'transfers'>('personal');
  const [activeBusinessId, setActiveBusinessId] = useState<string>('d3b07384-d113-4a0e-a555-e5b12824bf01');

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
    <AdminLayout 
      activeTab={activeTab} 
      onTabChange={setActiveTab as any}
      activeBusinessId={activeBusinessId}
      onBusinessChange={setActiveBusinessId}
    >
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
    </AdminLayout>
  );
}

export default App;
