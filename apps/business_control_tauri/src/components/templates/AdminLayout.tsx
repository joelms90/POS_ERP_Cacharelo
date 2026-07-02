import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { api, SystemHealth } from '../../services/api';
import { StatusIndicator } from '../molecules/StatusIndicator';
import { Button } from '../atoms/Button';
import { Heading } from '../atoms/Heading';

interface AdminLayoutProps {
  children: React.ReactNode;
  activeTab: 'personal' | 'inventory' | 'providers' | 'inquiries' | 'warehouses' | 'receipts' | 'branches' | 'categories' | 'assembly' | 'transfers' | 'help';
  onTabChange: (tab: 'personal' | 'inventory' | 'providers' | 'inquiries' | 'warehouses' | 'receipts' | 'branches' | 'categories' | 'assembly' | 'transfers' | 'help') => void;
  activeBusinessId: string;
  onBusinessChange: (businessId: string) => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children, activeTab, onTabChange, activeBusinessId, onBusinessChange }) => {
  const { logout } = useAuth();
  
  const [health, setHealth] = useState<SystemHealth>({
    apiOnline: false,
    databaseConnected: false,
    databaseType: 'PostgreSQL',
    activeSessionsCount: 0,
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Poll system health function
  const fetchHealth = async () => {
    setIsRefreshing(true);
    try {
      const currentHealth = await api.checkSystemHealth();
      setHealth(currentHealth);
    } catch {
      setHealth({
        apiOnline: false,
        databaseConnected: false,
        databaseType: 'PostgreSQL',
        activeSessionsCount: 0,
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const handleTabClick = (tab: typeof activeTab) => {
    onTabChange(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen w-screen bg-obsidian text-text-primary overflow-hidden font-sans select-none relative">
      
      {/* Backdrop overlay for mobile drawer */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-300"
        />
      )}

      {/* Sidebar Panel */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-onyx-surface border-r border-aged-bronze/40 flex flex-col justify-between h-full transform transition-transform duration-300 ease-in-out ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div>
          {/* Logo Brand Header */}
          <div className="p-6 border-b border-aged-bronze/20 flex flex-col items-center gap-1 relative">
            <span className="font-display text-2xl tracking-widest text-champagne-gold uppercase">
              Cacharelo
            </span>
            <span className="text-[10px] tracking-widest text-text-secondary uppercase">
              Business Control
            </span>
            
            {/* Close button inside mobile menu */}
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden absolute top-4 right-4 p-1 text-text-secondary hover:text-champagne-gold"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
 
          {/* Navigation Links */}
          <nav className="p-4 flex flex-col gap-1 overflow-y-auto max-h-[calc(100vh-160px)]">
            {/* Group: Operaciones */}
            <div className="px-3 py-1.5 mt-1 select-none">
              <span className="text-[10px] font-bold text-aged-bronze uppercase tracking-widest">
                Operaciones y Local
              </span>
            </div>

            <button
              onClick={() => handleTabClick('personal')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded border text-left transition-all duration-200 ${
                activeTab === 'personal'
                  ? 'bg-charcoal-surface border-champagne-gold/20 text-champagne-gold font-medium'
                  : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-charcoal-surface/50'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span className="text-xs">Personal (PINs)</span>
            </button>

            <button
              onClick={() => handleTabClick('branches')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded border text-left transition-all duration-200 ${
                activeTab === 'branches'
                  ? 'bg-charcoal-surface border-champagne-gold/20 text-champagne-gold font-medium'
                  : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-charcoal-surface/50'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-xs">Sucursales</span>
            </button>

            <button
              onClick={() => handleTabClick('inquiries')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded border text-left transition-all duration-200 ${
                activeTab === 'inquiries'
                  ? 'bg-charcoal-surface border-champagne-gold/20 text-champagne-gold font-medium'
                  : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-charcoal-surface/50'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <span className="text-xs">Consultas Web</span>
            </button>

            {/* Group: Catálogo & Inventario */}
            <div className="px-3 py-1.5 mt-3 select-none">
              <span className="text-[10px] font-bold text-aged-bronze uppercase tracking-widest">
                Catálogo e Inventario
              </span>
            </div>

            <button
              onClick={() => handleTabClick('inventory')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded border text-left transition-all duration-200 ${
                activeTab === 'inventory'
                  ? 'bg-charcoal-surface border-champagne-gold/20 text-champagne-gold font-medium'
                  : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-charcoal-surface/50'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <span className="text-xs">Productos</span>
            </button>

            <button
              onClick={() => handleTabClick('categories')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded border text-left transition-all duration-200 ${
                activeTab === 'categories'
                  ? 'bg-charcoal-surface border-champagne-gold/20 text-champagne-gold font-medium'
                  : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-charcoal-surface/50'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs">Categorías</span>
            </button>

            <button
              onClick={() => handleTabClick('assembly')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded border text-left transition-all duration-200 ${
                activeTab === 'assembly'
                  ? 'bg-charcoal-surface border-champagne-gold/20 text-champagne-gold font-medium'
                  : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-charcoal-surface/50'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-xs">Producción (Recetas)</span>
            </button>

            <button
              onClick={() => handleTabClick('receipts')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded border text-left transition-all duration-200 ${
                activeTab === 'receipts'
                  ? 'bg-charcoal-surface border-champagne-gold/20 text-champagne-gold font-medium'
                  : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-charcoal-surface/50'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16H9.01" />
              </svg>
              <span className="text-xs">Recepción de Insumos</span>
            </button>

            <button
              onClick={() => handleTabClick('warehouses')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded border text-left transition-all duration-200 ${
                activeTab === 'warehouses'
                  ? 'bg-charcoal-surface border-champagne-gold/20 text-champagne-gold font-medium'
                  : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-charcoal-surface/50'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span className="text-xs">Bodegas (Almacén)</span>
            </button>

            <button
              onClick={() => handleTabClick('providers')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded border text-left transition-all duration-200 ${
                activeTab === 'providers'
                  ? 'bg-charcoal-surface border-champagne-gold/20 text-champagne-gold font-medium'
                  : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-charcoal-surface/50'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="text-xs">Proveedores</span>
            </button>

            <button
              onClick={() => handleTabClick('transfers')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded border text-left transition-all duration-200 ${
                activeTab === 'transfers'
                  ? 'bg-charcoal-surface border-champagne-gold/20 text-champagne-gold font-medium'
                  : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-charcoal-surface/50'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <span className="text-xs">Traspasos y Reportes</span>
            </button>

            <button
              onClick={() => handleTabClick('help')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded border text-left transition-all duration-200 ${
                activeTab === 'help'
                  ? 'bg-charcoal-surface border-champagne-gold/20 text-champagne-gold font-medium'
                  : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-charcoal-surface/50'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span className="text-xs">Guía y Manual (FAQ)</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer (Logout) */}
        <div className="p-4 border-t border-aged-bronze/20">
          <Button variant="secondary" fullWidth onClick={logout} className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Cerrar Sesión</span>
          </Button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Connection Warning Banner */}
        {!health.apiOnline && (
          <div className="bg-error-red/20 border-b border-error-red text-white px-6 py-2.5 flex items-center justify-between animate-fade-in z-20">
            <div className="flex items-center gap-2 text-sm font-sans tracking-wide">
              <svg className="w-5 h-5 text-error-red flex-shrink-0 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Error de Conexión: No se pudo contactar al servidor. Funciones administrativas deshabilitadas.</span>
            </div>
            <button onClick={fetchHealth} className="text-xs font-semibold underline hover:text-text-secondary transition-colors">
              Reintentar
            </button>
          </div>
        )}

        {/* Global Page Header */}
        <header className="h-20 bg-onyx-surface border-b border-aged-bronze/40 px-4 lg:px-8 flex items-center justify-between flex-shrink-0 z-10">
          <div className="flex items-center gap-3 lg:gap-8">
            
            {/* Hamburger Menu Toggle for Mobile */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded border border-aged-bronze/30 text-text-secondary hover:text-champagne-gold hover:bg-charcoal/20 transition-all active:scale-95 duration-100"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <Heading level={3} className="!border-none !pb-0 tracking-wide font-light hidden sm:block">
              Panel de Control
            </Heading>

            <div className="flex items-center gap-2 bg-charcoal-surface/60 border border-aged-bronze/35 rounded-md px-2 py-1 lg:px-3 lg:py-1.5 shadow-sm">
              <label className="text-[9px] lg:text-[10px] text-text-secondary font-medium uppercase tracking-wider">Negocio:</label>
              <select
                value={activeBusinessId}
                onChange={(e) => onBusinessChange(e.target.value)}
                className="bg-transparent text-xs text-champagne-gold font-sans font-medium focus:outline-none cursor-pointer hover:text-champagne-gold/80 transition-colors"
              >
                <option value="d3b07384-d113-4a0e-a555-e5b12824bf01" className="bg-onyx text-text-primary">Cafetería</option>
                <option value="d3b07384-d113-4a0e-a555-e5b12824bf03" className="bg-onyx text-text-primary">Empanadas</option>
                <option value="d3b07384-d113-4a0e-a555-e5b12824bf07" className="bg-onyx text-text-primary">Tortas</option>
                <option value="d3b07384-d113-4a0e-a555-e5b12824bf05" className="bg-onyx text-text-primary">Hamburguesas</option>
              </select>
            </div>
          </div>

          {/* Right Status Actions */}
          <div className="flex items-center gap-3 lg:gap-6">
            <StatusIndicator
              apiOnline={health.apiOnline}
              databaseConnected={health.databaseConnected}
              databaseType={health.databaseType}
            />

            <button
              onClick={fetchHealth}
              disabled={isRefreshing}
              className={`p-2 rounded-full border border-aged-bronze/30 hover:border-champagne-gold/50 bg-charcoal-surface/40 hover:bg-charcoal-surface text-text-secondary hover:text-champagne-gold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed`}
              title="Actualizar estado"
            >
              <svg
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-champagne-gold' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 3v2m-2.837 5.828l-2.83-2.829m0 0l-3.07 3.07M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 bg-obsidian overflow-y-auto p-4 lg:p-8 relative">
          <div className="max-w-6xl mx-auto h-full flex flex-col">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
