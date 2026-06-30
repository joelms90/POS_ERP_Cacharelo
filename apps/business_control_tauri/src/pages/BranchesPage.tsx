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
  const [linkingBranch, setLinkingBranch] = useState<Branch | null>(null);
  const [configuringTablesBranch, setConfiguringTablesBranch] = useState<Branch | null>(null);
  const [tables, setTables] = useState<any[]>([]);
  const [tablesLoading, setTablesLoading] = useState<boolean>(false);
  const [newTableLabel, setNewTableLabel] = useState<string>('');
  const [newTableCapacity, setNewTableCapacity] = useState<number>(4);
  const [newTableRoom, setNewTableRoom] = useState<string>('Salón Principal');
  const [modalTab, setModalTab] = useState<'list' | 'map'>('list');
  const [floorPlanImage, setFloorPlanImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1.0);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 900, height: 900 });
  const [selectedRoom, setSelectedRoom] = useState<string>('General');

  const fetchTables = async () => {
    if (!configuringTablesBranch) return;
    try {
      setTablesLoading(true);
      const data = await api.getBranchTables(configuringTablesBranch.id);
      setTables(data);
    } catch (err) {
      console.error(err);
    } finally {
      setTablesLoading(false);
    }
  };

  useEffect(() => {
    if (configuringTablesBranch) {
      fetchTables();
    }
  }, [configuringTablesBranch]);

  useEffect(() => {
    if (tables.length > 0 && !floorPlanImage) {
      const maxTableY = Math.max(0.01, ...tables.map(t => t.y || 0));
      const calculatedHeight = Math.max(900, Math.round(maxTableY * 1000) + 120);
      setCanvasDimensions({ width: 900, height: calculatedHeight });
    }
  }, [tables, floorPlanImage]);

  useEffect(() => {
    if (!configuringTablesBranch) return;
    let configs: Record<string, any> = {};
    try {
      configs = configuringTablesBranch.roomConfigs ? JSON.parse(configuringTablesBranch.roomConfigs) : {};
    } catch (e) {}

    const roomConfig = configs[selectedRoom] || { image: null, zoom: 1.0, canvasHeight: 900 };
    setFloorPlanImage(roomConfig.image || null);
    setZoom(roomConfig.zoom || 1.0);
    setCanvasDimensions({ width: 900, height: roomConfig.canvasHeight || 900 });
  }, [selectedRoom, configuringTablesBranch]);

  useEffect(() => {
    if (tables.length > 0) {
      const distinctRooms = Array.from(new Set(tables.map(t => t.room || 'General')));
      if (distinctRooms.length > 0 && !distinctRooms.includes(selectedRoom)) {
        setSelectedRoom(distinctRooms[0]);
      }
    }
  }, [tables]);

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configuringTablesBranch || !newTableLabel.trim()) return;
    try {
      await api.addBranchTable(configuringTablesBranch.id, {
        label: newTableLabel,
        capacity: newTableCapacity,
        room: newTableRoom,
      });
      setNewTableLabel('');
      fetchTables();
    } catch (err: any) {
      alert(err.message || 'Error al agregar mesa');
    }
  };

  const handleDeleteTable = async (tableId: string) => {
    if (!configuringTablesBranch) return;
    try {
      await api.deleteBranchTable(configuringTablesBranch.id, tableId);
      fetchTables();
    } catch (err: any) {
      alert(err.message || 'Error al eliminar mesa');
    }
  };

  const handleGenerateLayout = async (mode: 'cafeteria' | 'mostrador') => {
    if (!configuringTablesBranch) return;
    const msg = mode === 'cafeteria'
      ? 'Esto eliminará todas las mesas actuales y generará un layout de Cafetería de 16 mesas (Salón General, Terraza y Barra). ¿Desea continuar?'
      : 'Esto eliminará todas las mesas actuales y configurará el Modo Mostrador (una sola mesa virtual de cobro directo). ¿Desea continuar?';
    
    if (confirm(msg)) {
      try {
        setTablesLoading(true);
        await api.generateBranchTables(configuringTablesBranch.id, mode);
        await fetchTables();
      } catch (err: any) {
        alert(err.message || 'Error al generar layout');
      } finally {
        setTablesLoading(false);
      }
    }
  };
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;

      const img = new Image();
      img.onload = () => {
        // Proportional canvas mapping
        const width = 900;
        const height = Math.round((img.height / img.width) * width);
        setCanvasDimensions({ width, height });

        // Downscale image to low-res for base64 saving
        const maxDim = 1024;
        let targetW = img.width;
        let targetH = img.height;
        if (targetW > maxDim || targetH > maxDim) {
          if (targetW > targetH) {
            targetH = Math.round((targetH / targetW) * maxDim);
            targetW = maxDim;
          } else {
            targetW = Math.round((targetW / targetH) * maxDim);
            targetH = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, targetW, targetH);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6);
          setFloorPlanImage(compressedDataUrl);
        } else {
          setFloorPlanImage(dataUrl);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleTableMouseDown = (e: React.MouseEvent, table: any) => {
    e.preventDefault();
    const rect = e.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect) return;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newX = (moveEvent.clientX - rect.left - 24) / (rect.width - 48);
      const newY = (moveEvent.clientY - rect.top - 24) / (rect.height - 48);
      
      const clampedX = Math.max(0.01, Math.min(0.99, newX));
      const clampedY = Math.max(0.01, Math.min(1.99, newY));

      setTables(prev => prev.map(t => t.id === table.id ? { ...t, x: clampedX, y: clampedY } : t));
    };

    const handleMouseUp = async (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      const finalX = (upEvent.clientX - rect.left - 24) / (rect.width - 48);
      const finalY = (upEvent.clientY - rect.top - 24) / (rect.height - 48);
      const clampedX = Math.max(0.01, Math.min(0.99, finalX));
      const clampedY = Math.max(0.01, Math.min(1.99, finalY));

      try {
        await api.updateBranchTable(configuringTablesBranch!.id, table.id, {
          x: clampedX,
          y: clampedY,
        });
      } catch (err) {
        console.error('Error updating table coordinate:', err);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleToggleShape = async (table: any) => {
    const newShape = table.shape === 'circle' ? 'square' : 'circle';
    try {
      setTables(prev => prev.map(t => t.id === table.id ? { ...t, shape: newShape } : t));
      await api.updateBranchTable(configuringTablesBranch!.id, table.id, {
        shape: newShape,
      });
    } catch (err) {
      console.error('Error updating table shape:', err);
    }
  };
  const handleSaveLayout = async () => {
    if (!configuringTablesBranch) return;
    try {
      let currentConfigs: Record<string, any> = {};
      try {
        currentConfigs = configuringTablesBranch.roomConfigs ? JSON.parse(configuringTablesBranch.roomConfigs) : {};
      } catch (e) {}

      currentConfigs[selectedRoom] = {
        image: floorPlanImage,
        zoom: zoom,
        canvasHeight: canvasDimensions.height
      };

      const updatedBranch = await api.updateBranch(configuringTablesBranch.id, {
        roomConfigs: JSON.stringify(currentConfigs)
      });
      
      setConfiguringTablesBranch(updatedBranch);
      alert('¡Layout, imagen de fondo y escala de zoom guardados exitosamente!');
    } catch (err: any) {
      alert('Error al guardar layout: ' + (err.message || err));
    }
  };

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
                          onClick={() => setLinkingBranch(b)}
                          className="text-champagne-gold hover:text-champagne-gold/80 transition-colors p-1"
                          title="Vincular Terminal POS"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m0 8v1M4 8h.01M4 12h.01M4 16h.01M20 8h.01M20 12h.01M20 16h.01M8 4h.01M8 20h.01M16 4h.01M16 20h.01M9 9h6v6H9V9z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setConfiguringTablesBranch(b)}
                          className="text-champagne-gold hover:text-champagne-gold/80 transition-colors p-1"
                          title="Configurar Mesas / Layout"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                          </svg>
                        </button>
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
                              onClick={() => setLinkingBranch(b)}
                              className="text-champagne-gold hover:text-champagne-gold/80 transition-colors p-1"
                              title="Vincular Terminal POS"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m0 8v1M4 8h.01M4 12h.01M4 16h.01M20 8h.01M20 12h.01M20 16h.01M8 4h.01M8 20h.01M16 4h.01M16 20h.01M9 9h6v6H9V9z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setConfiguringTablesBranch(b)}
                              className="text-champagne-gold hover:text-champagne-gold/80 transition-colors p-1"
                              title="Configurar Mesas / Layout"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                              </svg>
                            </button>
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

      {linkingBranch && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-onyx-surface border border-aged-bronze/50 rounded-lg p-6 max-w-sm w-full flex flex-col items-center text-center shadow-2xl relative">
            <button
              onClick={() => setLinkingBranch(null)}
              className="absolute top-4 right-4 text-text-secondary hover:text-text-primary transition-colors p-1"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <Heading level={3} className="!border-none !pb-0 text-champagne-gold tracking-wide font-light mb-2">
              Vincular Terminal POS
            </Heading>
            <p className="text-xs text-text-secondary mb-6">
              Escanee cualquiera de los códigos de activación desde la terminal POS para vincularla a la sucursal <strong>{linkingBranch.name}</strong>.
            </p>

            <div className="flex gap-4 mb-6">
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-text-secondary mb-1">Código QR</span>
                <div className="bg-white p-2 rounded border border-aged-bronze/20">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${linkingBranch.id}`}
                    alt="Activation QR"
                    className="w-28 h-28"
                  />
                </div>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-text-secondary mb-1">Data Matrix</span>
                <div className="bg-white p-2 rounded border border-aged-bronze/20">
                  <img
                    src={`https://barcode.tec-it.com/barcode.ashx?data=${linkingBranch.id}&code=DataMatrix`}
                    alt="Activation DataMatrix"
                    className="w-28 h-28"
                  />
                </div>
              </div>
            </div>

            <div className="w-full text-center bg-charcoal-surface/40 border border-aged-bronze/20 rounded p-2 text-xs font-mono text-text-primary select-all">
              {linkingBranch.id}
            </div>
            <span className="text-[9px] text-text-secondary mt-1.5 self-start">
              * Si la cámara no responde o es de baja calidad, escriba el código UUID anterior en la terminal.
            </span>
          </div>
        </div>
      )}

      {configuringTablesBranch && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-onyx-surface border border-aged-bronze/50 rounded-lg p-6 max-w-4xl w-full flex flex-col shadow-2xl relative max-h-[90vh] overflow-hidden">
            <button
              onClick={() => setConfiguringTablesBranch(null)}
              className="absolute top-4 right-4 text-text-secondary hover:text-text-primary transition-colors p-1"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <Heading level={3} className="!border-none !pb-2 text-champagne-gold tracking-wide font-light">
              Mesas y Layout: {configuringTablesBranch.name}
            </Heading>
            
            {/* Quick Actions / Presets */}
            <div className="flex flex-wrap gap-3 mb-6 bg-charcoal/20 border border-aged-bronze/10 rounded p-3">
              <span className="text-xs text-text-secondary self-center mr-2">Autogenerar Layout:</span>
              <Button 
                type="button" 
                variant="secondary" 
                size="sm" 
                onClick={() => handleGenerateLayout('cafeteria')}
                className="!text-[10px] border border-champagne-gold/30 hover:border-champagne-gold"
              >
                Layout Cafetería (16 mesas)
              </Button>
              <Button 
                type="button" 
                variant="secondary" 
                size="sm" 
                onClick={() => handleGenerateLayout('mostrador')}
                className="!text-[10px] border border-error-red/30 hover:border-error-red !text-error-red hover:bg-error-red/5"
              >
                Modo Mostrador (Caja Única)
              </Button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-aged-bronze/35 mb-4">
              <button
                type="button"
                onClick={() => setModalTab('list')}
                className={`px-4 py-2 text-xs font-semibold tracking-wider transition-colors border-b-2 ${
                  modalTab === 'list'
                    ? 'border-champagne-gold text-champagne-gold'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                LISTA DE MESAS
              </button>
              <button
                type="button"
                onClick={() => setModalTab('map')}
                className={`px-4 py-2 text-xs font-semibold tracking-wider transition-colors border-b-2 ${
                  modalTab === 'map'
                    ? 'border-champagne-gold text-champagne-gold'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                MAPA DE DISTRIBUCIÓN (EDITOR VISUAL)
              </button>
            </div>

            {modalTab === 'list' ? (
              /* Split Panel View */
              <div className="flex flex-col lg:flex-row gap-6 overflow-hidden flex-1">
                
                {/* Left Panel: Table Grid */}
                <div className="flex-1 flex flex-col min-h-0">
                  <span className="text-xs font-semibold text-text-primary mb-3">Mesas Configuradas ({tables.length})</span>
                  {tablesLoading ? (
                    <div className="flex-1 flex items-center justify-center text-xs text-text-secondary">Cargando mesas...</div>
                  ) : tables.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-aged-bronze/20 rounded p-6 text-center">
                      <svg className="w-8 h-8 text-text-secondary mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <span className="text-xs text-text-secondary">No hay mesas configuradas en esta sucursal.</span>
                      <span className="text-[10px] text-text-secondary/60 mt-1">Utilice los presets rápidos arriba para autogenerar o agregue una a la derecha.</span>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[40vh] lg:max-h-none">
                      {tables.map((t) => (
                        <div key={t.id} className="bg-charcoal/30 border border-aged-bronze/10 rounded p-3 flex justify-between items-center group">
                          <div>
                            <span className="text-xs font-medium text-text-primary block">{t.label}</span>
                            <span className="text-[10px] text-text-secondary block mt-0.5">Cap: {t.capacity} • {t.room}</span>
                          </div>
                          <button
                            onClick={() => handleDeleteTable(t.id)}
                            className="text-text-secondary hover:text-error-red p-1 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
                            title="Eliminar Mesa"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right Panel: Creation Form */}
                <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-aged-bronze/10 pt-6 lg:pt-0 lg:pl-6">
                  <span className="text-xs font-semibold text-text-primary block mb-4">Agregar Nueva Mesa</span>
                  <form onSubmit={handleAddTable} className="flex flex-col gap-4">
                    <FormField label="Identificador / Etiqueta" required>
                      <Input
                        type="text"
                        placeholder="Ej. Mesa 1"
                        value={newTableLabel}
                        onChange={(e) => setNewTableLabel(e.target.value)}
                        required
                      />
                    </FormField>
                    <FormField label="Capacidad (Personas)">
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={newTableCapacity}
                        onChange={(e) => setNewTableCapacity(parseInt(e.target.value) || 4)}
                      />
                    </FormField>
                    <FormField label="Salón / Área">
                      <Input
                        type="text"
                        placeholder="Ej. Terraza, Barra, Salón Principal"
                        value={newTableRoom}
                        onChange={(e) => setNewTableRoom(e.target.value)}
                      />
                    </FormField>
                    <Button type="submit" variant="primary" className="w-full mt-2">
                      Crear Mesa
                    </Button>
                  </form>
                </div>
              </div>
            ) : (
              /* Visual Layout Editor Canvas */
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex flex-wrap justify-between items-center gap-3 mb-4 bg-charcoal/30 border border-aged-bronze/20 rounded p-3 text-xs">
                  <div className="flex flex-wrap items-center gap-4">
                    {/* Area selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-text-secondary uppercase font-bold tracking-wide">Área:</span>
                      <select
                        value={selectedRoom}
                        onChange={(e) => setSelectedRoom(e.target.value)}
                        className="bg-charcoal-surface border border-aged-bronze/45 rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-champagne-gold"
                      >
                        {Array.from(new Set(tables.map(t => t.room || 'General'))).concat(tables.length === 0 ? ['General'] : []).map(rm => (
                          <option key={rm} value={rm}>{rm}</option>
                        ))}
                      </select>
                    </div>

                    {/* Reference image selector */}
                    <div className="flex items-center gap-2">
                      <label className="bg-charcoal-surface border border-aged-bronze text-text-primary px-3 py-1.5 rounded cursor-pointer hover:border-champagne-gold transition-colors text-[10px] uppercase font-bold tracking-wider">
                        Subir Imagen de Referencia
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </label>
                      {floorPlanImage ? (
                        <button
                          type="button"
                          onClick={() => {
                            setFloorPlanImage(null);
                            const maxTableY = Math.max(0.01, ...tables.filter(t => (t.room || 'General') === selectedRoom).map(t => t.y || 0));
                            const calculatedHeight = Math.max(900, Math.round(maxTableY * 1000) + 120);
                            setCanvasDimensions({ width: 900, height: calculatedHeight });
                          }}
                          className="text-error-red hover:underline text-[10px] uppercase font-bold"
                        >
                          Quitar Imagen
                        </button>
                      ) : (
                        <span className="text-[10px] text-text-secondary">Sube un plano como fondo</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Zoom Controls */}
                    <div className="flex items-center gap-2 bg-charcoal-surface border border-aged-bronze/20 rounded px-2.5 py-1">
                      <span className="text-[10px] text-text-secondary mr-1 uppercase font-bold tracking-wide">Zoom:</span>
                      <button
                        type="button"
                        onClick={() => setZoom(prev => Math.max(0.25, prev - 0.25))}
                        className="text-text-secondary hover:text-champagne-gold px-1 font-bold text-xs"
                        title="Zoom Out"
                      >
                        -
                      </button>
                      <span className="text-[10px] text-text-primary font-mono w-9 text-center">
                        {Math.round(zoom * 100)}%
                      </span>
                      <button
                        type="button"
                        onClick={() => setZoom(prev => Math.min(3.0, prev + 0.25))}
                        className="text-text-secondary hover:text-champagne-gold px-1 font-bold text-xs"
                        title="Zoom In"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => setZoom(1.0)}
                        className="text-[9px] text-champagne-gold hover:underline ml-1 uppercase font-bold"
                      >
                        Reset
                      </button>
                    </div>

                    {/* Save Button */}
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={handleSaveLayout}
                      className="!py-1.5 shadow-md bg-champagne-gold hover:bg-champagne-gold/90 text-charcoal"
                    >
                      Guardar Cambios
                    </Button>
                  </div>
                </div>

                <div className="flex-1 overflow-auto border border-aged-bronze/30 rounded-md bg-black/40 relative">
                  <div
                    style={{
                      width: `${canvasDimensions.width * zoom}px`,
                      height: `${canvasDimensions.height * zoom}px`,
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        width: `${canvasDimensions.width}px`,
                        height: `${canvasDimensions.height}px`,
                        transform: `scale(${zoom})`,
                        transformOrigin: 'top left',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        backgroundImage: 'linear-gradient(to right, rgba(163, 137, 89, 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(163, 137, 89, 0.04) 1px, transparent 1px)',
                        backgroundSize: '40px 40px',
                      }}
                    >
                      {floorPlanImage && (
                        <img
                          src={floorPlanImage}
                          alt="Floor plan reference"
                          className="absolute inset-0 w-full h-full object-cover opacity-30 select-none pointer-events-none"
                        />
                      )}

                      {tables.filter(t => (t.room || 'General') === selectedRoom).map(t => {
                        const isCircle = t.shape === 'circle';
                        return (
                          <div
                            key={t.id}
                            onMouseDown={(e) => handleTableMouseDown(e, t)}
                            onDoubleClick={() => handleToggleShape(t)}
                            style={{
                              position: 'absolute',
                              left: `${(t.x || 0) * (canvasDimensions.width - 60)}px`,
                              top: `${(t.y || 0) * (canvasDimensions.height - 60)}px`,
                              width: '60px',
                              height: '60px',
                            }}
                            className={`flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none text-[9px] font-bold border transition-colors shadow-lg z-10 ${
                              isCircle ? 'rounded-full' : 'rounded-md'
                            } ${
                              t.state === 'occupied'
                                ? 'bg-success-green/20 border-success-green text-success-green'
                                : t.state === 'billing'
                                ? 'bg-champagne-gold/20 border-champagne-gold text-champagne-gold'
                                : 'bg-charcoal-surface border-aged-bronze/40 text-text-primary hover:border-champagne-gold'
                            }`}
                            title={`${t.label} (Área: ${t.room})`}
                          >
                            <span className="truncate max-w-[50px]">{t.label}</span>
                            <span className="text-[8px] opacity-75 mt-0.5">Cap: {t.capacity}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
