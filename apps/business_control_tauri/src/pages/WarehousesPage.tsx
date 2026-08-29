import React, { useState, useEffect, useCallback } from 'react';
import { api, Warehouse } from '../services/api';
import { Button } from '../components/atoms/Button';
import { Heading } from '../components/atoms/Heading';
import { ToastContainer } from '../components/molecules/ToastNotification';

interface WarehousesPageProps {
  businessId: string;
}

export const WarehousesPage: React.FC<WarehousesPageProps> = ({ businessId }) => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' | 'warning' }>>([]);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [locationType, setLocationType] = useState<'warehouse' | 'factory'>('warehouse');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const fetchWarehouses = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getWarehouses(businessId);
      setWarehouses(data);
    } catch (error: any) {
      showToast(error.message || 'Error al cargar el listado de bodegas.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [businessId, showToast]);

  useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('El nombre de la bodega es obligatorio.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.addWarehouse({
        name: name.trim(),
        code: code.trim() || undefined,
        address: address.trim() || undefined,
        locationType,
      }, businessId);
      
      showToast('Bodega creada exitosamente.', 'success');
      setName('');
      setCode('');
      setAddress('');
      setLocationType('warehouse');
      fetchWarehouses();
    } catch (error: any) {
      showToast(error.message || 'Error al crear la bodega.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de que desea eliminar esta bodega?')) return;

    try {
      await api.deleteWarehouse(id);
      showToast('Bodega eliminada exitosamente.', 'success');
      fetchWarehouses();
    } catch (error: any) {
      showToast(error.message || 'Error al eliminar la bodega.', 'error');
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full pb-12 animate-fade-in">
      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-aged-bronze/25 pb-4">
        <div>
          <Heading level={1} className="!border-none !pb-0 tracking-wide font-light">
            Bodegas y Almacenamiento
          </Heading>
          <p className="text-sm text-text-secondary mt-1">
            Administra los centros de acopio, fábricas de ensamble y bodegas asignadas a esta línea de negocio.
          </p>
        </div>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Registration form */}
        <div className="lg:col-span-1">
          <div className="border border-aged-bronze/30 bg-onyx-surface p-6 shadow-md rounded-lg">
            <h2 className="text-lg font-display text-champagne-gold tracking-wide mb-4">
              Nueva Bodega
            </h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                  Nombre de la Bodega *
                </label>
                <input
                  type="text"
                  placeholder="Ej. Bodega Central de Insumos"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-charcoal border border-aged-bronze/45 rounded-md px-3 py-2 text-sm text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-champagne-gold focus:ring-1 focus:ring-champagne-gold/30 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                  Tipo de Bodega *
                </label>
                <select
                  value={locationType}
                  onChange={(e) => setLocationType(e.target.value as 'warehouse' | 'factory')}
                  className="w-full bg-charcoal border border-aged-bronze/45 rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-champagne-gold focus:ring-1 focus:ring-champagne-gold/30 transition-colors"
                >
                  <option value="warehouse">Bodega / Almacén</option>
                  <option value="factory">Fábrica de Ensamble</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                  Código Identificador
                </label>
                <input
                  type="text"
                  placeholder="Ej. B-CENTRAL"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full bg-charcoal border border-aged-bronze/45 rounded-md px-3 py-2 text-sm text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-champagne-gold focus:ring-1 focus:ring-champagne-gold/30 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                  Dirección
                </label>
                <textarea
                  placeholder="Calle, Número, Sucursal..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  className="w-full bg-charcoal border border-aged-bronze/45 rounded-md px-3 py-2 text-sm text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-champagne-gold focus:ring-1 focus:ring-champagne-gold/30 transition-all resize-none"
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-champagne-gold hover:bg-champagne-gold/90 text-onyx-surface font-semibold tracking-wider uppercase text-xs transition-transform transform active:scale-95 duration-150 py-2.5 rounded shadow-lg"
                >
                  {isSubmitting ? 'Registrando...' : 'Registrar Bodega'}
                </Button>
              </div>

            </form>
          </div>
        </div>

        {/* Warehouses list */}
        <div className="lg:col-span-2">
          <div className="border border-aged-bronze/25 bg-onyx-surface/80 p-0 shadow-md rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-aged-bronze/20 flex justify-between items-center">
              <h3 className="text-base font-semibold text-text-primary">
                Bodegas Registradas
              </h3>
              <span className="text-xs text-text-secondary font-sans font-medium px-2 py-0.5 rounded-full bg-charcoal border border-aged-bronze/15">
                Total: {warehouses.length}
              </span>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center py-16 text-text-secondary gap-3">
                <svg className="animate-spin h-5 w-5 text-champagne-gold" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Cargando bodegas...</span>
              </div>
            ) : warehouses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <svg className="w-12 h-12 text-text-secondary/40 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <p className="text-sm font-medium text-text-primary">No hay bodegas registradas</p>
                <p className="text-xs text-text-secondary mt-1">Registra una bodega usando el formulario de la izquierda.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-charcoal/40 text-[10px] text-text-secondary uppercase tracking-wider border-b border-aged-bronze/20">
                      <th className="px-6 py-3 font-semibold">Código</th>
                      <th className="px-6 py-3 font-semibold">Nombre</th>
                      <th className="px-6 py-3 font-semibold">Tipo</th>
                      <th className="px-6 py-3 font-semibold">Dirección</th>
                      <th className="px-6 py-3 font-semibold text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-aged-bronze/10 text-sm">
                    {warehouses.map((w) => (
                      <tr key={w.id} className="hover:bg-charcoal/20 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-champagne-gold">
                          {w.code || '-'}
                        </td>
                        <td className="px-6 py-4 font-semibold text-text-primary">
                          {w.name}
                        </td>
                        <td className="px-6 py-4 text-xs">
                          {w.locationType === 'factory' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider bg-champagne-gold/15 text-champagne-gold">Fábrica</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider bg-charcoal/60 text-text-secondary">Bodega</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-text-secondary max-w-[200px] truncate">
                          {w.address || '-'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleDelete(w.id)}
                            className="text-error-red hover:text-error-red/80 hover:bg-error-red/10 border border-transparent hover:border-error-red/20 px-2 py-1 rounded text-xs transition-all duration-200"
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
