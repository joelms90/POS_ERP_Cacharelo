import React, { useState } from 'react';
import { Employee, api, Branch } from '../../services/api';
import { Badge } from '../atoms/Badge';

interface UsersGridProps {
  users: Employee[];
  branches: Branch[];
  onEdit: (user: Employee) => void;
  onDeleteSuccess: (id: string) => void;
  onErrorToast: (message: string) => void;
}

export const UsersGrid: React.FC<UsersGridProps> = ({
  users,
  branches,
  onEdit,
  onDeleteSuccess,
  onErrorToast,
}) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showPins, setShowPins] = useState<Record<string, boolean>>({});

  const togglePinVisibility = (id: string) => {
    setShowPins((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleDeleteClick = (id: string) => {
    setDeletingId(id);
  };

  const handleCancelDelete = () => {
    setDeletingId(null);
  };

  const handleConfirmDelete = async (id: string) => {
    try {
      const response = await api.deleteUser(id);
      if (response.success) {
        onDeleteSuccess(id);
      } else {
        onErrorToast('No se pudo revocar el acceso del usuario.');
      }
    } catch (err: any) {
      onErrorToast(err.message || 'Error al conectar con el servidor.');
    } finally {
      setDeletingId(null);
    }
  };

  const roleLabels = {
    waiter: { text: 'Mesero', variant: 'gold' as const },
    cashier: { text: 'Cajero', variant: 'success' as const },
    kitchen: { text: 'Cocina', variant: 'charcoal' as const },
  };

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-onyx-surface border border-dashed border-aged-bronze/40 rounded-lg">
        <svg className="w-12 h-12 text-text-secondary opacity-40 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <span className="text-sm font-medium text-text-secondary tracking-wide">
          No hay personal registrado en este momento.
        </span>
      </div>
    );
  }

  return (
    <div className="bg-onyx-surface border border-aged-bronze/40 rounded-lg overflow-hidden shadow-lg shadow-obsidian/40">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse font-sans">
          <thead>
            <tr className="bg-charcoal-surface/60 border-b border-aged-bronze/20 text-xs font-semibold tracking-wider text-text-secondary uppercase select-none">
              <th className="px-6 py-4">Nombre</th>
              <th className="px-6 py-4">Sucursal</th>
              <th className="px-6 py-4">Rol / Puesto</th>
              <th className="px-6 py-4">PIN de Ingreso</th>
              <th className="px-6 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-aged-bronze/10 text-sm">
            {users.map((user) => {
              const userRoles = user.roles?.length ? user.roles : [user.role];
              const isConfirmingDelete = deletingId === user.id;
              const branch = branches.find((b) => b.id === user.branchId);
              const branchName = branch ? branch.name : 'Todas (General)';

              return (
                <tr key={user.id} className="hover:bg-charcoal-surface/20 transition-colors duration-200">
                  {/* Name */}
                  <td className="px-6 py-4 font-semibold text-text-primary whitespace-nowrap">
                    {user.name}
                  </td>

                  {/* Branch */}
                  <td className="px-6 py-4 whitespace-nowrap text-text-secondary">
                    {branchName}
                  </td>

                  {/* Role */}
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {userRoles.map((role) => {
                        const roleInfo = (roleLabels as any)[role] || { text: role, variant: 'info' as const };
                        return (
                          <Badge key={role} variant={roleInfo.variant}>
                            {roleInfo.text}
                          </Badge>
                        );
                      })}
                    </div>
                  </td>

                  {/* PIN */}
                  <td className="px-6 py-4 whitespace-nowrap font-mono tracking-widest text-text-secondary">
                    {showPins[user.id] ? (
                      user.pin ? (
                        <span className="text-champagne-gold font-bold tracking-widest">{user.pin}</span>
                      ) : (
                        <span className="text-xs text-text-secondary/70 italic font-sans tracking-normal">
                          No visible (edita para asignar)
                        </span>
                      )
                    ) : (
                      <span>••••</span>
                    )}
                    <button
                      onClick={() => togglePinVisibility(user.id)}
                      className="ml-3 text-text-secondary hover:text-text-primary transition-colors focus:outline-none"
                      title={showPins[user.id] ? 'Ocultar PIN' : 'Mostrar PIN'}
                    >
                      {showPins[user.id] ? (
                        <svg className="w-4 h-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    {isConfirmingDelete ? (
                      <div className="flex items-center justify-end gap-2 animate-fade-in">
                        <span className="text-xs text-error-red font-medium mr-1 select-none">
                          ¿Confirmar?
                        </span>
                        <button
                          onClick={() => handleConfirmDelete(user.id)}
                          className="px-2.5 py-1 text-xs font-semibold bg-error-red text-white hover:bg-red-700 rounded transition-all active:scale-95"
                        >
                          Sí
                        </button>
                        <button
                          onClick={handleCancelDelete}
                          className="px-2.5 py-1 text-xs font-semibold bg-charcoal-surface text-text-secondary hover:text-text-primary border border-aged-bronze/30 rounded transition-all active:scale-95"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onEdit(user)}
                          className="p-1.5 rounded-full border border-transparent hover:border-champagne-gold/30 hover:bg-champagne-gold/10 text-text-secondary hover:text-champagne-gold transition-all duration-300 focus:outline-none"
                          title="Editar empleado"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19.5 7.125L16.875 4.5" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteClick(user.id)}
                          className="p-1.5 rounded-full border border-transparent hover:border-error-red/20 hover:bg-error-red/10 text-text-secondary hover:text-error-red transition-all duration-300 focus:outline-none"
                          title="Eliminar acceso (Revocar)"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
