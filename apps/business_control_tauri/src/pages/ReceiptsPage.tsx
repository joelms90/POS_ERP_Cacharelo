import React, { useState, useEffect, useCallback } from 'react';
import { api, Warehouse } from '../services/api';
import { Button } from '../components/atoms/Button';
import { Heading } from '../components/atoms/Heading';
import { ToastContainer } from '../components/molecules/ToastNotification';

interface ReceiptsPageProps {
  businessId: string;
}

const BUSINESS_BRANCH_MAP: Record<string, { id: string; name: string }> = {
  'd3b07384-d113-4a0e-a555-e5b12824bf01': { id: 'c4f07384-d113-4a0e-a555-e5b12824bf02', name: 'Sucursal Cacharelo Centro' },
  'd3b07384-d113-4a0e-a555-e5b12824bf03': { id: 'c4f07384-d113-4a0e-a555-e5b12824bf04', name: 'Sucursal Empanadas' },
  'd3b07384-d113-4a0e-a555-e5b12824bf07': { id: 'c4f07384-d113-4a0e-a555-e5b12824bf08', name: 'Sucursal Tortas' },
  'd3b07384-d113-4a0e-a555-e5b12824bf05': { id: 'c4f07384-d113-4a0e-a555-e5b12824bf06', name: 'Sucursal Hamburguesas' },
};

export const ReceiptsPage: React.FC<ReceiptsPageProps> = ({ businessId }) => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  
  const [stockLevels, setStockLevels] = useState<any[]>([]);
  const [receiptsHistory, setReceiptsHistory] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeRightTab, setActiveRightTab] = useState<'stock' | 'history'>('stock');
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' | 'warning' }>>([]);

  // Form states
  const [destinationType, setDestinationType] = useState<'branch' | 'warehouse'>('branch');
  const [warehouseId, setWarehouseId] = useState('');
  const [providerId, setProviderId] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Item form states
  const [itemsList, setItemsList] = useState<Array<{ productId: string; productName: string; quantity: number; unitCost: number }>>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [itemQuantity, setItemQuantity] = useState('1');
  const [itemUnitCost, setItemUnitCost] = useState('0');

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const defaultBranch = BUSINESS_BRANCH_MAP[businessId] || { id: '', name: 'Sucursal General' };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch reference details
      const [whData, provData, prodData, stockData, histData] = await Promise.all([
        api.getWarehouses(businessId),
        api.getProviders(businessId),
        api.getProducts(businessId),
        api.getStockLevels(businessId),
        api.getReceipts(businessId),
      ]);
      
      setWarehouses(whData);
      setProviders(provData);
      setProducts(prodData);
      setStockLevels(stockData);
      setReceiptsHistory(histData);

      // Set default selections
      if (whData.length > 0) setWarehouseId(whData[0].id);
      if (provData.length > 0) setProviderId(provData[0].id);
      if (prodData.length > 0) setSelectedProductId(prodData[0].id);
    } catch (error: any) {
      showToast(error.message || 'Error al cargar los catálogos de inventario.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [businessId, showToast]);

  useEffect(() => {
    loadData();
    // Reset form item lists on business change
    setItemsList([]);
  }, [loadData, businessId]);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      showToast('Seleccione un producto/insumo.', 'warning');
      return;
    }
    const qty = parseFloat(itemQuantity);
    const cost = parseFloat(itemUnitCost);
    if (isNaN(qty) || qty <= 0) {
      showToast('La cantidad debe ser mayor a cero.', 'warning');
      return;
    }
    if (isNaN(cost) || cost < 0) {
      showToast('El costo unitario no puede ser negativo.', 'warning');
      return;
    }

    // Check if already in list
    const existingIndex = itemsList.findIndex((it) => it.productId === selectedProductId);
    const prodObj = products.find((p) => p.id === selectedProductId);
    const prodName = prodObj ? prodObj.name : 'Insumo';

    if (existingIndex > -1) {
      // Update quantity and cost
      const newList = [...itemsList];
      newList[existingIndex].quantity += qty;
      newList[existingIndex].unitCost = cost; // Use latest cost
      setItemsList(newList);
    } else {
      setItemsList((prev) => [
        ...prev,
        {
          productId: selectedProductId,
          productName: prodName,
          quantity: qty,
          unitCost: cost,
        },
      ]);
    }

    // Reset item values
    setItemQuantity('1');
    setItemUnitCost('0');
  };

  const handleRemoveItem = (index: number) => {
    setItemsList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!providerId) {
      showToast('Seleccione un proveedor.', 'warning');
      return;
    }
    if (itemsList.length === 0) {
      showToast('Debe agregar al menos un insumo / producto al ingreso.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        providerId,
        branchId: destinationType === 'branch' ? defaultBranch.id : undefined,
        warehouseId: destinationType === 'warehouse' ? warehouseId : undefined,
        documentNumber: documentNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        items: itemsList.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          unitCost: it.unitCost,
        })),
      };

      await api.recordReceipt(payload, businessId);
      showToast('Entrada de inventario registrada con éxito.', 'success');
      
      // Reset main form fields
      setDocumentNumber('');
      setNotes('');
      setItemsList([]);
      
      // Refresh stock levels & history list
      const [updatedStock, updatedHist] = await Promise.all([
        api.getStockLevels(businessId),
        api.getReceipts(businessId),
      ]);
      setStockLevels(updatedStock);
      setReceiptsHistory(updatedHist);
    } catch (error: any) {
      showToast(error.message || 'Error al guardar la entrada de inventario.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateGrandTotal = () => {
    return itemsList.reduce((sum, item) => sum + item.quantity * item.unitCost, 0).toFixed(2);
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full pb-12 animate-fade-in">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-aged-bronze/25 pb-4">
        <div>
          <Heading level={1} className="!border-none !pb-0 tracking-wide font-light">
            Entradas de Inventario (Recepción)
          </Heading>
          <p className="text-sm text-text-secondary mt-1">
            Registra el ingreso de insumos y mercadería desde tus proveedores directos a sucursales o bodegas.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Form: Log receipt */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="border border-aged-bronze/30 bg-onyx-surface p-6 shadow-md rounded-lg">
            <h2 className="text-lg font-display text-champagne-gold tracking-wide mb-4">
              Registrar Compra / Entrada
            </h2>
            
            <form onSubmit={handleSubmitReceipt} className="flex flex-col gap-4">
              
              {/* Destination selector */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                  Destino de Carga
                </label>
                <div className="flex gap-4 mb-2">
                  <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer">
                    <input
                      type="radio"
                      name="destinationType"
                      checked={destinationType === 'branch'}
                      onChange={() => setDestinationType('branch')}
                      className="text-champagne-gold focus:ring-0 focus:outline-none"
                    />
                    <span>Sucursal ({defaultBranch.name})</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer">
                    <input
                      type="radio"
                      name="destinationType"
                      checked={destinationType === 'warehouse'}
                      onChange={() => setDestinationType('warehouse')}
                      className="text-champagne-gold focus:ring-0 focus:outline-none"
                    />
                    <span>Bodega (Almacén)</span>
                  </label>
                </div>

                {destinationType === 'warehouse' && (
                  <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    className="w-full bg-charcoal border border-aged-bronze/45 rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-champagne-gold"
                  >
                    {warehouses.length === 0 ? (
                      <option value="">No hay bodegas disponibles</option>
                    ) : (
                      warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.code || 'S/C'})
                        </option>
                      ))
                    )}
                  </select>
                )}
              </div>

              {/* Provider selector */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                  Proveedor
                </label>
                <select
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                  className="w-full bg-charcoal border border-aged-bronze/45 rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-champagne-gold"
                >
                  {providers.length === 0 ? (
                    <option value="">No hay proveedores registrados</option>
                  ) : (
                    providers.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))
                  )}
                </select>
              </div>

              {/* Document Number & Notes */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                    Nro. Comprobante / Factura
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. F-98122"
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    className="w-full bg-charcoal border border-aged-bronze/45 rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-champagne-gold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                    Notas / Comentarios
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Entrega matutina"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-charcoal border border-aged-bronze/45 rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-champagne-gold"
                  />
                </div>
              </div>

              {/* Items logging segment */}
              <div className="border-t border-aged-bronze/20 pt-4 mt-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-champagne-gold mb-3">
                  Agregar Insumo / Producto
                </h3>
                
                <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-6">
                    <label className="block text-[10px] text-text-secondary uppercase mb-1">Producto</label>
                    <select
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      className="w-full bg-charcoal border border-aged-bronze/45 rounded-md px-2 py-1.5 text-xs text-text-primary focus:outline-none"
                    >
                      {products.length === 0 ? (
                        <option value="">No hay productos catalogados</option>
                      ) : (
                        products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.sku ? `(${p.sku})` : ''}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[10px] text-text-secondary uppercase mb-1">Cant.</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(e.target.value)}
                      className="w-full bg-charcoal border border-aged-bronze/45 rounded-md px-2 py-1.5 text-xs text-text-primary focus:outline-none text-center"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[10px] text-text-secondary uppercase mb-1">Costo Unit.</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={itemUnitCost}
                      onChange={(e) => setItemUnitCost(e.target.value)}
                      className="w-full bg-charcoal border border-aged-bronze/45 rounded-md px-2 py-1.5 text-xs text-text-primary focus:outline-none text-center"
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
              </div>

              {/* Added items list */}
              <div className="bg-charcoal/30 border border-aged-bronze/15 rounded p-3 min-h-[100px] max-h-[220px] overflow-y-auto mt-2">
                <span className="block text-[10px] text-text-secondary uppercase tracking-wider mb-2 font-bold">
                  Detalle del Ingreso
                </span>
                
                {itemsList.length === 0 ? (
                  <div className="text-center py-6 text-xs text-text-secondary/40">
                    No has agregado insumos a la lista.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {itemsList.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs bg-charcoal/40 border border-aged-bronze/10 rounded px-2.5 py-2">
                        <div className="flex flex-col">
                          <span className="font-semibold text-text-primary">{item.productName}</span>
                          <span className="text-[10px] text-text-secondary">
                            Cant: {item.quantity} x ${item.unitCost}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-champagne-gold font-semibold">
                            ${(item.quantity * item.unitCost).toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-error-red/80 hover:text-error-red transition-colors text-[10px]"
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center border-t border-aged-bronze/25 pt-4 mt-2">
                <div className="flex flex-col">
                  <span className="text-[10px] text-text-secondary uppercase tracking-wider">Costo Total Compra</span>
                  <span className="text-lg font-mono text-champagne-gold font-bold">${calculateGrandTotal()}</span>
                </div>
                
                <Button
                  type="submit"
                  disabled={isSubmitting || itemsList.length === 0}
                  className="bg-champagne-gold hover:bg-champagne-gold/90 text-onyx-surface font-semibold py-2 px-6 rounded shadow-lg uppercase text-xs tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Procesando...' : 'Registrar Entrada'}
                </Button>
              </div>

            </form>
          </div>
        </div>

        {/* Right Panel: View Stock levels and history */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          
          {/* Tabs Selector */}
          <div className="flex bg-charcoal/40 p-1 border border-aged-bronze/20 rounded-md self-start">
            <button
              onClick={() => setActiveRightTab('stock')}
              className={`px-4 py-1.5 text-xs rounded transition-all font-sans tracking-wide ${
                activeRightTab === 'stock'
                  ? 'bg-champagne-gold text-onyx-surface font-semibold shadow-md'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Niveles de Stock
            </button>
            <button
              onClick={() => setActiveRightTab('history')}
              className={`px-4 py-1.5 text-xs rounded transition-all font-sans tracking-wide ${
                activeRightTab === 'history'
                  ? 'bg-champagne-gold text-onyx-surface font-semibold shadow-md'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Historial de Compras
            </button>
          </div>

          <div className="border border-aged-bronze/25 bg-onyx-surface/80 shadow-md rounded-lg overflow-hidden min-h-[480px]">
            
            {activeRightTab === 'stock' ? (
              <div>
                <div className="px-6 py-4 border-b border-aged-bronze/20">
                  <h3 className="text-base font-semibold text-text-primary">
                    Inventario Actual
                  </h3>
                  <p className="text-xs text-text-secondary">Visualiza la cantidad disponible de cada producto en bodegas y sucursales.</p>
                </div>
                
                {isLoading ? (
                  <div className="flex justify-center items-center py-20 text-text-secondary gap-2">
                    <svg className="animate-spin h-5 w-5 text-champagne-gold" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Cargando stock...</span>
                  </div>
                ) : stockLevels.length === 0 ? (
                  <div className="text-center py-20 text-text-secondary/50">
                    No hay inventario registrado. Realiza tu primera entrada de insumos.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="bg-charcoal/40 text-[10px] text-text-secondary uppercase tracking-wider border-b border-aged-bronze/20">
                          <th className="px-6 py-3 font-semibold">Producto/Insumo</th>
                          <th className="px-6 py-3 font-semibold">Ubicación</th>
                          <th className="px-6 py-3 font-semibold">Tipo</th>
                          <th className="px-6 py-3 font-semibold text-right">Cant. Disponible</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-aged-bronze/10 text-sm">
                        {stockLevels.map((st) => (
                          <tr key={st.id} className="hover:bg-charcoal/20 transition-colors">
                            <td className="px-6 py-4 font-semibold text-text-primary">{st.productName}</td>
                            <td className="px-6 py-4 text-xs text-text-secondary">
                              {st.warehouseId ? `Bodega (Central)` : `Sucursal (${defaultBranch.name})`}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`text-[10px] uppercase px-2 py-0.5 rounded border ${
                                st.isIngredient 
                                  ? 'border-champagne-gold/30 text-champagne-gold bg-champagne-gold/5' 
                                  : 'border-text-secondary/30 text-text-secondary'
                              }`}>
                                {st.isIngredient ? 'Insumo' : 'Producto Venta'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right font-mono text-champagne-gold font-bold">
                              {st.quantity}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="px-6 py-4 border-b border-aged-bronze/20">
                  <h3 className="text-base font-semibold text-text-primary">
                    Historial de Carga
                  </h3>
                  <p className="text-xs text-text-secondary">Listado de remisiones, facturas e ingresos del negocio.</p>
                </div>

                {isLoading ? (
                  <div className="flex justify-center items-center py-20 text-text-secondary gap-2">
                    <svg className="animate-spin h-5 w-5 text-champagne-gold" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Cargando historial...</span>
                  </div>
                ) : receiptsHistory.length === 0 ? (
                  <div className="text-center py-20 text-text-secondary/50">
                    No hay registro de entradas previas.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="bg-charcoal/40 text-[10px] text-text-secondary uppercase tracking-wider border-b border-aged-bronze/20">
                          <th className="px-6 py-3 font-semibold">Fecha</th>
                          <th className="px-6 py-3 font-semibold">Proveedor</th>
                          <th className="px-6 py-3 font-semibold">Nro. Doc</th>
                          <th className="px-6 py-3 font-semibold">Destino</th>
                          <th className="px-6 py-3 font-semibold">Notas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-aged-bronze/10 text-sm">
                        {receiptsHistory.map((rh) => (
                          <tr key={rh.id} className="hover:bg-charcoal/20 transition-colors">
                            <td className="px-6 py-4 text-xs text-text-primary">
                              {new Date(rh.receivedAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 font-semibold text-text-primary">{rh.providerName}</td>
                            <td className="px-6 py-4 font-mono text-xs text-champagne-gold">{rh.documentNumber || '-'}</td>
                            <td className="px-6 py-4 text-xs text-text-secondary">
                              {rh.warehouseName ? `Bodega: ${rh.warehouseName}` : `Sucursal: ${rh.branchName}`}
                            </td>
                            <td className="px-6 py-4 text-xs text-text-secondary max-w-[120px] truncate" title={rh.notes || ''}>
                              {rh.notes || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
};
