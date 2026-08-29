import React, { useState, useEffect, useCallback } from 'react';
import { api, BranchRequisition, BranchRequisitionItem, Branch, Warehouse, Product } from '../services/api';
import { Heading } from '../components/atoms/Heading';
import { Button } from '../components/atoms/Button';
import { Input } from '../components/atoms/Input';
import { FormField } from '../components/molecules/FormField';
import { Autocomplete } from '../components/molecules/Autocomplete';
import { ToastContainer } from '../components/molecules/ToastNotification';

interface RequisitionsPageProps {
  businessId: string;
  userId: string;
  userRole: string;
}

interface RequisitionLineItem {
  productId: string;
  productName: string;
  quantityRequested: number;
}

export const RequisitionsPage: React.FC<RequisitionsPageProps> = ({ businessId, userId, userRole }) => {
  const [requisitions, setRequisitions] = useState<BranchRequisition[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [fromBranchId, setFromBranchId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [reqNotes, setReqNotes] = useState('');
  const [items, setItems] = useState<RequisitionLineItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedProductId, setSelectedProductId] = useState('');
  const [itemQuantity, setItemQuantity] = useState('1');

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingQuantity, setEditingQuantity] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [viewingReq, setViewingReq] = useState<BranchRequisition | null>(null);
  const [viewingReqItems, setViewingReqItems] = useState<BranchRequisitionItem[]>([]);

  const [approvingReq, setApprovingReq] = useState<BranchRequisition | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');

  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' | 'warning' }>>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const isApprover = userRole === 'owner' || userRole === 'inventory_admin' || userRole === 'support_tech';

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [branchesData, warehousesData, productsData, requisitionsData] = await Promise.all([
        api.getBranches(businessId),
        api.getWarehouses(businessId),
        api.getProducts(businessId),
        api.getAllRequisitions(businessId),
      ]);
      setBranches(branchesData);
      setWarehouses(warehousesData);
      setProducts(productsData);
      setRequisitions(requisitionsData);

      if (branchesData.length > 0) setFromBranchId(branchesData[0].id);
      if (warehousesData.length > 0) setToWarehouseId(warehousesData[0].id);
    } catch (err: any) {
      setError('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setIsCreating(false);
    setFromBranchId(branches.length > 0 ? branches[0].id : '');
    setToWarehouseId(warehouses.length > 0 ? warehouses[0].id : '');
    setReqNotes('');
    setItems([]);
    setSelectedProductId('');
    setItemQuantity('1');
    setEditingIndex(null);
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      showToast('Seleccione un producto.', 'warning');
      return;
    }
    const qty = parseFloat(itemQuantity);
    if (isNaN(qty) || qty <= 0) {
      showToast('La cantidad debe ser mayor a cero.', 'warning');
      return;
    }

    const product = products.find((p) => p.id === selectedProductId);
    const productName = product ? product.name : 'Insumo';

    const existingIndex = items.findIndex((it) => it.productId === selectedProductId);
    if (existingIndex > -1) {
      const newItems = [...items];
      newItems[existingIndex].quantityRequested += qty;
      setItems(newItems);
      showToast(`Se actualizó la cantidad de "${productName}".`, 'success');
    } else {
      setItems((prev) => [...prev, { productId: selectedProductId, productName, quantityRequested: qty }]);
    }
    setSelectedProductId('');
    setItemQuantity('1');
  };

  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const handleStartEditing = (index: number) => {
    setEditingIndex(index);
    setEditingQuantity(items[index].quantityRequested.toString());
  };

  const handleSaveEdit = (index: number) => {
    const qty = parseFloat(editingQuantity);
    if (isNaN(qty) || qty <= 0) {
      showToast('La cantidad debe ser mayor a cero.', 'warning');
      return;
    }
    const newItems = [...items];
    newItems[index].quantityRequested = qty;
    setItems(newItems);
    setEditingIndex(null);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingQuantity('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromBranchId) {
      showToast('Seleccione la sucursal que solicita.', 'warning');
      return;
    }
    if (!toWarehouseId) {
      showToast('Seleccione la bodega.', 'warning');
      return;
    }
    if (items.length === 0) {
      showToast('Agregue al menos un producto.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.createRequisition({
        businessId,
        fromBranchId,
        toWarehouseId,
        createdBy: userId,
        notes: reqNotes || undefined,
        items: items.map((it) => ({ productId: it.productId, quantityRequested: it.quantityRequested })),
      });
      showToast('Requisición creada exitosamente.', 'success');
      resetForm();
      await fetchData();
    } catch (err: any) {
      showToast(err.message || 'Error al crear la requisición.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewDetails = async (req: BranchRequisition) => {
    try {
      setLoading(true);
      const full = await api.getRequisition(req.id);
      setViewingReq(full);
      setViewingReqItems(full.items || []);
    } catch (err: any) {
      showToast(err.message || 'Error al cargar detalles.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!approvingReq) return;
    try {
      await api.updateRequisitionStatus(approvingReq.id, { status: 'approved', notes: approvalNotes || undefined });
      showToast('Requisición aprobada. Se generó el traspaso.', 'success');
      setApprovingReq(null);
      setApprovalNotes('');
      await fetchData();
    } catch (err: any) {
      showToast(err.message || 'Error al aprobar.', 'error');
    }
  };

  const handleReject = async () => {
    if (!approvingReq) return;
    if (!approvalNotes.trim()) {
      showToast('Debe proporcionar una razón de rechazo.', 'warning');
      return;
    }
    try {
      await api.updateRequisitionStatus(approvingReq.id, { status: 'rejected', notes: approvalNotes });
      showToast('Requisición rechazada.', 'success');
      setApprovingReq(null);
      setApprovalNotes('');
      await fetchData();
    } catch (err: any) {
      showToast(err.message || 'Error al rechazar.', 'error');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      pending: 'bg-gray-500/20 text-gray-300',
      pending_approval: 'bg-gray-500/20 text-gray-300',
      approved: 'bg-green-500/20 text-green-300',
      rejected: 'bg-red-500/20 text-red-300',
      completed: 'bg-blue-500/20 text-blue-300',
    };
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      pending_approval: 'Pendiente',
      approved: 'Aprobada',
      rejected: 'Rechazada',
      completed: 'Completada',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${badges[status] || badges.pending}`}>
        {labels[status] || status}
      </span>
    );
  };

  const filteredReqs = requisitions.filter((r) => {
    const q = searchQuery.toLowerCase();
    const branchName = branches.find((b) => b.id === r.fromBranchId)?.name || '';
    const matchesSearch = !q || branchName.toLowerCase().includes(q) || (r.notes || '').toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const isPending = (status: string) => status === 'pending' || status === 'pending_approval';

  return (
    <div className="w-full lg:h-full min-h-full bg-obsidian p-2 lg:p-6 font-sans overflow-y-auto lg:overflow-hidden">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div className="flex flex-col lg:flex-row gap-6 min-h-fit lg:h-full max-w-7xl mx-auto w-full">
        {/* Left Side: Requisitions List */}
        <div className="flex-1 flex flex-col gap-4 lg:h-full overflow-hidden">
          <div className="flex justify-between items-center">
            <Heading level={2} className="!text-lg sm:!text-2xl !border-none !pb-0 text-champagne-gold">
              Requisiciones
            </Heading>
            <Button onClick={() => { setIsCreating(true); resetForm(); }} disabled={isCreating}>
              + Nueva Requisición
            </Button>
          </div>

          {error && (
            <div className="bg-error-red/10 border border-error-red/30 text-error-red rounded p-3 text-xs">{error}</div>
          )}

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <svg className="animate-spin h-6 w-6 text-champagne-gold" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : requisitions.length === 0 && !isCreating ? (
            <div className="flex-1 flex flex-col items-center justify-center text-text-secondary text-xs">
              <span>No hay requisiciones registradas</span>
            </div>
          ) : (
            <>
              {/* Search and Filters Bar */}
              <div className="flex flex-col md:flex-row gap-4 bg-onyx-surface border border-aged-bronze/40 rounded p-4 shadow-md shadow-black/10 items-center justify-between">
                <div className="w-full md:w-72 relative">
                  <Input
                    type="text"
                    placeholder="Buscar por sucursal..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                  <svg className="w-4 h-4 text-text-secondary absolute left-3.5 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-secondary whitespace-nowrap">Estado:</span>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-3 py-1.5 bg-charcoal-surface border border-aged-bronze focus:border-champagne-gold rounded font-sans text-xs text-text-primary transition-all duration-300 focus:outline-none cursor-pointer"
                    >
                      <option value="all">Todos los Estados</option>
                      <option value="pending">Pendiente</option>
                      <option value="pending_approval">Pendiente</option>
                      <option value="approved">Aprobada</option>
                      <option value="rejected">Rechazada</option>
                      <option value="completed">Completada</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Requisitions Table Card */}
              <div className="flex-1 bg-onyx-surface border border-aged-bronze/40 rounded shadow-md shadow-black/20 overflow-hidden flex flex-col min-h-0">
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left border-collapse select-text">
                    <thead>
                      <tr className="bg-charcoal-surface/60 border-b border-aged-bronze/35 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                        <th className="px-6 py-4">Sucursal</th>
                        <th className="px-6 py-4">Bodega</th>
                        <th className="px-6 py-4 text-center">Items</th>
                        <th className="px-6 py-4 text-center">Estado</th>
                        <th className="px-6 py-4">Notas</th>
                        <th className="px-6 py-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-aged-bronze/20 text-sm">
                      {filteredReqs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-text-secondary italic">
                            {searchQuery || statusFilter !== 'all'
                              ? 'No se encontraron requisiciones que coincidan con la búsqueda.'
                              : 'No hay requisiciones registradas.'}
                          </td>
                        </tr>
                      ) : (
                        filteredReqs.map((req) => {
                          const branchName = branches.find((b) => b.id === req.fromBranchId)?.name || '—';
                          const whName = warehouses.find((w) => w.id === req.toWarehouseId)?.name || '—';
                          return (
                            <tr key={req.id} className="hover:bg-charcoal-surface/20 transition-colors">
                              <td className="px-6 py-4 font-medium text-text-primary text-xs">{branchName}</td>
                              <td className="px-6 py-4 text-text-secondary text-xs">{whName}</td>
                              <td className="px-6 py-4 text-center font-mono text-xs text-champagne-gold">{req.itemCount || 0}</td>
                              <td className="px-6 py-4 text-center">{getStatusBadge(req.status)}</td>
                              <td className="px-6 py-4 text-text-secondary text-xs max-w-[150px] truncate">{req.notes || '—'}</td>
                              <td className="px-6 py-4 text-right">
                                <div className="inline-flex gap-1">
                                  <button
                                    onClick={() => handleViewDetails(req)}
                                    className="text-text-secondary hover:text-champagne-gold transition-colors p-1 rounded hover:bg-champagne-gold/5"
                                    title="Ver detalle"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                  </button>
                                  {isApprover && isPending(req.status) && (
                                    <button
                                      onClick={() => setApprovingReq(req)}
                                      className="text-champagne-gold hover:underline text-xs px-2"
                                      title="Aprobar / Rechazar"
                                    >
                                      Revisar
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="bg-charcoal-surface/40 border-t border-aged-bronze/35 px-6 py-3 flex items-center justify-between text-xs text-text-secondary">
                  <span>Mostrando {filteredReqs.length} de {requisitions.length} requisiciones</span>
                  <span className="font-mono">Pendientes: {requisitions.filter((r) => isPending(r.status)).length}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Side: Create Form */}
        {isCreating && (
          <div className="w-full lg:w-96 bg-onyx-surface border border-aged-bronze/40 rounded-lg p-4 lg:p-6 shadow-xl lg:h-full overflow-y-auto">
            <Heading level={3} className="!text-base !border-none !pb-0 text-champagne-gold mb-4">
              Nueva Requisición
            </Heading>
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField label="Sucursal que Solicita" required>
                <select
                  value={fromBranchId}
                  onChange={(e) => setFromBranchId(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal border border-aged-bronze/30 rounded text-text-primary text-sm"
                  required
                  data-testid="req-from-branch"
                >
                  <option value="">Seleccionar...</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Bodega Proveedora" required>
                <select
                  value={toWarehouseId}
                  onChange={(e) => setToWarehouseId(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal border border-aged-bronze/30 rounded text-text-primary text-sm"
                  required
                  data-testid="req-to-warehouse"
                >
                  <option value="">Seleccionar...</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Notas">
                <textarea
                  value={reqNotes}
                  onChange={(e) => setReqNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal border border-aged-bronze/30 rounded text-text-primary text-sm"
                  rows={2}
                />
              </FormField>

              {/* Product Adder Section */}
              <div className="border-t border-aged-bronze/20 pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-champagne-gold mb-3">
                  Agregar Productos
                </h3>

                <div className="space-y-2">
                  <label className="block text-[10px] text-text-secondary uppercase">Buscar Producto</label>
                  <Autocomplete
                    options={products.map((p) => ({
                      id: p.id,
                      label: p.name,
                      sublabel: `${p.internalCode ? `Código: ${p.internalCode}` : p.sku ? `SKU: ${p.sku}` : ''} - Costo: $${p.cost || '0.00'}`,
                    }))}
                    value={selectedProductId}
                    onChange={setSelectedProductId}
                    placeholder="Buscar producto..."
                  />
                </div>

                {selectedProductId && (
                  <div className="flex gap-2 items-end mt-2">
                    <div className="flex-1">
                      <label className="block text-[10px] text-text-secondary uppercase mb-1">Cantidad</label>
                      <Input
                        type="number"
                        step="0.001"
                        min="0.001"
                        value={itemQuantity}
                        onChange={(e) => setItemQuantity(e.target.value)}
                        className="text-xs"
                        data-testid="req-quantity"
                      />
                    </div>
                    <Button type="button" variant="secondary" size="sm" onClick={handleAddItem}>Agregar</Button>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="bg-charcoal/30 border border-aged-bronze/15 rounded p-3 min-h-[100px] max-h-[260px] overflow-y-auto">
                <span className="block text-[10px] text-text-secondary uppercase tracking-wider mb-2 font-bold">
                  Productos Solicitados
                </span>

                {items.length === 0 ? (
                  <div className="text-center py-6 text-xs text-text-secondary/40">
                    No has agregado productos.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {items.map((item, idx) => (
                      <div key={idx} className="group bg-charcoal/40 border border-aged-bronze/10 rounded px-2.5 py-2 hover:bg-charcoal/60 transition-colors">
                        {editingIndex === idx ? (
                          <div className="flex gap-2 items-center">
                            <span className="font-semibold text-text-primary text-xs flex-1">{item.productName}</span>
                            <input
                              type="number"
                              step="any"
                              min="0.001"
                              value={editingQuantity}
                              onChange={(e) => setEditingQuantity(e.target.value)}
                              className="w-20 bg-charcoal border border-aged-bronze/45 rounded px-2 py-1 text-xs text-text-primary text-center"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit(idx);
                                if (e.key === 'Escape') handleCancelEdit();
                              }}
                            />
                            <button type="button" onClick={() => handleSaveEdit(idx)} className="text-success-green hover:text-success-green/80 p-1">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-text-primary">{item.productName}</span>
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-champagne-gold font-semibold">{item.quantityRequested}</span>
                              <button type="button" onClick={() => handleStartEditing(idx)} className="text-champagne-gold/70 hover:text-champagne-gold transition-colors p-1" title="Editar cantidad">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button type="button" onClick={() => removeItem(idx)} className="text-error-red/80 hover:text-error-red transition-colors p-1" title="Quitar">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1" disabled={isSubmitting}>
                  {isSubmitting ? 'Enviando...' : 'Enviar Requisición'}
                </Button>
                <Button type="button" variant="secondary" className="flex-1" onClick={resetForm}>Cancelar</Button>
              </div>
            </form>
          </div>
        )}

        {/* Approval Modal */}
        {approvingReq && (
          <div className="fixed inset-0 bg-obsidian/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-onyx-surface border border-aged-bronze/35 rounded-xl max-w-xl w-full shadow-2xl">
              <div className="p-6 border-b border-aged-bronze/25 flex justify-between items-center">
                <Heading level={2} className="!text-champagne-gold !border-none !pb-0 font-light text-lg">Aprobar / Rechazar</Heading>
                <button onClick={() => { setApprovingReq(null); setApprovalNotes(''); }} className="text-text-secondary hover:text-text-primary">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="text-xs space-y-1">
                  <p><span className="text-text-secondary">Sucursal:</span> {branches.find(b => b.id === approvingReq.fromBranchId)?.name || '—'}</p>
                  <p><span className="text-text-secondary">Bodega:</span> {warehouses.find(w => w.id === approvingReq.toWarehouseId)?.name || '—'}</p>
                  <p><span className="text-text-secondary">Notas:</span> {approvingReq.notes || '—'}</p>
                  <p><span className="text-text-secondary">Items:</span> {approvingReq.itemCount || 0}</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Notas de aprobación / razón de rechazo</label>
                  <textarea
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal border border-aged-bronze/30 rounded text-text-primary text-xs"
                    rows={3}
                    placeholder="Ej. Aprobado, enviar el lunes..."
                  />
                </div>
                <div className="flex gap-3">
                  <Button onClick={handleApprove} className="flex-1 bg-success-green hover:bg-success-green/90 text-onyx-surface">Aprobar</Button>
                  <Button onClick={handleReject} className="flex-1 bg-error-red hover:bg-error-red/90 text-white">Rechazar</Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Detail Modal */}
        {viewingReq && (
          <div className="fixed inset-0 bg-obsidian/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
            <div className="bg-onyx-surface border border-aged-bronze/35 rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-aged-bronze/25 flex items-center justify-between">
                <div>
                  <Heading level={2} className="!text-champagne-gold !border-none !pb-0 font-light font-sans text-lg">
                    Detalle de Requisición
                  </Heading>
                  <div className="flex gap-4 mt-1 text-xs text-text-secondary">
                    <span>{branches.find(b => b.id === viewingReq.fromBranchId)?.name || '—'}</span>
                    <span>{warehouses.find(w => w.id === viewingReq.toWarehouseId)?.name || '—'}</span>
                    <span>{getStatusBadge(viewingReq.status)}</span>
                  </div>
                  {viewingReq.notes && <p className="text-xs text-text-secondary mt-1 italic">Notas: {viewingReq.notes}</p>}
                </div>
                <button onClick={() => { setViewingReq(null); setViewingReqItems([]); }} className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="overflow-y-auto p-6">
                {viewingReqItems.length > 0 ? (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-charcoal-surface/60 border-b border-aged-bronze/35 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                        <th className="px-4 py-3">Producto</th>
                        <th className="px-4 py-3 text-right">Cant. Solicitada</th>
                        <th className="px-4 py-3 text-right">Cant. Aprobada</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-aged-bronze/20">
                      {viewingReqItems.map((item) => (
                        <tr key={item.id || item.productId}>
                          <td className="px-4 py-3 font-medium text-text-primary">{item.productName || products.find(p => p.id === item.productId)?.name || '—'}</td>
                          <td className="px-4 py-3 text-right font-mono">{item.quantityRequested}</td>
                          <td className="px-4 py-3 text-right font-mono text-champagne-gold">{item.quantityApproved || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-8 text-text-secondary/50 text-xs">Sin productos registrados.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
