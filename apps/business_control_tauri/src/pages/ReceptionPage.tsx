import React, { useState, useEffect } from 'react';
import { api, PurchaseOrder, Provider, Warehouse } from '../services/api';
import { Heading } from '../components/atoms/Heading';
import { Button } from '../components/atoms/Button';
import { Input } from '../components/atoms/Input';
import { FormField } from '../components/molecules/FormField';

interface ReceptionPageProps {
  businessId: string;
}

interface ReceptionItem {
  productId: string;
  productName: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCostActual: number;
  unitCostEstimated: number;
}

export const ReceptionPage: React.FC<ReceptionPageProps> = ({ businessId }) => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);
  const [receptionItems, setReceptionItems] = useState<ReceptionItem[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchPurchaseOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const [orders, providersData, warehousesData] = await Promise.all([
        api.getPurchaseOrders(businessId),
        api.getProviders(businessId),
        api.getWarehouses(businessId),
      ]);
      const receivableOrders = orders.filter(
        (po) => po.status === 'sent' || po.status === 'partially_received'
      );
      setPurchaseOrders(receivableOrders);
      setProviders(providersData);
      setWarehouses(warehousesData);
    } catch (err: any) {
      console.error(err);
      setError('Error al cargar órdenes de compra');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchaseOrders();
  }, [businessId]);

  const handleSelectPo = async (po: PurchaseOrder) => {
    try {
      setLoading(true);
      setError(null);
      const poWithItems = await api.getPurchaseOrder(po.id);
      setSelectedPo(poWithItems);
      setNotes('');

      if (poWithItems.items) {
        const items = poWithItems.items.map((item) => {
          const ordered = item.quantity;
          const previouslyReceived = item.actualQuantity || 0;
          const defaultQty = Math.max(0, ordered - previouslyReceived);
          return {
            productId: item.productId,
            productName: item.productName || 'Producto sin nombre',
            quantityOrdered: ordered,
            quantityReceived: defaultQty,
            unitCostActual: item.actualUnitCost || item.estimatedUnitCost || 0,
            unitCostEstimated: item.estimatedUnitCost,
          };
        });
        setReceptionItems(items);
      } else {
        setReceptionItems([]);
      }
    } catch (err: any) {
      console.error(err);
      setError('Error al cargar detalle de la orden');
    } finally {
      setLoading(false);
    }
  };

  const handleQtyChange = (index: number, val: number) => {
    const updated = [...receptionItems];
    updated[index].quantityReceived = val;
    setReceptionItems(updated);
  };

  const handleCostChange = (index: number, val: number) => {
    const updated = [...receptionItems];
    updated[index].unitCostActual = val;
    setReceptionItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPo) return;

    const emptyQtyOrCost = receptionItems.some(
      (item) => item.quantityReceived < 0 || item.unitCostActual < 0
    );
    if (emptyQtyOrCost) {
      alert('Las cantidades y costos no pueden ser negativos');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        items: receptionItems.map((item) => ({
          productId: item.productId,
          quantityReceived: item.quantityReceived,
          unitCostActual: item.unitCostActual,
        })),
        notes: notes || undefined,
      };

      await api.receivePurchaseOrder(selectedPo.id, payload);
      alert('Recepción de orden registrada correctamente y costo promedio actualizado');
      setSelectedPo(null);
      setReceptionItems([]);
      setNotes('');
      fetchPurchaseOrders();
    } catch (err: any) {
      console.error(err);
      alert('Error al registrar la recepción de la orden');
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'partially_received') {
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-amber-500/20 text-amber-300">
          Parcialmente Recibida
        </span>
      );
    }
    return (
      <span className="px-2 py-1 rounded text-xs font-medium bg-blue-500/20 text-blue-300">
        Enviada
      </span>
    );
  };

  const filteredOrders = purchaseOrders.filter((po) => {
    const q = searchQuery.toLowerCase();
    const provName = providers.find((p) => p.id === po.providerId)?.name || '';
    const whName = warehouses.find((w) => w.id === po.warehouseId)?.name || '';
    const matchesSearch =
      !q ||
      po.poNumber.toLowerCase().includes(q) ||
      provName.toLowerCase().includes(q) ||
      whName.toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === 'all' || po.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="w-full lg:h-full min-h-full bg-obsidian p-2 lg:p-6 font-sans overflow-y-auto lg:overflow-hidden">
      <div className="flex flex-col lg:flex-row gap-6 min-h-fit lg:h-full max-w-7xl mx-auto w-full">

        {/* Left Panel: Receivable POs List */}
        <div className="flex-1 flex flex-col gap-4 lg:h-full overflow-hidden">
          <div>
            <Heading level={2} className="!text-lg sm:!text-2xl !border-none !pb-0 text-champagne-gold">
              Recepción de Órdenes de Compra
            </Heading>
            <p className="text-xs text-text-secondary mt-1">
              Seleccione una orden enviada o parcialmente recibida para ingresar los insumos recibidos.
            </p>
          </div>

          {error && (
            <div className="bg-error-red/10 border border-error-red/30 text-error-red rounded p-3 text-xs">
              {error}
            </div>
          )}

          {loading && !selectedPo ? (
            <div className="flex-1 flex items-center justify-center">
              <svg className="animate-spin h-6 w-6 text-champagne-gold" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : purchaseOrders.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-text-secondary text-xs p-8 text-center">
              <span>No hay órdenes de compra pendientes de recibir</span>
            </div>
          ) : (
            <>
              {/* Search and Filters Bar */}
              <div className="flex flex-col md:flex-row gap-4 bg-onyx-surface border border-aged-bronze/40 rounded p-4 shadow-md shadow-black/10 items-center justify-between">
                <div className="w-full md:w-72 relative">
                  <Input
                    type="text"
                    placeholder="Buscar por número, proveedor o bodega..."
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
                      <option value="sent">Enviada</option>
                      <option value="partially_received">Parcialmente Recibida</option>
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
                        <th className="px-6 py-4">Bodega / Sucursal</th>
                        <th className="px-6 py-4 text-center">Estado</th>
                        <th className="px-6 py-4 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-aged-bronze/20 text-sm">
                      {filteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-text-secondary italic">
                            {searchQuery || statusFilter !== 'all'
                              ? 'No se encontraron órdenes que coincidan con la búsqueda.'
                              : 'No hay órdenes de compra pendientes de recibir.'}
                          </td>
                        </tr>
                      ) : (
                        filteredOrders.map((po) => {
                          const providerName = providers.find((p) => p.id === po.providerId)?.name || '—';
                          const warehouseName = warehouses.find((w) => w.id === po.warehouseId)?.name || '—';

                          return (
                            <tr
                              key={po.id}
                              onClick={() => handleSelectPo(po)}
                              className={`cursor-pointer transition-colors ${
                                selectedPo?.id === po.id
                                  ? 'bg-charcoal-surface/80'
                                  : 'hover:bg-charcoal-surface/20'
                              }`}
                            >
                              <td className="px-6 py-4 font-medium text-text-primary font-mono">{po.poNumber}</td>
                              <td className="px-6 py-4 text-text-secondary text-xs">{providerName}</td>
                              <td className="px-6 py-4 text-text-secondary text-xs">{warehouseName}</td>
                              <td className="px-6 py-4 text-center">{getStatusBadge(po.status)}</td>
                              <td className="px-6 py-4 text-center">
                                <span className="text-champagne-gold hover:underline font-medium text-xs">
                                  Ingresar
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="bg-charcoal-surface/40 border-t border-aged-bronze/35 px-6 py-3 flex items-center justify-between text-xs text-text-secondary">
                  <span>Mostrando {filteredOrders.length} de {purchaseOrders.length} órdenes</span>
                  <span className="font-mono">
                    Parciales: {purchaseOrders.filter(po => po.status === 'partially_received').length}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Panel: Reception details & quantities/costs entry */}
        {selectedPo && (
          <div className="w-full lg:w-[480px] bg-onyx-surface border border-aged-bronze/40 rounded-lg p-4 lg:p-6 shadow-xl lg:h-full overflow-y-auto flex flex-col">
            <div className="flex justify-between items-center mb-4 border-b border-aged-bronze/20 pb-3">
              <div>
                <Heading level={3} className="!text-base !border-none !pb-0 text-champagne-gold">
                  Ingreso de Orden: {selectedPo.poNumber}
                </Heading>
                <p className="text-[11px] text-text-secondary mt-0.5">
                  Proveedor: {providers.find((p) => p.id === selectedPo.providerId)?.name || '—'}
                  {' — '}
                  Bodega: {warehouses.find((w) => w.id === selectedPo.warehouseId)?.name || '—'}
                </p>
              </div>
              <button
                onClick={() => setSelectedPo(null)}
                className="text-text-secondary hover:text-white transition-colors text-xs font-semibold"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-4 flex-1">
                <div className="space-y-3">
                  <label className="text-xs font-bold text-text-secondary block">
                    Detalle de Productos Recibidos
                  </label>

                  {receptionItems.length === 0 ? (
                    <p className="text-xs text-text-secondary italic">La orden no tiene productos.</p>
                  ) : (
                    <div className="space-y-3 max-h-[300px] lg:max-h-[400px] overflow-y-auto pr-1">
                      {receptionItems.map((item, index) => (
                        <div key={item.productId} className="bg-charcoal/30 border border-aged-bronze/10 p-3 rounded space-y-2">
                          <div className="flex justify-between">
                            <span className="text-xs font-semibold text-text-primary block truncate max-w-[240px]">
                              {item.productName}
                            </span>
                            <span className="text-[10px] text-text-secondary">
                              Pedida: {item.quantityOrdered}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <FormField label="Cant. Recibida">
                              <Input
                                type="number"
                                value={item.quantityReceived}
                                onChange={(e) => handleQtyChange(index, parseFloat(e.target.value) || 0)}
                                placeholder="0.00"
                                step="0.001"
                                min="0"
                                required
                              />
                            </FormField>
                            <FormField label="Costo Unitario Real">
                              <Input
                                type="number"
                                value={item.unitCostActual}
                                onChange={(e) => handleCostChange(index, parseFloat(e.target.value) || 0)}
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                                required
                              />
                            </FormField>
                          </div>

                          <div className="text-[10px] text-text-secondary flex justify-between pt-1 border-t border-aged-bronze/5">
                            <span>Costo Estimado: ${item.unitCostEstimated.toFixed(2)}</span>
                            <span className="font-semibold text-champagne-gold">
                              Total: ${(item.quantityReceived * item.unitCostActual).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <FormField label="Notas de Recepción">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal border border-aged-bronze/30 rounded text-text-primary text-xs"
                    rows={3}
                    placeholder="Escriba observaciones sobre la entrega..."
                  />
                </FormField>
              </div>

              <div className="flex gap-3 pt-6 border-t border-aged-bronze/20 mt-4">
                <Button
                  type="submit"
                  disabled={saving || receptionItems.length === 0}
                  className="flex-1"
                >
                  {saving ? 'Registrando...' : 'Registrar Ingreso'}
                </Button>
                <Button
                  type="button"
                  onClick={() => setSelectedPo(null)}
                  className="flex-1 !bg-charcoal border border-aged-bronze/30 text-text-secondary hover:text-white"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
