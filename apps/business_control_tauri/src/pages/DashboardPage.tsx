import React, { useEffect, useState, useCallback } from 'react';
import { api, Employee } from '../services/api';
import { UserForm } from '../components/organisms/UserForm';
import { UsersGrid } from '../components/organisms/UsersGrid';
import { ToastContainer } from '../components/molecules/ToastNotification';
import { Heading } from '../components/atoms/Heading';

export const DashboardPage: React.FC = () => {
  const [users, setUsers] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' | 'warning' }>>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Fetch users from API
  const fetchUsers = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (error: any) {
      showToast(error.message || 'Error al cargar el roster de personal.', 'error');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Callbacks for UserForm
  const handleAddUserSuccess = (newUser: Employee) => {
    setUsers((prev) => [...prev, newUser]);
    showToast(`Empleado ${newUser.name} registrado con éxito.`, 'success');
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
    <div className="flex flex-col gap-8 h-full animate-fade-in relative">
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

        <button
          onClick={() => fetchUsers()}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2 border border-aged-bronze/40 hover:border-champagne-gold/60 bg-onyx-surface hover:bg-charcoal-surface/60 rounded text-sm text-text-secondary hover:text-champagne-gold font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-98"
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
            <UserForm onSuccess={handleAddUserSuccess} onErrorToast={(msg) => showToast(msg, 'error')} />
          </div>

          {/* Users Grid Table Block */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="flex justify-between items-center text-xs font-semibold text-text-secondary uppercase tracking-widest pl-1">
              <span>Roster de Personal Registrado</span>
              <span>{users.length} {users.length === 1 ? 'Empleado' : 'Empleados'}</span>
            </div>
            <UsersGrid
              users={users}
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
