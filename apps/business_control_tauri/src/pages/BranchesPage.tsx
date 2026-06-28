import React, { useState, useEffect } from 'react';
import { api, Branch } from '../services/api';
import { Heading } from '../components/atoms/Heading';
import { Button } from '../components/atoms/Button';
import { Input } from '../components/atoms/Input';
import { FormField } from '../components/molecules/FormField';

interface BranchesPageProps {
  businessId: string;
}

export const BranchesPage: React.FC<BranchesPageProps> = ({ businessId }) => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [address, setAddress] = useState<string>('');

  // Search/Filter State
  const [searchTerm, setSearchTerm] = useState<string>('');

  const fetchBranches = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getBranches(businessId);
      setBranches(data);
    } catch (err: any) {
      console.error(err);
      setError('Error al cargar sucursales. Asegúrese de que el servidor esté activo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
    resetForm();
  }, [businessId]);

  const resetForm = () => {
    setIsEditing(false);
    setEditId(null);
    setName('');
    setPhone('');
    setAddress('');
  };

  const handleEdit = (branch: Branch) => {
    setIsEditing(true);
    setEditId(branch.id);
    setName(branch.name);
    setPhone(branch.phone || '');
    setAddress(branch.address || '');
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`¿Está seguro de que desea eliminar la sucursal "${name}"?`)) {
      try {
        await api.deleteBranch(id);
        setBranches(branches.filter((b) => b.id !== id));
      } catch (err: any) {
        console.error(err);
        const errMsg = err.message || 'No se puede eliminar la sucursal porque tiene registros asociados (mesas, pedidos, personal o inventario).';
        alert(errMsg);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      if (isEditing && editId) {
        const updated = await api.updateBranch(editId, {
          name,
          phone: phone || undefined,
          address: address || undefined,
        });
        setBranches(branches.map((b) => (b.id === editId ? updated : b)));
      } else {
        const created = await api.addBranch({
          name,
          phone: phone || undefined,
          address: address || undefined,
        }, businessId);
        setBranches([...branches, created]);
      }
      resetForm();
    } catch (err: any) {
      alert(err.message || 'Error al guardar la sucursal. Verifique los campos.');
    }
  };

  const filteredBranches = branches.filter((b) =>
    b.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-full lg:h-full min-h-full bg-obsidian p-2 lg:p-6 font-sans overflow-y-auto lg:overflow-hidden">
      <div className="flex flex-col lg:flex-row gap-6 min-h-fit lg:h-full max-w-7xl mx-auto w-full">
        {/* Left Side: Branches List */}
        <div className="flex-1 bg-onyx-surface border border-aged-bronze/40 rounded-lg p-4 lg:p-6 flex flex-col lg:h-full overflow-hidden shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <Heading level={2} className="!text-lg sm:!text-2xl !border-none !pb-0 text-champagne-gold tracking-wide font-light">
              Sucursales (Puntos de Venta)
            </Heading>
            <div className="w-full sm:w-64">
              <Input
                type="text"
                placeholder="Buscar sucursal..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="!py-1.5 text-xs"
              />
            </div>
          </div>

          {error && (
            <div className="bg-error-red/10 border border-error-red/30 text-error-red rounded p-3 text-xs mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <svg className="animate-spin h-6 w-6 text-champagne-gold" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : filteredBranches.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-text-secondary text-xs py-12">
              <svg className="w-12 h-12 text-aged-bronze/50 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span>No se encontraron sucursales registradas para este negocio.</span>
            </div>
          ) : (
            <>
              {/* Mobile Card List */}
              <div className="flex-1 flex flex-col gap-3 lg:hidden overflow-y-auto max-h-[450px]">
                {filteredBranches.map((b) => (
                  <div key={b.id} className="bg-charcoal/40 border border-aged-bronze/20 rounded-md p-4 flex flex-col gap-2 relative">
                    <div className="flex justify-between items-start pr-16">
                      <div>
                        <h4 className="font-semibold text-text-primary text-sm">{b.name}</h4>
                        {b.phone && (
                          <span className="text-[10px] text-text-secondary block mt-0.5">
                            Tel: {b.phone}
                          </span>
                        )}
                      </div>
                      
                      {/* Action buttons */}
                      <div className="absolute top-4 right-4 flex gap-1">
                        <button
                          onClick={() => handleEdit(b)}
                          className="text-champagne-gold hover:text-champagne-gold/80 transition-colors p-1"
                          title="Editar"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(b.id, b.name)}
                          className="text-error-red hover:text-error-red/80 transition-colors p-1"
                          title="Eliminar"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    
                    {b.address && (
                      <div className="text-[11px] text-text-secondary border-t border-aged-bronze/10 pt-1.5 mt-0.5">
                        <span className="font-medium text-text-secondary">Dirección: </span>
                        <span>{b.address}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block flex-1 overflow-y-auto border border-aged-bronze/20 rounded-md">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-charcoal-surface border-b border-aged-bronze/30 text-text-secondary uppercase tracking-wider text-[10px]">
                      <th className="p-4 font-semibold">Nombre</th>
                      <th className="p-4 font-semibold">Teléfono</th>
                      <th className="p-4 font-semibold">Dirección</th>
                      <th className="p-4 font-semibold text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-aged-bronze/10">
                    {filteredBranches.map((b) => (
                      <tr key={b.id} className="hover:bg-charcoal-surface/30 transition-colors">
                        <td className="p-4 font-medium text-text-primary">{b.name}</td>
                        <td className="p-4 text-text-secondary">{b.phone || '-'}</td>
                        <td className="p-4 text-text-secondary max-w-xs truncate" title={b.address || ''}>
                          {b.address || '-'}
                        </td>
                        <td className="p-4 text-right">
                          <div className="inline-flex gap-2">
                            <button
                              onClick={() => handleEdit(b)}
                              className="text-champagne-gold hover:text-champagne-gold/80 transition-colors p-1"
                              title="Editar"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(b.id, b.name)}
                              className="text-error-red hover:text-error-red/80 transition-colors p-1"
                              title="Eliminar"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Right Side: Form Card */}
        <div className="w-full lg:w-96 bg-onyx-surface border border-aged-bronze/40 rounded-lg p-6 flex flex-col lg:h-full lg:overflow-y-auto shadow-xl flex-shrink-0">
          <Heading level={3} className="!border-none !pb-0 text-champagne-gold tracking-wide font-light mb-6">
            {isEditing ? 'Editar Sucursal' : 'Registrar Sucursal'}
          </Heading>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <FormField label="Nombre de Sucursal" required>
              <Input
                type="text"
                placeholder="Ej. Cacharelo Sur"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </FormField>

            <FormField label="Teléfono">
              <Input
                type="text"
                placeholder="Ej. 5559876543"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </FormField>

            <FormField label="Dirección / Ubicación">
              <textarea
                placeholder="Ej. Av. Universidad 1200, Col. del Valle"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                className="w-full bg-charcoal-surface border border-aged-bronze focus:border-champagne-gold text-text-primary rounded-md p-3 font-sans text-xs focus:outline-none transition-all resize-none"
              />
            </FormField>

            <div className="flex gap-3 mt-4">
              <Button type="submit" variant="primary" className="flex-1">
                {isEditing ? 'Guardar Cambios' : 'Registrar'}
              </Button>
              <Button type="button" variant="secondary" onClick={resetForm}>
                {isEditing ? 'Cancelar' : 'Limpiar'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
