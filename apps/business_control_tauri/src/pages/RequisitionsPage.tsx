import React, { useState, useEffect, useCallback } from 'react';
import { api, BranchRequisition, Branch, Warehouse, Product, RequisitionHistory } from '../services/api';
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
  userRoles?: string[];
}

interface RequisitionLineItem {
  productId: string;
  productName: string;
  quantityRequested: number;
}

export const RequisitionsPage: React.FC<RequisitionsPageProps> = ({ businessId, userId, userRole, userRoles }) => {
  const [requisitions, setRequisitions] = useState<BranchRequisition[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockLevels, setStockLevels] = useState<any[]>([]);
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

  const [history, setHistory] = useState<RequisitionHistory | null>(null);
  const [behalfNote, setBehalfNote] = useState('');
  const [receivedQty, setReceivedQty] = useState<Record<string, string>>({});
  const [isActing, setIsActing] = useState(false);

  const [approvingReq, setApprovingReq] = useState<BranchRequisition | null>(null);
  const [approvalQty, setApprovalQty] = useState<Record<string, string>>({});
  const [approvalWarehouseId, setApprovalWarehouseId] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');

  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' | 'warning' }>>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const effectiveRoles = (userRoles && userRoles.length > 0 ? userRoles : [userRole]).map((r) => r.toLowerCase());
  // Owner / Admin. Inventario authorize; their own requisitions are born authorized.
  const isApprover = effectiveRoles.some((r) => ['owner', 'inventory_admin'].includes(r));
  const canCreate = isApprover || effectiveRoles.includes('branch_operator');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [branchesData, warehousesData, productsData, requisitionsData, stockData] = await Promise.all([
        api.getBranches(businessId),
        api.getWarehouses(businessId),
        api.getProducts(businessId),
        api.getAllRequisitions(businessId),
        api.getStockLevels(businessId).catch(() => []),
      ]);
      setBranches(branchesData);
      setWarehouses(warehousesData);
      setProducts(productsData);
      setRequisitions(requisitionsData);
      setStockLevels(stockData || []);

      if (branchesData.length > 0) setFromBranchId(branchesData[0].id);
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
    setFromBranchId(branches.length > 0 ? branches[0].id : '');
    setToWarehouseId('');
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
    if (items.length === 0) {
      showToast('Agregue al menos un producto.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.createRequisition({
        businessId,
        fromBranchId,
        toWarehouseId: toWarehouseId || undefined,
        createdBy: userId,
        notes: reqNotes || undefined,
        items: items.map((it) => ({ productId: it.productId, quantityRequested: it.quantityRequested })),
      });
      showToast(
        isApprover
          ? 'Requisición creada y autorizada. Ya aparece en Salidas de Almacén y Bodega.'
          : 'Requisición enviada. Queda pendiente de autorización.',
        'success',
      );
      setIsCreating(false);
      resetForm();
      await fetchData();
    } catch (err: any) {
      showToast(err.message || 'Error al crear la requisición.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const num = (value: unknown) => parseFloat(String(value ?? '0')) || 0;
  const fmt = (value: unknown) => {
    const n = num(value);
    return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, '');
  };

  const loadHistory = async (id: string) => {
    const data = await api.getRequisitionHistory(id);
    setHistory(data);
    setReceivedQty(
      Object.fromEntries((data.requisition.items || []).map((i) => [i.productId, fmt(i.quantityDispatched ?? 0)])),
    );
  };

  const handleViewDetails = async (req: BranchRequisition) => {
    try {
      setLoading(true);
      setBehalfNote('');
      await loadHistory(req.id);
    } catch (err: any) {
      showToast(err.message || 'Error al cargar detalles.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openReview = async (req: BranchRequisition) => {
    try {
      const full = await api.getRequisition(req.id);
      setApprovingReq(full);
      setApprovalQty(Object.fromEntries((full.items || []).map((i) => [i.productId, fmt(i.quantityRequested)])));
      setApprovalWarehouseId(full.toWarehouseId || '');
      setApprovalNotes('');
    } catch (err: any) {
      showToast(err.message || 'Error al cargar la requisición.', 'error');
    }
  };

  const closeReview = () => {
    setApprovingReq(null);
    setApprovalNotes('');
    setApprovalWarehouseId('');
  };

  const approvalAdjusted = (approvingReq?.items || []).some(
    (i) => Math.abs(num(approvalQty[i.productId]) - num(i.quantityRequested)) > 0.0005,
  );

  const handleApprove = async () => {
    if (!approvingReq) return;
    if (approvalAdjusted && !approvalNotes.trim()) {
      showToast('Explica el motivo al autorizar cantidades distintas a las solicitadas.', 'warning');
      return;
    }
    try {
      await api.approveRequisition(approvingReq.id, {
        items: (approvingReq.items || []).map((i) => ({ productId: i.productId, quantityApproved: num(approvalQty[i.productId]) })),
        notes: approvalNotes.trim() || undefined,
        warehouseId: approvalWarehouseId || undefined,
      });
      showToast('Requisición autorizada. Almacén y Bodega ya la ve en Salidas.', 'success');
      closeReview();
      await fetchData();
    } catch (err: any) {
      showToast(err.message || 'Error al autorizar.', 'error');
    }
  };

  const handleReject = async () => {
    if (!approvingReq) return;
    if (!approvalNotes.trim()) {
      showToast('Debe proporcionar una razón de rechazo.', 'warning');
      return;
    }
    try {
      await api.rejectRequisition(approvingReq.id, approvalNotes.trim());
      showToast('Requisición rechazada.', 'success');
      closeReview();
      await fetchData();
    } catch (err: any) {
      showToast(err.message || 'Error al rechazar.', 'error');
    }
  };

  /** Owner / Admin. Inventario acting on behalf of Bodega or the branch; always with a reason. */
  const actOnBehalf = async (action: 'cancel' | 'deliver' | 'receive') => {
    const req = history?.requisition;
    if (!req) return;
    const note = behalfNote.trim();
    if (!note) {
      showToast('Indica el motivo; queda registrado en la auditoría.', 'warning');
      return;
    }
    setIsActing(true);
    try {
      if (action === 'cancel') {
        await api.rejectRequisition(req.id, note);
        showToast('Requisición cancelada.', 'success');
      } else if (action === 'deliver') {
        await api.deliverRequisition(req.id, note);
        showToast('Entrega registrada en nombre de Almacén y Bodega.', 'success');
      } else if (req.transfer) {
        await api.receiveTransfer(req.transfer.id, {
          items: (req.items || []).map((i) => ({ productId: i.productId, quantityReceived: num(receivedQty[i.productId]) })),
          note,
        });
        showToast('Recepción confirmada en nombre de la sucursal.', 'success');
      }
      setBehalfNote('');
      await Promise.all([loadHistory(req.id), fetchData()]);
    } catch (err: any) {
      showToast(err.message || 'No se pudo completar la acción.', 'error');
    } finally {
      setIsActing(false);
    }
  };

  const STATUS_META: Record<string, { label: string; className: string }> = {
    pending: { label: 'Por autorizar', className: 'bg-gray-500/20 text-gray-300' },
    pending_approval: { label: 'Por autorizar', className: 'bg-gray-500/20 text-gray-300' },
    approved: { label: 'Autorizada', className: 'bg-green-500/20 text-green-300' },
    standby: { label: 'En espera (Bodega)', className: 'bg-amber-500/20 text-amber-300' },
    in_transit: { label: 'En camino', className: 'bg-blue-500/20 text-blue-300' },
    delivered: { label: 'Entregada (por confirmar)', className: 'bg-purple-500/20 text-purple-300' },
    completed: { label: 'Completada', className: 'bg-champagne-gold/20 text-champagne-gold' },
    rejected: { label: 'Rechazada', className: 'bg-red-500/20 text-red-300' },
  };

  const getStatusBadge = (status: string) => {
    const meta = STATUS_META[status] || { label: status, className: STATUS_META.pending.className };
    return <span className={`px-2 py-1 rounded text-xs font-medium ${meta.className}`}>{meta.label}</span>;
  };

  const ACTION_LABELS: Record<string, string> = {
    created: 'Solicitada',
    created_approved: 'Creada y autorizada',
    approved: 'Autorizada',
    rejected: 'Rechazada / cancelada',
    held: 'Puesta en espera por Bodega',
    dispatched: 'Despachada por Bodega',
    delivered: 'Entregada por Bodega',
    delivered_on_behalf: 'Entrega marcada en nombre de Bodega',
    received: 'Recepción confirmada por la sucursal',
    received_on_behalf: 'Recepción confirmada en nombre de la sucursal',
  };
  const STAGE_LABELS: Record<string, string> = {
    requested: 'Solicitado',
    approved: 'Autorizado',
    dispatched: 'Despachado',
    received: 'Recibido',
  };

  const filteredReqs = requisitions.filter((r) => {
    const q = searchQuery.toLowerCase();
    const branchName = branches.find((b) => b.id === r.fromBranchId)?.name || '';
    const matchesSearch = !q || branchName.toLowerCase().includes(q) || (r.notes || '').toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === 'all' || r.status === statusFilter || (statusFilter === 'pending_approval' && r.status === 'pending');
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
            {canCreate && (
              <Button onClick={() => { setIsCreating(true); resetForm(); }} disabled={isCreating}>
                + Nueva Requisición
              </Button>
            )}
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
                      <option value="pending_approval">Por autorizar</option>
                      <option value="approved">Autorizada</option>
                      <option value="standby">En espera (Bodega)</option>
                      <option value="in_transit">En camino</option>
                      <option value="delivered">Entregada (por confirmar)</option>
                      <option value="completed">Completada</option>
                      <option value="rejected">Rechazada</option>
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
                          const whName = warehouses.find((w) => w.id === req.toWarehouseId)?.name || 'Por asignar';
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
                                      onClick={() => openReview(req)}
                                      className="text-champagne-gold hover:underline text-xs px-2"
                                      title="Autorizar / Rechazar"
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

              <FormField label="Bodega Proveedora (Opcional - Sugerida por Existencias)">
                <select
                  value={toWarehouseId}
                  onChange={(e) => setToWarehouseId(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal border border-aged-bronze/30 rounded text-text-primary text-sm"
                  data-testid="req-to-warehouse"
                >
                  <option value="">Cualquier bodega disponible (se asigna al despachar)</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </FormField>

              {/* Warehouse Stock Suggestions */}
              {items.length > 0 && (
                <div className="bg-charcoal/40 border border-aged-bronze/20 rounded p-3 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 text-champagne-gold font-medium">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Disponibilidad en Bodegas:</span>
                  </div>
                  <div className="space-y-1 text-[11px]">
                    {warehouses.map((w) => {
                      const warehouseStockItems = stockLevels.filter(
                        (s) => s.warehouseId === w.id && items.some((it) => it.productId === s.productId)
                      );
                      const hasStockAny = warehouseStockItems.some((s) => parseFloat(s.quantity || '0') > 0);
                      const isSelected = toWarehouseId === w.id;

                      return (
                        <div
                          key={w.id}
                          onClick={() => setToWarehouseId(w.id)}
                          className={`p-2 rounded cursor-pointer transition-colors border flex flex-col gap-1 ${
                            isSelected
                              ? 'bg-champagne-gold/15 border-champagne-gold/60 text-champagne-gold'
                              : 'bg-onyx-surface/60 border-aged-bronze/20 hover:border-aged-bronze/50 text-text-secondary'
                          }`}
                        >
                          <div className="flex justify-between items-center font-medium">
                            <span className={isSelected ? 'text-white' : 'text-text-primary'}>{w.name}</span>
                            {hasStockAny ? (
                              <span className="text-[10px] bg-success-green/20 text-success-green px-1.5 py-0.5 rounded font-mono">
                                Con existencias
                              </span>
                            ) : (
                              <span className="text-[10px] text-text-secondary/50">Sin existencias registradas</span>
                            )}
                          </div>
                          {warehouseStockItems.length > 0 && (
                            <div className="text-[10px] text-text-secondary/80 flex flex-wrap gap-x-2">
                              {warehouseStockItems.map((st) => (
                                <span key={st.id || st.productId}>
                                  {st.productName}: <strong className="text-text-primary">{st.quantity} {st.uom || ''}</strong>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <FormField label="Notas">
                <textarea
                  value={reqNotes}
                  onChange={(e) => setReqNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal border border-aged-bronze/30 rounded text-text-primary text-sm"
                  rows={2}
                  placeholder="Detalles sobre entrega o urgencia..."
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
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsCreating(false)}>Cancelar</Button>
              </div>
            </form>
          </div>
        )}

        {/* Review Modal (Owner / Admin. Inventario) */}
        {approvingReq && (
          <div className="fixed inset-0 bg-obsidian/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-onyx-surface border border-aged-bronze/35 rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl">
              <div className="p-6 border-b border-aged-bronze/25 flex justify-between items-center">
                <div>
                  <Heading level={2} className="!text-champagne-gold !border-none !pb-0 font-light text-lg">Autorizar / Rechazar</Heading>
                  <p className="text-xs text-text-secondary mt-1">
                    {approvingReq.fromBranchName || branches.find((b) => b.id === approvingReq.fromBranchId)?.name || '—'}
                    {approvingReq.createdByName ? ` · Solicitó ${approvingReq.createdByName}` : ''}
                  </p>
                </div>
                <button onClick={closeReview} className="text-text-secondary hover:text-text-primary">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-4 overflow-y-auto">
                {approvingReq.notes && <p className="text-xs text-text-secondary italic">Nota de la sucursal: {approvingReq.notes}</p>}
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[11px] text-text-secondary uppercase tracking-wider border-b border-aged-bronze/30">
                      <th className="py-2">Producto</th>
                      <th className="py-2 text-right">Solicitado</th>
                      <th className="py-2 text-right w-32">Autorizar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-aged-bronze/20">
                    {(approvingReq.items || []).map((item) => {
                      const changed = Math.abs(num(approvalQty[item.productId]) - num(item.quantityRequested)) > 0.0005;
                      return (
                        <tr key={item.productId}>
                          <td className="py-2 text-text-primary">{item.productName}</td>
                          <td className="py-2 text-right font-mono">{fmt(item.quantityRequested)} {item.unit || ''}</td>
                          <td className="py-2 text-right">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={approvalQty[item.productId] ?? ''}
                              onChange={(e) => setApprovalQty((prev) => ({ ...prev, [item.productId]: e.target.value }))}
                              className={`w-24 bg-charcoal border rounded px-2 py-1 text-right font-mono ${changed ? 'border-amber-400 text-amber-200' : 'border-aged-bronze/40 text-champagne-gold'}`}
                              data-testid={`approve-qty-${item.productId}`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                    Bodega sugerida (Almacén y Bodega puede cambiarla al despachar)
                  </label>
                  <select
                    value={approvalWarehouseId}
                    onChange={(e) => setApprovalWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal border border-aged-bronze/30 rounded text-text-primary text-xs"
                  >
                    <option value="">Sin sugerencia</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                    {approvalAdjusted ? 'Motivo del ajuste (obligatorio)' : 'Notas de autorización / razón de rechazo'}
                  </label>
                  <textarea
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal border border-aged-bronze/30 rounded text-text-primary text-xs"
                    rows={3}
                    placeholder="Ej. Se autoriza menos queso por consumo de la semana..."
                    data-testid="approval-notes"
                  />
                </div>
                <div className="flex gap-3">
                  <Button onClick={handleApprove} className="flex-1 bg-success-green hover:bg-success-green/90 text-onyx-surface">Autorizar</Button>
                  <Button onClick={handleReject} className="flex-1 bg-error-red hover:bg-error-red/90 text-white">Rechazar</Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Detail Modal: quantities per step, discrepancies and audit timeline */}
        {history && (() => {
          const req = history.requisition;
          const discrepancies = history.ledger.filter((row) => row.stage !== 'requested' && Math.abs(num(row.difference)) > 0.0005);
          const diffClass = (a: unknown, b: unknown) => (Math.abs(num(a) - num(b)) > 0.0005 ? 'text-amber-300' : '');
          return (
            <div className="fixed inset-0 bg-obsidian/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
              <div className="bg-onyx-surface border border-aged-bronze/35 rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-aged-bronze/25 flex items-center justify-between">
                  <div>
                    <Heading level={2} className="!text-champagne-gold !border-none !pb-0 font-light font-sans text-lg">
                      Detalle de Requisición
                    </Heading>
                    <div className="flex flex-wrap gap-4 mt-1 text-xs text-text-secondary items-center">
                      <span>{req.fromBranchName || '—'}</span>
                      <span>{req.toWarehouseName || 'Bodega por asignar'}</span>
                      {getStatusBadge(req.status)}
                    </div>
                    {req.notes && <p className="text-xs text-text-secondary mt-1 italic">Notas: {req.notes}</p>}
                  </div>
                  <button onClick={() => setHistory(null)} className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="overflow-y-auto p-6 space-y-6">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-charcoal-surface/60 border-b border-aged-bronze/35 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                        <th className="px-3 py-2">Producto</th>
                        <th className="px-3 py-2 text-right">Solicitada</th>
                        <th className="px-3 py-2 text-right">Autorizada</th>
                        <th className="px-3 py-2 text-right">Despachada</th>
                        <th className="px-3 py-2 text-right">Recibida</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-aged-bronze/20">
                      {(req.items || []).map((item) => {
                        const approved = isPending(req.status) ? null : item.quantityApproved;
                        return (
                          <tr key={item.productId}>
                            <td className="px-3 py-2 font-medium text-text-primary">{item.productName || products.find((p) => p.id === item.productId)?.name || '—'}</td>
                            <td className="px-3 py-2 text-right font-mono">{fmt(item.quantityRequested)}</td>
                            <td className={`px-3 py-2 text-right font-mono ${approved === null ? '' : diffClass(approved, item.quantityRequested)}`}>
                              {approved === null ? '—' : fmt(approved)}
                            </td>
                            <td className={`px-3 py-2 text-right font-mono ${item.quantityDispatched == null ? '' : diffClass(item.quantityDispatched, item.quantityApproved)}`}>
                              {item.quantityDispatched == null ? '—' : fmt(item.quantityDispatched)}
                            </td>
                            <td className={`px-3 py-2 text-right font-mono ${item.quantityReceived == null ? '' : diffClass(item.quantityReceived, item.quantityDispatched)}`}>
                              {req.status === 'delivered' && isApprover ? (
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={receivedQty[item.productId] ?? ''}
                                  onChange={(e) => setReceivedQty((prev) => ({ ...prev, [item.productId]: e.target.value }))}
                                  className="w-20 bg-charcoal border border-aged-bronze/40 rounded px-2 py-1 text-right"
                                />
                              ) : item.quantityReceived == null ? '—' : fmt(item.quantityReceived)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {discrepancies.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-300 mb-2">Diferencias registradas</h3>
                      <ul className="space-y-1 text-xs">
                        {discrepancies.map((row) => (
                          <li key={row.id} className="bg-amber-500/5 border border-amber-500/20 rounded px-3 py-2">
                            <span className="text-text-primary font-medium">{row.productName}</span>
                            <span className="text-text-secondary"> · {STAGE_LABELS[row.stage] || row.stage}: </span>
                            <span className="font-mono">{fmt(row.expectedQuantity)} → {fmt(row.quantity)} ({num(row.difference) > 0 ? '+' : ''}{fmt(row.difference)})</span>
                            {row.note && <span className="text-text-secondary italic"> — {row.note}</span>}
                            {row.actorName && <span className="text-text-secondary/70"> · {row.actorName}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-champagne-gold mb-2">Historial</h3>
                    <ol className="border-l border-aged-bronze/30 pl-4 space-y-3 text-xs">
                      {history.events.map((event) => (
                        <li key={event.id}>
                          <div className="text-text-primary font-medium">{ACTION_LABELS[event.action] || event.action}</div>
                          <div className="text-text-secondary">
                            {new Date(event.createdAt).toLocaleString('es-MX')} · {event.actorName || 'Sistema'}
                            {event.actorRole ? ` (${event.actorRole})` : ''}
                          </div>
                          {event.reason && <div className="text-text-secondary italic">“{event.reason}”</div>}
                        </li>
                      ))}
                      {history.events.length === 0 && <li className="text-text-secondary/60">Sin eventos registrados (requisición anterior a la auditoría).</li>}
                    </ol>
                  </div>

                  {isApprover && isPending(req.status) && (
                    <div className="border-t border-aged-bronze/25 pt-4">
                      <Button onClick={() => { setHistory(null); openReview(req); }}>Autorizar / Rechazar</Button>
                    </div>
                  )}
                  {isApprover && ['approved', 'standby', 'in_transit', 'delivered'].includes(req.status) && (
                    <div className="border-t border-aged-bronze/25 pt-4 space-y-3">
                      <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider">
                        Motivo (queda en la auditoría)
                      </label>
                      <textarea
                        value={behalfNote}
                        onChange={(e) => setBehalfNote(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 bg-charcoal border border-aged-bronze/30 rounded text-text-primary text-xs"
                        placeholder="Ej. El chofer confirmó la entrega por teléfono"
                      />
                      <div className="flex flex-wrap gap-2">
                        {['approved', 'standby'].includes(req.status) && (
                          <Button variant="secondary" disabled={isActing} onClick={() => actOnBehalf('cancel')}>Cancelar requisición</Button>
                        )}
                        {req.status === 'in_transit' && (
                          <Button disabled={isActing} onClick={() => actOnBehalf('deliver')}>Marcar entregada (en nombre de Bodega)</Button>
                        )}
                        {req.status === 'delivered' && (
                          <Button disabled={isActing} onClick={() => actOnBehalf('receive')}>Confirmar recepción (en nombre de la sucursal)</Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
