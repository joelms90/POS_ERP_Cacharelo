import { useAuth } from './hooks/useAuth';
import { LoginPage } from './pages/LoginPage';
import { AdminLayout } from './components/templates/AdminLayout';
import { DashboardPage } from './pages/DashboardPage';

function App() {
  const { isAuthenticated, isLoading } = useAuth();

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
    <AdminLayout>
      <DashboardPage />
    </AdminLayout>
  );
}

export default App;
