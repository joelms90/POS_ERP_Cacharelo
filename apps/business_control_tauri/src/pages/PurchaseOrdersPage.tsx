import React, { useState, useEffect, useCallback } from 'react';
import { api, PurchaseOrder, Provider, Warehouse, Product } from '../services/api';
import { Heading } from '../components/atoms/Heading';
import { Button } from '../components/atoms/Button';
import { Input } from '../components/atoms/Input';
import { FormField } from '../components/molecules/FormField';
import { Autocomplete } from '../components/molecules/Autocomplete';
import { ToastContainer } from '../components/molecules/ToastNotification';

interface PurchaseOrdersPageProps {
  businessId: string;
  userId: string;
}

interface PurchaseOrderLineItem {
  productId: string;
  productName: string;
  quantity: number;
  estimatedUnitCost: number;
}

export const PurchaseOrdersPage: React.FC<PurchaseOrdersPageProps> = ({ businessId, userId }) => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [providerId, setProviderId] = useState<string>('');
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [items, setItems] = useState<PurchaseOrderLineItem[]>([]);

  const [selectedProductId, setSelectedProductId] = useState('');
  const [itemQuantity, setItemQuantity] = useState('1');
  const [itemEstimatedCost, setItemEstimatedCost] = useState('0');

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingQuantity, setEditingQuantity] = useState('');
  const [editingCost, setEditingCost] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' | 'warning' }>>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [ordersData, providersData, warehousesData, productsData] = await Promise.all([
        api.getPurchaseOrders(businessId),
        api.getProviders(businessId),
        api.getWarehouses(businessId),
        api.getProducts(businessId),
      ]);
      setPurchaseOrders(ordersData);
      setProviders(providersData);
      setWarehouses(warehousesData);
      setProducts(productsData);
    } catch (err: any) {
      console.error(err);
      setError('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const generateOrderNumber = () => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `OC-${mm}${dd}-${hh}${min}`;
  };

  useEffect(() => {
    fetchData();
  }, [businessId]);

  const resetForm = () => {
    setIsCreating(false);
    setOrderNumber('');
    setProviderId('');
    setWarehouseId('');
    setNotes('');
    setItems([]);
    setSelectedProductId('');
    setItemQuantity('1');
    setItemEstimatedCost('0');
    setEditingIndex(null);
  };

  useEffect(() => {
    if (selectedProductId && products.length > 0) {
      const product = products.find((p) => p.id === selectedProductId);
      if (product && product.cost) {
        setItemEstimatedCost(String(product.cost));
      } else {
        setItemEstimatedCost('0');
      }
    }
  }, [selectedProductId, products]);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      showToast('Seleccione un insumo o producto.', 'warning');
      return;
    }
    const qty = parseFloat(itemQuantity);
    const cost = parseFloat(itemEstimatedCost);
    if (isNaN(qty) || qty <= 0) {
      showToast('La cantidad debe ser mayor a cero.', 'warning');
      return;
    }
    if (isNaN(cost) || cost < 0) {
      showToast('El costo estimado no puede ser negativo.', 'warning');
      return;
    }

    const product = products.find((p) => p.id === selectedProductId);
    const productName = product ? product.name : 'Insumo';

    const existingIndex = items.findIndex((it) => it.productId === selectedProductId);
    if (existingIndex > -1) {
      const newItems = [...items];
      newItems[existingIndex].quantity += qty;
      newItems[existingIndex].estimatedUnitCost = cost;
      setItems(newItems);
      showToast(`Se actualizó la cantidad de "${productName}".`, 'success');
    } else {
      setItems((prev) => [
        ...prev,
        { productId: selectedProductId, productName, quantity: qty, estimatedUnitCost: cost },
      ]);
    }

    setSelectedProductId('');
    setItemQuantity('1');
    setItemEstimatedCost('0');
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleStartEditing = (index: number) => {
    const item = items[index];
    setEditingIndex(index);
    setEditingQuantity(item.quantity.toString());
    setEditingCost(item.estimatedUnitCost.toString());
  };

  const handleSaveEdit = (index: number) => {
    const qty = parseFloat(editingQuantity);
    const cost = parseFloat(editingCost);

    if (isNaN(qty) || qty <= 0) {
      showToast('La cantidad debe ser mayor a cero.', 'warning');
      return;
    }
    if (isNaN(cost) || cost < 0) {
      showToast('El costo estimado no puede ser negativo.', 'warning');
      return;
    }

    const newItems = [...items];
    newItems[index] = { ...newItems[index], quantity: qty, estimatedUnitCost: cost };
    setItems(newItems);
    setEditingIndex(null);
    setEditingQuantity('');
    setEditingCost('');
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingQuantity('');
    setEditingCost('');
  };

  const calculateGrandTotal = () => {
    return items.reduce((sum, item) => sum + item.quantity * item.estimatedUnitCost, 0).toFixed(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber.trim()) {
      showToast('Ingrese el número de orden.', 'warning');
      return;
    }
    if (!providerId) {
      showToast('Seleccione un proveedor.', 'warning');
      return;
    }
    if (!warehouseId) {
      showToast('Seleccione una bodega.', 'warning');
      return;
    }
    if (items.length === 0) {
      showToast('Agregue al menos un insumo o producto.', 'warning');
      return;
    }

    try {
      const created = await api.createPurchaseOrder({
        businessId,
        providerId,
        warehouseId,
        orderNumber,
        createdBy: userId,
        notes: notes || undefined,
        items: items.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          estimatedUnitCost: it.estimatedUnitCost,
        })),
      });
      setPurchaseOrders([created, ...purchaseOrders]);
      showToast('Orden de compra creada exitosamente.', 'success');
      resetForm();
    } catch (err) {
      showToast('Error al crear la orden de compra.', 'error');
    }
  };

  const handleMarkAsSent = async (id: string) => {
    if (confirm('¿Marcar esta orden como enviada al proveedor?')) {
      try {
        const updated = await api.markPurchaseOrderAsSent(id);
        setPurchaseOrders(purchaseOrders.map((po) => (po.id === id ? updated : po)));
        showToast('Orden marcada como enviada.', 'success');
      } catch (err) {
        showToast('Error al actualizar la orden.', 'error');
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Está seguro de eliminar esta orden de compra?')) {
      try {
        await api.deletePurchaseOrder(id);
        setPurchaseOrders(purchaseOrders.filter((po) => po.id !== id));
        showToast('Orden de compra eliminada.', 'success');
      } catch (err) {
        showToast('Error al eliminar la orden.', 'error');
      }
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      draft: 'bg-gray-500/20 text-gray-300',
      sent: 'bg-blue-500/20 text-blue-300',
      partially_received: 'bg-yellow-500/20 text-yellow-300',
      received: 'bg-green-500/20 text-green-300',
      cancelled: 'bg-red-500/20 text-red-300',
    };
    const labels = {
      draft: 'Borrador',
      sent: 'Enviada',
      partially_received: 'Parcial',
      received: 'Recibida',
      cancelled: 'Cancelada',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${badges[status as keyof typeof badges] || badges.draft}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  return (
    <div className="w-full lg:h-full min-h-full bg-obsidian p-2 lg:p-6 font-sans overflow-y-auto lg:overflow-hidden">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div className="flex flex-col lg:flex-row gap-6 min-h-fit lg:h-full max-w-7xl mx-auto w-full">
        {/* Left Side: Purchase Orders List */}
        <div className="flex-1 flex flex-col gap-4 lg:h-full overflow-hidden">
          <div className="flex justify-between items-center">
            <Heading level={2} className="!text-lg sm:!text-2xl !border-none !pb-0 text-champagne-gold">
              Órdenes de Compra
            </Heading>
            <Button onClick={() => { setIsCreating(true); setOrderNumber(generateOrderNumber()); }} disabled={isCreating}>
              + Nueva Orden
            </Button>
          </div>

          {error && (
            <div className="bg-error-red/10 border border-error-red/30 text-error-red rounded p-3 text-xs">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <svg className="animate-spin h-6 w-6 text-champagne-gold" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : purchaseOrders.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-text-secondary text-xs">
              <span>No hay órdenes de compra registradas</span>
            </div>
          ) : (
            <>
              {/* Search and Filters Bar */}
              <div className="flex flex-col md:flex-row gap-4 bg-onyx-surface border border-aged-bronze/40 rounded p-4 shadow-md shadow-black/10 items-center justify-between">
                <div className="w-full md:w-72 relative">
                  <Input
                    type="text"
                    placeholder="Buscar por número o proveedor..."
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
                      <option value="draft">Borrador</option>
                      <option value="sent">Enviada</option>
                      <option value="partially_received">Parcial</option>
                      <option value="received">Recibida</option>
                      <option value="cancelled">Cancelada</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Orders Table Card */}
              <div className="flex-1 bg-onyx-surface border border-aged-bronze/40 rounded shadow-md shadow-black/20 overflow-hidden flex flex-col min-h-0">
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left border-collapse select-text">
                    <thead>
                      <tr className="bg-charcoal-surface/60 border-b border-aged-bronze/35 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                        <th className="px-6 py-4">Número</th>
                        <th className="px-6 py-4">Proveedor</th>
                        <th className="px-6 py-4">Bodega</th>
                        <th className="px-6 py-4 text-center">Estado</th>
                        <th className="px-6 py-4 text-center">Items</th>
                        <th className="px-6 py-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-aged-bronze/20 text-sm">
                      {(() => {
                        const filtered = purchaseOrders.filter((po) => {
                          const q = searchQuery.toLowerCase();
                          const provName = providers.find(p => p.id === po.providerId)?.name || '';
                          const matchesSearch =
                            !q ||
                            po.poNumber.toLowerCase().includes(q) ||
                            provName.toLowerCase().includes(q);
                          const matchesStatus =
                            statusFilter === 'all' || po.status === statusFilter;
                          return matchesSearch && matchesStatus;
                        });

                        if (filtered.length === 0) {
                          return (
                            <tr>
                              <td colSpan={6} className="px-6 py-12 text-center text-text-secondary italic">
                                {searchQuery || statusFilter !== 'all'
                                  ? 'No se encontraron órdenes que coincidan con la búsqueda.'
                                  : 'No hay órdenes de compra registradas.'}
                              </td>
                            </tr>
                          );
                        }

                        return filtered.map((po) => {
                          const providerName = providers.find(p => p.id === po.providerId)?.name || '—';
                          const warehouseName = warehouses.find(w => w.id === po.warehouseId)?.name || '—';
                          const itemCount = po.items?.length || 0;

                          return (
                            <tr key={po.id} className="hover:bg-charcoal-surface/20 transition-colors">
                              <td className="px-6 py-4 font-medium text-text-primary">
                                <span className="font-mono">{po.poNumber}</span>
                              </td>
                              <td className="px-6 py-4 text-text-secondary text-xs">{providerName}</td>
                              <td className="px-6 py-4 text-text-secondary text-xs">{warehouseName}</td>
                              <td className="px-6 py-4 text-center">{getStatusBadge(po.status)}</td>
                              <td className="px-6 py-4 text-center font-mono text-xs text-champagne-gold">{itemCount}</td>
                              <td className="px-6 py-4 text-right">
                                <div className="inline-flex gap-2">
                                  {po.status === 'draft' && (
                                    <button
                                      onClick={() => handleMarkAsSent(po.id)}
                                      className="text-blue-400 hover:text-blue-300 transition-colors text-xs px-2 py-1 rounded hover:bg-blue-400/5"
                                      title="Marcar como enviada"
                                    >
                                      Enviar
                                    </button>
                                  )}
                                  {po.status === 'draft' && (
                                    <button
                                      onClick={() => handleDelete(po.id)}
                                      className="text-error-red/80 hover:text-error-red transition-colors p-1 rounded hover:bg-error-red/5"
                                      title="Eliminar"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer Stats Bar */}
                <div className="bg-charcoal-surface/40 border-t border-aged-bronze/35 px-6 py-3 flex items-center justify-between text-xs text-text-secondary">
                  <span>
                    {(() => {
                      const filtered = purchaseOrders.filter((po) => {
                        const q = searchQuery.toLowerCase();
                        const provName = providers.find(p => p.id === po.providerId)?.name || '';
                        return (!q || po.poNumber.toLowerCase().includes(q) || provName.toLowerCase().includes(q)) &&
                          (statusFilter === 'all' || po.status === statusFilter);
                      });
                      return `Mostrando ${filtered.length} de ${purchaseOrders.length} órdenes`;
                    })()}
                  </span>
                  <span className="font-mono">
                    Borradores: {purchaseOrders.filter(po => po.status === 'draft').length}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Side: Create Form */}
        {isCreating && (
          <div className="w-full lg:w-96 bg-onyx-surface border border-aged-bronze/40 rounded-lg p-4 lg:p-6 shadow-xl lg:h-full overflow-y-auto">
            <Heading level={3} className="!text-base !border-none !pb-0 text-champagne-gold mb-4">
              Nueva Orden de Compra
            </Heading>
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField label="Número de Orden" required>
                <Input
                  type="text"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="PO-001"
                  required
                />
              </FormField>

              <FormField label="Proveedor" required>
                <select
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal border border-aged-bronze/30 rounded text-text-primary text-sm"
                  required
                >
                  <option value="">Seleccionar...</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Bodega" required>
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal border border-aged-bronze/30 rounded text-text-primary text-sm"
                  required
                >
                  <option value="">Seleccionar...</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Notas">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
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
                  <label className="block text-[10px] text-text-secondary uppercase">Buscar Insumo / Producto</label>
                  <Autocomplete
                    options={products.map((p) => ({
                      id: p.id,
                      label: p.name,
                      sublabel: `${p.internalCode ? `Código: ${p.internalCode}` : p.sku ? `SKU: ${p.sku}` : ''} - Costo: $${p.cost || '0.00'}`,
                    }))}
                    value={selectedProductId}
                    onChange={setSelectedProductId}
                    placeholder="Buscar insumo o producto..."
                  />
                </div>

                {selectedProductId && (
                  <>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <label className="block text-[10px] text-text-secondary uppercase mb-1">Cantidad</label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={itemQuantity}
                          onChange={(e) => setItemQuantity(e.target.value)}
                          className="text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-text-secondary uppercase mb-1">Costo Est. Unit.</label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={itemEstimatedCost}
                          onChange={(e) => setItemEstimatedCost(e.target.value)}
                          className="text-xs"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="mt-3 w-full bg-charcoal-surface hover:bg-charcoal/80 border border-aged-bronze/30 text-champagne-gold text-xs py-1.5 rounded transition-colors font-medium"
                    >
                      + Agregar Insumo
                    </button>
                  </>
                )}
              </div>

              {/* Items List */}
              <div className="bg-charcoal/30 border border-aged-bronze/15 rounded p-3 min-h-[100px] max-h-[260px] overflow-y-auto">
                <span className="block text-[10px] text-text-secondary uppercase tracking-wider mb-2 font-bold">
                  Productos en la Orden
                </span>

                {items.length === 0 ? (
                  <div className="text-center py-6 text-xs text-text-secondary/40">
                    No has agregado productos a la orden.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {items.map((item, idx) => (
                      <div key={idx} className="group bg-charcoal/40 border border-aged-bronze/10 rounded px-2.5 py-2 hover:bg-charcoal/60 transition-colors">
                        {editingIndex === idx ? (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-text-primary text-xs">{item.productName}</span>
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleSaveEdit(idx)}
                                  className="text-success-green hover:text-success-green/80 p-1"
                                  title="Guardar (Enter)"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelEdit}
                                  className="text-text-secondary hover:text-text-primary p-1"
                                  title="Cancelar (Esc)"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            <div className="flex gap-2 items-center">
                              <div className="flex-1">
                                <label className="block text-[9px] text-text-secondary uppercase mb-0.5">Cantidad</label>
                                <input
                                  type="number"
                                  step="any"
                                  min="0.01"
                                  value={editingQuantity}
                                  onChange={(e) => setEditingQuantity(e.target.value)}
                                  className="w-full bg-charcoal border border-aged-bronze/45 rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-champagne-gold"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveEdit(idx);
                                    if (e.key === 'Escape') handleCancelEdit();
                                  }}
                                />
                              </div>
                              <div className="flex-1">
                                <label className="block text-[9px] text-text-secondary uppercase mb-0.5">Costo Est. Unit.</label>
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  value={editingCost}
                                  onChange={(e) => setEditingCost(e.target.value)}
                                  className="w-full bg-charcoal border border-aged-bronze/45 rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-champagne-gold"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveEdit(idx);
                                    if (e.key === 'Escape') handleCancelEdit();
                                  }}
                                />
                              </div>
                              <div className="flex-1 text-right">
                                <label className="block text-[9px] text-text-secondary uppercase mb-0.5">Subtotal</label>
                                <span className="font-mono text-champagne-gold font-semibold text-xs">
                                  ${(parseFloat(editingQuantity || '0') * parseFloat(editingCost || '0')).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center text-xs">
                            <div className="flex flex-col flex-1">
                              <span className="font-semibold text-text-primary">{item.productName}</span>
                              <span className="text-[10px] text-text-secondary">
                                Cant: {item.quantity} x ${item.estimatedUnitCost}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-champagne-gold font-semibold">
                                ${(item.quantity * item.estimatedUnitCost).toFixed(2)}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleStartEditing(idx)}
                                className="text-champagne-gold/70 hover:text-champagne-gold transition-colors p-1"
                                title="Editar cantidad y costo"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => removeItem(idx)}
                                className="text-error-red/80 hover:text-error-red transition-colors p-1"
                                title="Quitar"
                              >
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

              {items.length > 0 && (
                <div className="flex justify-between items-center border-t border-aged-bronze/25 pt-3">
                  <span className="text-[10px] text-text-secondary uppercase tracking-wider">Costo Total Estimado</span>
                  <span className="text-lg font-mono text-champagne-gold font-bold">${calculateGrandTotal()}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1">Crear Orden</Button>
                <Button type="button" onClick={resetForm} className="flex-1">Cancelar</Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
