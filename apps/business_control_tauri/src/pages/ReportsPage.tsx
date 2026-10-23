import React, { useState, useEffect } from 'react';
import { api, SalesDashboardReport, ProductSalesReportLine, PaymentMethodSalesReportLine, CashShiftHeader, CashShiftAuditReport } from '../services/api';
import { Heading } from '../components/atoms/Heading';
import { Badge } from '../components/atoms/Badge';
import { Autocomplete } from '../components/molecules/Autocomplete';

interface ReportsPageProps {
  businessId: string;
}

type DateRangeType = 'today' | 'week' | 'month' | 'last30' | 'custom';

export const ReportsPage: React.FC<ReportsPageProps> = ({ businessId }) => {
  const [reportData, setReportData] = useState<SalesDashboardReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Tab selection for reports
  const [activeReportTab, setActiveReportTab] = useState<'sales' | 'salesByProduct' | 'salesByPaymentMethod' | 'cashShifts' | 'stock' | 'kardex'>('sales');

  // Payment Method report states
  const [paymentMethodSales, setPaymentMethodSales] = useState<PaymentMethodSalesReportLine[]>([]);
  const [isPaymentMethodSalesLoading, setIsPaymentMethodSalesLoading] = useState<boolean>(false);
  const [paymentMethodFilterBranch, setPaymentMethodFilterBranch] = useState<string>('all');

  // Cash Shifts states
  const [cashShifts, setCashShifts] = useState<CashShiftHeader[]>([]);
  const [isCashShiftsLoading, setIsCashShiftsLoading] = useState<boolean>(false);
  const [cashShiftsFilterBranch, setCashShiftsFilterBranch] = useState<string>('all');
  const [selectedShiftId, setSelectedShiftId] = useState<string>('');
  const [selectedShiftAudit, setSelectedShiftAudit] = useState<CashShiftAuditReport | null>(null);
  const [isShiftAuditLoading, setIsShiftAuditLoading] = useState<boolean>(false);

  // Product sales report states
  const [productSales, setProductSales] = useState<ProductSalesReportLine[]>([]);
  const [isProductSalesLoading, setIsProductSalesLoading] = useState<boolean>(false);
  const [productFilterBranch, setProductFilterBranch] = useState<string>('all');
  const [productFilterCategory, setProductFilterCategory] = useState<string>('all');
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');

  // Stock report states
  const [stockLevels, setStockLevels] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isStockLoading, setIsStockLoading] = useState<boolean>(false);
  const [stockFilterStatus, setStockFilterStatus] = useState<'active' | 'inactive' | 'all'>('active');
  const [stockFilterLocation, setStockFilterLocation] = useState<string>('all');

  // Kardex report states
  const [selectedAuditProductId, setSelectedAuditProductId] = useState<string>('');
  const [auditLocations, setAuditLocations] = useState<any[]>([]);
  const [auditMovements, setAuditMovements] = useState<any[]>([]);
  const [isAuditLoading, setIsAuditLoading] = useState<boolean>(false);
  const [auditStartDate, setAuditStartDate] = useState<string>('');
  const [auditEndDate, setAuditEndDate] = useState<string>('');

  // Date range state
  const [dateRange, setDateRange] = useState<DateRangeType>('today');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Sales dashboard branch filter
  const [salesFilterBranch, setSalesFilterBranch] = useState<string>('all');

  // Set default dates depending on range type
  useEffect(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (dateRange === 'today') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (dateRange === 'week') {
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
    } else if (dateRange === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (dateRange === 'last30') {
      start.setDate(now.getDate() - 30);
    }

    if (dateRange !== 'custom') {
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
    }
  }, [dateRange]);

  const fetchReport = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Convert simple YYYY-MM-DD input to ISO bounds
      const startISO = startDate ? new Date(startDate + 'T00:00:00').toISOString() : undefined;
      const endISO = endDate ? new Date(endDate + 'T23:59:59').toISOString() : undefined;

      const data = await api.getSalesDashboardReport(businessId, startISO, endISO, salesFilterBranch !== 'all' ? salesFilterBranch : undefined);
      setReportData(data);
    } catch (err: any) {
      console.error(err);
      setError('No se pudieron cargar las estadísticas de ventas. Reintente más tarde.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      fetchReport();
    }
  }, [businessId, startDate, endDate, salesFilterBranch]);

  const fetchStockData = React.useCallback(async () => {
    try {
      setIsStockLoading(true);
      setError(null);
      const [levels, whs, brs, prods, cats] = await Promise.all([
        api.getStockLevels(businessId),
        api.getWarehouses(businessId),
        api.getBranches(businessId).catch(() => []),
        api.getProducts(businessId),
        api.getCategories(businessId),
      ]);
      setStockLevels(levels);
      setWarehouses(whs);
      setBranches(brs);
      setProducts(prods);
      setCategories(cats);

      // Auto-select first product if on Kardex tab and none is selected
      if (prods.length > 0 && !selectedAuditProductId) {
        setSelectedAuditProductId(prods[0].id);
      }
    } catch (err: any) {
      console.error(err);
      setError('No se pudieron cargar los datos de existencia de almacén.');
    } finally {
      setIsStockLoading(false);
    }
  }, [businessId, selectedAuditProductId]);

  useEffect(() => {
    if (activeReportTab === 'stock' || activeReportTab === 'kardex' || activeReportTab === 'salesByProduct') {
      fetchStockData();
    }
  }, [activeReportTab, fetchStockData]);

  const fetchAuditData = React.useCallback(async (productId: string) => {
    if (!productId) return;
    setIsAuditLoading(true);
    try {
      const [existenceReport, movements] = await Promise.all([
        api.getInventoryExistenceReport({
          businessId,
          productId,
          consolidated: false,
        }),
        api.getInventoryKardexReport({
          businessId,
          productId,
          startDate: auditStartDate || undefined,
          endDate: auditEndDate || undefined,
        }),
      ]);
      setAuditLocations(existenceReport.data || []);
      setAuditMovements(movements || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAuditLoading(false);
    }
  }, [businessId, auditStartDate, auditEndDate]);

  useEffect(() => {
    if (activeReportTab === 'kardex' && selectedAuditProductId) {
      fetchAuditData(selectedAuditProductId);
    }
  }, [activeReportTab, selectedAuditProductId, fetchAuditData]);

  const fetchProductSalesReport = React.useCallback(async () => {
    try {
      setIsProductSalesLoading(true);
      setError(null);
      const data = await api.getProductSalesReport({
        businessId,
        startDate,
        endDate,
        branchId: productFilterBranch !== 'all' ? productFilterBranch : undefined,
        categoryId: productFilterCategory !== 'all' ? productFilterCategory : undefined,
      });
      setProductSales(data);
    } catch (err: any) {
      console.error(err);
      setError('No se pudo cargar el reporte de ventas por producto.');
    } finally {
      setIsProductSalesLoading(false);
    }
  }, [businessId, startDate, endDate, productFilterBranch, productFilterCategory]);
  useEffect(() => {
    if (activeReportTab === 'salesByProduct' && startDate && endDate) {
      fetchProductSalesReport();
    }
  }, [activeReportTab, startDate, endDate, fetchProductSalesReport]);

  const fetchPaymentMethodSalesReport = React.useCallback(async () => {
    try {
      setIsPaymentMethodSalesLoading(true);
      setError(null);
      const data = await api.getPaymentMethodsSalesReport({
        businessId,
        startDate,
        endDate,
        branchId: paymentMethodFilterBranch !== 'all' ? paymentMethodFilterBranch : undefined,
      });
      setPaymentMethodSales(data);
    } catch (err: any) {
      console.error(err);
      setError('No se pudo cargar el reporte de ventas por método de pago.');
    } finally {
      setIsPaymentMethodSalesLoading(false);
    }
  }, [businessId, startDate, endDate, paymentMethodFilterBranch]);

  const fetchCashShifts = React.useCallback(async () => {
    try {
      setIsCashShiftsLoading(true);
      setError(null);
      const data = await api.getCashShiftsList({
        businessId,
        startDate,
        endDate,
        branchId: cashShiftsFilterBranch !== 'all' ? cashShiftsFilterBranch : undefined,
      });
      setCashShifts(data);
    } catch (err: any) {
      console.error(err);
      setError('No se pudo cargar el listado de cortes de caja.');
    } finally {
      setIsCashShiftsLoading(false);
    }
  }, [businessId, startDate, endDate, cashShiftsFilterBranch]);

  const fetchShiftAudit = React.useCallback(async (shiftId: string) => {
    try {
      setIsShiftAuditLoading(true);
      const data = await api.getCashShiftAuditReport(shiftId);
      setSelectedShiftAudit(data);
    } catch (err: any) {
      console.error(err);
      setError('No se pudo cargar la auditoría del turno seleccionado.');
    } finally {
      setIsShiftAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeReportTab === 'salesByPaymentMethod' && startDate && endDate) {
      fetchPaymentMethodSalesReport();
    }
  }, [activeReportTab, startDate, endDate, fetchPaymentMethodSalesReport]);

  useEffect(() => {
    if (activeReportTab === 'cashShifts' && startDate && endDate) {
      fetchCashShifts();
    }
  }, [activeReportTab, startDate, endDate, fetchCashShifts]);

  useEffect(() => {
    if (selectedShiftId) {
      fetchShiftAudit(selectedShiftId);
    } else {
      setSelectedShiftAudit(null);
    }
  }, [selectedShiftId, fetchShiftAudit]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
  };

  if (
    (activeReportTab === 'sales' && isLoading && !reportData) || 
    (activeReportTab === 'salesByProduct' && isProductSalesLoading && productSales.length === 0) ||
    (activeReportTab === 'salesByPaymentMethod' && isPaymentMethodSalesLoading && paymentMethodSales.length === 0) ||
    (activeReportTab === 'cashShifts' && isCashShiftsLoading && cashShifts.length === 0) ||
    ((activeReportTab === 'stock' || activeReportTab === 'kardex') && isStockLoading && stockLevels.length === 0)
  ) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-obsidian text-text-secondary select-none">
        <svg className="animate-spin h-8 w-8 text-champagne-gold" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-xs uppercase tracking-widest">
          {activeReportTab === 'sales' ? 'Generando Métricas de Negocio...' : (activeReportTab === 'salesByProduct' ? 'Generando Reporte de Productos...' : (activeReportTab === 'salesByPaymentMethod' ? 'Analizando Métodos de Pago...' : (activeReportTab === 'cashShifts' ? 'Consultando Cortes de Caja...' : 'Consultando Inventario y Catálogo...')))}
        </span>
      </div>
    );
  }

  if (activeReportTab === 'sales' && !reportData) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-obsidian text-text-secondary select-none p-6">
        <span className="text-sm text-error-red">{error || 'No se pudieron cargar las estadísticas de ventas.'}</span>
        <button
          onClick={fetchReport}
          className="bg-charcoal border border-aged-bronze/45 hover:border-champagne-gold hover:text-champagne-gold text-xs px-3 py-1.5 rounded transition-all cursor-pointer font-semibold uppercase tracking-wider text-text-primary"
        >
          Reintentar Cargar
        </button>
      </div>
    );
  }

  // Calculate top profit margins
  const topProfitProducts = reportData?.topProducts
    ? [...(reportData.topProducts || [])].sort((a, b) => b.profitMargin - a.profitMargin)
    : [];

  // Filter stock levels based on selected status and location filters
  const filteredStockLevels = stockLevels.filter((level) => {
    // 1. Status Filter: active/inactive/all
    const isActive = level.isActive !== false; // handle null/undefined as true
    if (stockFilterStatus === 'active' && !isActive) return false;
    if (stockFilterStatus === 'inactive' && isActive) return false;

    // 2. Location Filter
    if (stockFilterLocation !== 'all') {
      const [type, locId] = stockFilterLocation.split(':');
      if (type === 'warehouse' && level.warehouseId !== locId) return false;
      if (type === 'branch' && level.branchId !== locId) return false;
    }

    return true;
  });

  // Find currently selected audit product
  const selectedAuditProduct = products.find((p) => p.id === selectedAuditProductId);

  // Compute catalog stock sum
  const catalogStock = selectedAuditProductId
    ? stockLevels
        .filter((sl) => sl.productId === selectedAuditProductId)
        .reduce((sum, sl) => sum + parseFloat(sl.quantity || '0'), 0)
    : 0;

  // Compute sum across physical locations returned from the audit endpoint
  const sumOfLocations = auditLocations.reduce((sum, loc) => sum + parseFloat(loc.quantity || '0'), 0);

  const renderSalesByProductTab = () => {
    const filteredProductSales = productSales.filter((item) => {
      if (productSearchQuery.trim() === '') return true;
      const query = productSearchQuery.toLowerCase();
      return (
        item.productName.toLowerCase().includes(query) ||
        (item.sku && item.sku.toLowerCase().includes(query))
      );
    });

    const totalUnits = filteredProductSales.reduce((acc, curr) => acc + curr.quantitySold, 0);
    const totalGross = filteredProductSales.reduce((acc, curr) => acc + curr.grossSales, 0);
    const totalTax = filteredProductSales.reduce((acc, curr) => acc + curr.taxAmount, 0);
    const totalNet = filteredProductSales.reduce((acc, curr) => acc + curr.netSales, 0);
    const overallAvgPrice = totalUnits > 0 ? totalGross / totalUnits : 0;

    const exportToCSV = () => {
      const headers = ['Producto', 'Categoría', 'SKU', 'Unidades Vendidas', 'Precio Unitario Promedio', 'Venta Bruta Total', 'IVA Incluido (16%)', 'Venta Neta Total'];
      const rows = filteredProductSales.map(item => [
        item.productName,
        item.categoryName,
        item.sku || '',
        item.quantitySold,
        item.averagePrice.toFixed(2),
        item.grossSales.toFixed(2),
        item.taxAmount.toFixed(2),
        item.netSales.toFixed(2)
      ]);
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(val => `"${val.toString().replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `reporte-ventas-productos-${startDate}-a-${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    const exportToXLSX = () => {
      // @ts-ignore
      const XLSX = window.XLSX;
      if (!XLSX) {
        console.error('XLSX library not loaded.');
        return;
      }
      
      const headers = ['Producto', 'Categoría', 'SKU', 'Unidades Vendidas', 'Precio Unitario Ponderado', 'Venta Bruta Total', 'IVA Incluido (16%)', 'Venta Neta Total'];
      const rows = filteredProductSales.map(item => [
        item.productName,
        item.categoryName,
        item.sku || '',
        item.quantitySold,
        item.averagePrice,
        item.grossSales,
        item.taxAmount,
        item.netSales
      ]);
      
      const footer = [
        'TOTALES',
        '',
        '',
        totalUnits,
        totalUnits > 0 ? Number((totalGross / totalUnits).toFixed(2)) : 0,
        Number(totalGross.toFixed(2)),
        Number(totalTax.toFixed(2)),
        Number(totalNet.toFixed(2))
      ];
      
      const data = [headers, ...rows, footer];
      const worksheet = XLSX.utils.aoa_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Ventas por Producto');
      
      XLSX.writeFile(workbook, `reporte-ventas-productos-${startDate}-a-${endDate}.xlsx`);
    };

    return (
      <div className="flex-1 overflow-hidden flex flex-col gap-4">
        <style>{`
          @media print {
            .no-print, nav, header, button, select, input, .sub-tabs-nav, .heading-container {
              display: none !important;
            }
            .print-area {
              width: 100% !important;
              background: white !important;
              color: black !important;
              border-collapse: collapse !important;
              position: absolute;
              left: 0;
              top: 0;
              margin: 0;
              padding: 20px;
            }
            .print-table {
              width: 100% !important;
              border: 1px solid #000 !important;
              border-collapse: collapse !important;
              color: black !important;
            }
            .print-table th, .print-table td {
              border: 1px solid #000 !important;
              padding: 8px !important;
              color: black !important;
            }
            .print-table th {
              background: #f2f2f2 !important;
              font-weight: bold !important;
            }
          }
        `}</style>

        <div className="bg-onyx-surface border border-aged-bronze/40 rounded-lg p-5 shadow-xl flex-1 flex flex-col min-h-0 print-area">
          <span className="text-xs font-semibold text-champagne-gold uppercase tracking-wider mb-4 flex justify-between items-center no-print">
            <span>Listado de Ventas por Producto</span>
            <div className="flex items-center gap-2">
              <button
                onClick={exportToCSV}
                className="bg-charcoal border border-aged-bronze/45 hover:border-champagne-gold hover:text-champagne-gold text-[10px] uppercase font-bold tracking-wider px-2 py-1.5 rounded transition-all cursor-pointer"
              >
                Exportar CSV
              </button>
              <button
                onClick={exportToXLSX}
                className="bg-charcoal border border-aged-bronze/45 hover:border-champagne-gold hover:text-champagne-gold text-[10px] uppercase font-bold tracking-wider px-2 py-1.5 rounded transition-all cursor-pointer"
              >
                Exportar Excel
              </button>
              <button
                onClick={() => window.print()}
                className="bg-charcoal border border-aged-bronze/45 hover:border-champagne-gold hover:text-champagne-gold text-[10px] uppercase font-bold tracking-wider px-2 py-1.5 rounded transition-all cursor-pointer"
              >
                Imprimir PDF
              </button>
            </div>
          </span>

          <div className="hidden print:block mb-4">
            <h1 className="text-lg font-bold text-black">Reporte de Ventas por Producto</h1>
            <p className="text-xs text-black">Rango: {startDate} a {endDate}</p>
            {productFilterBranch !== 'all' && (
              <p className="text-xs text-black">Sucursal: {branches.find(b => b.id === productFilterBranch)?.name || 'Seleccionada'}</p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            <table className="w-full text-left border-collapse text-xs select-text font-sans print-table">
              <thead>
                <tr className="bg-charcoal-surface border-b border-aged-bronze/20 text-text-secondary uppercase text-[9px] tracking-wider">
                  <th className="p-3 font-medium">Producto</th>
                  <th className="p-3 font-medium">Categoría</th>
                  <th className="p-3 font-medium text-center">SKU</th>
                  <th className="p-3 font-medium text-center">Unidades</th>
                  <th className="p-3 font-medium text-right">Precio Prom. (Bruto)</th>
                  <th className="p-3 font-medium text-right">Venta Bruta</th>
                  <th className="p-3 font-medium text-right">IVA (16%)</th>
                  <th className="p-3 font-medium text-right">Venta Neta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-aged-bronze/10 text-text-primary">
                {filteredProductSales.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-text-secondary italic">
                      No se encontraron registros de ventas para los filtros seleccionados
                    </td>
                  </tr>
                ) : (
                  filteredProductSales.map((item) => (
                    <tr key={item.productId} className="hover:bg-charcoal-surface/10">
                      <td className="p-3 font-medium text-text-primary">{item.productName}</td>
                      <td className="p-3 text-text-secondary">{item.categoryName}</td>
                      <td className="p-3 text-center font-mono text-text-secondary">{item.sku || '-'}</td>
                      <td className="p-3 text-center text-text-secondary">{item.quantitySold}</td>
                      <td className="p-3 text-right text-text-secondary font-mono">{formatCurrency(item.averagePrice)}</td>
                      <td className="p-3 text-right font-medium text-text-primary font-mono">{formatCurrency(item.grossSales)}</td>
                      <td className="p-3 text-right text-text-secondary font-mono">{formatCurrency(item.taxAmount)}</td>
                      <td className="p-3 text-right font-semibold text-champagne-gold font-mono">{formatCurrency(item.netSales)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredProductSales.length > 0 && (
                <tfoot>
                  <tr className="bg-charcoal-surface/30 border-t-2 border-aged-bronze/35 font-bold text-text-primary">
                    <td className="p-3" colSpan={3}>TOTALES</td>
                    <td className="p-3 text-center font-mono">{totalUnits}</td>
                    <td className="p-3 text-right font-mono">{formatCurrency(overallAvgPrice)}</td>
                    <td className="p-3 text-right font-mono text-text-primary">{formatCurrency(totalGross)}</td>
                    <td className="p-3 text-right font-mono text-text-secondary">{formatCurrency(totalTax)}</td>
                    <td className="p-3 text-right font-mono text-champagne-gold">{formatCurrency(totalNet)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderSalesByPaymentMethodTab = () => {
    const totalAmount = paymentMethodSales.reduce((acc, curr) => acc + curr.totalAmount, 0);
    const totalPayments = paymentMethodSales.reduce((acc, curr) => acc + curr.paymentsCount, 0);

    const exportToCSV = () => {
      const headers = ['Método de Pago', 'Número de Pagos', 'Monto Recibido (Bruto)', 'Participación (%)'];
      const rows = paymentMethodSales.map(item => [
        item.paymentMethod === 'cash' ? 'Efectivo' : item.paymentMethod === 'card' ? 'Tarjeta / Medios Electrónicos' : item.paymentMethod,
        item.paymentsCount,
        item.totalAmount.toFixed(2),
        item.sharePercent.toFixed(2)
      ]);
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(val => `"${val.toString().replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `reporte-ventas-metodo-pago-${startDate}-a-${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    return (
      <div className="flex-1 overflow-hidden flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
          {paymentMethodSales.map((item) => {
            const methodLabel = item.paymentMethod === 'cash' ? 'Efectivo' : item.paymentMethod === 'card' ? 'Tarjeta / Electrónico' : item.paymentMethod;
            const icon = item.paymentMethod === 'cash' ? '💵' : item.paymentMethod === 'card' ? '💳' : '💰';
            const colorClass = item.paymentMethod === 'cash' ? 'border-successGreen/35 text-successGreen' : 'border-blue-400/35 text-blue-400';
            return (
              <div key={item.paymentMethod} className={`bg-onyx-surface border ${colorClass} rounded-lg p-5 shadow-lg flex flex-col justify-between`}>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs uppercase font-bold tracking-wider opacity-75">{methodLabel}</span>
                  <span className="text-xl">{icon}</span>
                </div>
                <div>
                  <span className="text-2xl font-bold font-mono text-text-primary block">{formatCurrency(item.totalAmount)}</span>
                  <div className="flex justify-between text-xs text-text-secondary mt-1">
                    <span>{item.paymentsCount} transacciones</span>
                    <span className="font-semibold text-champagne-gold">{item.sharePercent}% del total</span>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="bg-charcoal border border-aged-bronze/40 rounded-lg p-5 shadow-lg flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs uppercase font-bold text-champagne-gold tracking-wider">Total Recaudado</span>
              <span className="text-xl">📊</span>
            </div>
            <div>
              <span className="text-2xl font-bold font-mono text-champagne-gold block">{formatCurrency(totalAmount)}</span>
              <div className="flex justify-between text-xs text-text-secondary mt-1">
                <span>{totalPayments} transacciones totales</span>
                <span className="font-semibold">100.00%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-onyx-surface border border-aged-bronze/40 rounded-lg p-5 shadow-xl flex-1 flex flex-col min-h-0">
          <span className="text-xs font-semibold text-champagne-gold uppercase tracking-wider mb-4 flex justify-between items-center no-print">
            <span>Resumen Detallado por Forma de Pago</span>
            <div className="flex items-center gap-2">
              <button
                onClick={exportToCSV}
                className="bg-charcoal border border-aged-bronze/45 hover:border-champagne-gold hover:text-champagne-gold text-[10px] uppercase font-bold tracking-wider px-2 py-1.5 rounded transition-all cursor-pointer"
              >
                Exportar CSV
              </button>
              <button
                onClick={() => window.print()}
                className="bg-charcoal border border-aged-bronze/45 hover:border-champagne-gold hover:text-champagne-gold text-[10px] uppercase font-bold tracking-wider px-2 py-1.5 rounded transition-all cursor-pointer"
              >
                Imprimir PDF
              </button>
            </div>
          </span>

          <div className="flex-1 overflow-y-auto pr-1">
            <table className="w-full text-left border-collapse text-xs select-text font-sans">
              <thead>
                <tr className="bg-charcoal-surface border-b border-aged-bronze/20 text-text-secondary uppercase text-[9px] tracking-wider">
                  <th className="p-3 font-medium">Método de Pago</th>
                  <th className="p-3 font-medium text-center">Transacciones (Pagos)</th>
                  <th className="p-3 font-medium text-right">Monto Recibido</th>
                  <th className="p-3 font-medium text-right">Participación (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-aged-bronze/10 text-text-primary">
                {paymentMethodSales.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-text-secondary italic">
                      No se registraron transacciones para los filtros seleccionados
                    </td>
                  </tr>
                ) : (
                  paymentMethodSales.map((item) => {
                    const methodLabel = item.paymentMethod === 'cash' ? 'Efectivo' : item.paymentMethod === 'card' ? 'Tarjeta / Electrónico' : item.paymentMethod;
                    return (
                      <tr key={item.paymentMethod} className="hover:bg-charcoal-surface/10">
                        <td className="p-3 font-medium text-text-primary capitalize">{methodLabel}</td>
                        <td className="p-3 text-center text-text-secondary font-mono">{item.paymentsCount}</td>
                        <td className="p-3 text-right font-medium text-text-primary font-mono">{formatCurrency(item.totalAmount)}</td>
                        <td className="p-3 text-right font-semibold text-champagne-gold font-mono">{item.sharePercent.toFixed(2)}%</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {paymentMethodSales.length > 0 && (
                <tfoot>
                  <tr className="bg-charcoal-surface/30 border-t-2 border-aged-bronze/35 font-bold text-text-primary">
                    <td className="p-3">TOTALES</td>
                    <td className="p-3 text-center font-mono">{totalPayments}</td>
                    <td className="p-3 text-right font-mono text-champagne-gold">{formatCurrency(totalAmount)}</td>
                    <td className="p-3 text-right font-mono">100.00%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderCashShiftsTab = () => {
    const exportShiftsToCSV = () => {
      const headers = ['Operador', 'Sucursal', 'Fondo Inicial', 'Fondo Final Entregado', 'Estado', 'Fecha Apertura', 'Fecha Cierre'];
      const rows = cashShifts.map(item => [
        item.cashierName,
        item.branchName,
        Number(item.initialFloat).toFixed(2),
        item.closedAt ? Number(item.cashDrawerAmount).toFixed(2) : 'Activo (Sin Cierre)',
        item.status === 'open' ? 'Abierto' : 'Cerrado',
        new Date(item.openedAt).toLocaleString('es-MX'),
        item.closedAt ? new Date(item.closedAt).toLocaleString('es-MX') : '-'
      ]);
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(val => `"${val.toString().replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `reporte-cortes-caja-${startDate}-a-${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    return (
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-6 min-h-0">
        <div className="bg-onyx-surface border border-aged-bronze/40 rounded-lg p-5 shadow-xl flex-1 flex flex-col min-h-[300px] lg:min-h-0">
          <span className="text-xs font-semibold text-champagne-gold uppercase tracking-wider mb-4 flex justify-between items-center no-print">
            <span>Historial de Turnos y Cortes</span>
            <div className="flex items-center gap-2">
              <button
                onClick={exportShiftsToCSV}
                className="bg-charcoal border border-aged-bronze/45 hover:border-champagne-gold hover:text-champagne-gold text-[10px] uppercase font-bold tracking-wider px-2 py-1.5 rounded transition-all cursor-pointer"
              >
                Exportar CSV
              </button>
            </div>
          </span>

          <div className="flex-1 overflow-y-auto pr-1">
            <div className="flex flex-col gap-2">
              {cashShifts.length === 0 ? (
                <div className="p-8 text-center text-text-secondary italic text-xs">
                  No se encontraron turnos registrados para el rango seleccionado
                </div>
              ) : (
                cashShifts.map((shift) => {
                  const isSelected = selectedShiftId === shift.id;
                  const isOpen = shift.status === 'open';
                  const dateStr = new Date(shift.openedAt).toLocaleDateString('es-MX', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={shift.id}
                      onClick={() => setSelectedShiftId(shift.id)}
                      className={`p-4 rounded-lg border transition-all duration-200 cursor-pointer flex flex-col gap-2 shadow-md ${
                        isSelected
                          ? 'bg-charcoal-surface border-champagne-gold/60 ring-1 ring-champagne-gold/30'
                          : 'bg-charcoal/50 border-aged-bronze/15 hover:border-aged-bronze/45'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-text-primary">{shift.cashierName}</span>
                        <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full uppercase tracking-wider ${
                          isOpen
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
                            : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/25'
                        }`}>
                          {isOpen ? 'Caja Activa (X)' : 'Cerrado (Z)'}
                        </span>
                      </div>

                      <div className="flex justify-between text-xs text-text-secondary">
                        <span>Sucursal: <strong className="text-text-primary">{shift.branchName}</strong></span>
                        <span className="font-mono text-[10px]">{dateStr}</span>
                      </div>

                      <div className="flex justify-between text-xs border-t border-aged-bronze/10 pt-2 mt-1">
                        <span>Fondo Inicial: <strong className="text-text-primary font-mono">{formatCurrency(Number(shift.initialFloat))}</strong></span>
                        {!isOpen && (
                          <span>Entrega: <strong className="text-champagne-gold font-mono">{formatCurrency(Number(shift.cashDrawerAmount))}</strong></span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="bg-onyx-surface border border-aged-bronze/40 rounded-lg p-5 shadow-xl w-full lg:w-96 flex flex-col min-h-[450px] lg:min-h-0">
          <span className="text-xs font-semibold text-champagne-gold uppercase tracking-wider mb-4 block">
            Auditoría y Arqueo Detallado
          </span>

          {isShiftAuditLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2">
              <svg className="animate-spin h-6 w-6 text-champagne-gold" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-xs text-text-secondary">Generando arqueo...</span>
            </div>
          ) : selectedShiftAudit ? (() => {
            const shiftInfo = selectedShiftAudit.shiftInfo || ({} as any);
            const initialFloat = shiftInfo.initialFloat ?? selectedShiftAudit.summary?.initialFloat ?? 0;
            const cashDrawerAmount = shiftInfo.cashDrawerAmount ?? selectedShiftAudit.summary?.actualCash ?? 0;
            const cashSales = selectedShiftAudit.salesSummary?.cashSales ?? selectedShiftAudit.summary?.cashSales ?? 0;
            const cardSales = selectedShiftAudit.salesSummary?.cardSales ?? selectedShiftAudit.summary?.cardSales ?? 0;
            const totalSales = selectedShiftAudit.salesSummary?.totalSales ?? selectedShiftAudit.summary?.totalSales ?? (cashSales + cardSales);
            const expectedCash = selectedShiftAudit.expectedCash ?? selectedShiftAudit.summary?.expectedCash ?? 0;
            const discrepancy = selectedShiftAudit.discrepancy ?? selectedShiftAudit.summary?.cashDifference ?? 0;
            const txs = selectedShiftAudit.transactions || selectedShiftAudit.cashMovements || [];

            return (
              <div className="flex-1 flex flex-col min-h-0 overflow-y-auto pr-1 text-xs gap-4 select-text">
                <div className="bg-charcoal/40 p-3 rounded-lg border border-aged-bronze/20 flex flex-col gap-1.5">
                  <div className="flex justify-between font-bold text-text-primary text-[13px]">
                    <span>{shiftInfo.cashierName || 'Operador'}</span>
                    <span className="text-champagne-gold font-mono">{shiftInfo.status === 'open' ? 'Turno Abierto' : 'Turno Cerrado'}</span>
                  </div>
                  <div className="text-text-secondary text-[10.5px]">
                    <div>Sucursal: <strong className="text-text-primary">{shiftInfo.branchName || 'Sucursal'}</strong></div>
                    {shiftInfo.openedAt && (
                      <div>Apertura: {new Date(shiftInfo.openedAt).toLocaleString('es-MX')}</div>
                    )}
                    {shiftInfo.closedAt && (
                      <div>Cierre: {new Date(shiftInfo.closedAt).toLocaleString('es-MX')}</div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 border-b border-aged-bronze/20 pb-3">
                  <div className="flex justify-between text-text-secondary">
                    <span>(+) Fondo Inicial de Caja:</span>
                    <span className="font-mono text-text-primary font-medium">{formatCurrency(initialFloat)}</span>
                  </div>
                  <div className="flex justify-between text-text-secondary">
                    <span>(+) Ventas Efectivo Sistema:</span>
                    <span className="font-mono text-text-primary font-medium">{formatCurrency(cashSales)}</span>
                  </div>

                  {txs.length > 0 && (
                    <div className="bg-charcoal/20 p-2 rounded flex flex-col gap-1 my-1 border border-aged-bronze/10">
                      <span className="text-[10px] font-bold text-text-secondary uppercase">Movimientos de Turno:</span>
                      {txs.map((t) => (
                        <div key={t.id} className="flex justify-between text-[11px] font-mono">
                          <span className="text-text-secondary truncate w-36">
                            {t.type === 'cash-in' ? '[+] Ingreso' : '[-] Retiro'}: {t.reason}
                          </span>
                          <span className={t.type === 'cash-in' ? 'text-successGreen' : 'text-red-400'}>
                            {t.type === 'cash-in' ? '+' : '-'}{formatCurrency(t.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-between font-bold text-text-primary border-t border-aged-bronze/15 pt-2 mt-1">
                    <span>(=) Efectivo Esperado en Caja:</span>
                    <span className="font-mono">{formatCurrency(expectedCash)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-text-primary">
                    <span>(=) Efectivo Físico Entregado:</span>
                    <span className="font-mono text-champagne-gold">
                      {shiftInfo.status === 'open' ? 'Sin arqueo físico' : formatCurrency(cashDrawerAmount)}
                    </span>
                  </div>
                </div>

                {shiftInfo.status === 'closed' ? (
                  <div className={`p-4 rounded-lg border text-center flex flex-col gap-1 ${
                    discrepancy === 0
                      ? 'bg-successGreen/5 border-successGreen/30 text-successGreen'
                      : discrepancy > 0
                      ? 'bg-successGreen/5 border-successGreen/30 text-successGreen'
                      : 'bg-red-500/5 border-red-500/30 text-red-400'
                  }`}>
                    <span className="text-[10px] uppercase font-bold tracking-wider opacity-75">Resultado del Arqueo</span>
                    <span className="text-xl font-extrabold font-mono">
                      {discrepancy === 0 
                        ? 'DIFERENCIA: $0.00 (Cuadrado)' 
                        : `${discrepancy > 0 ? 'SOBRANTE' : 'FALTANTE'}: ${formatCurrency(Math.abs(discrepancy))}`}
                    </span>
                    <span className="text-[10px] opacity-75">
                      {discrepancy === 0 
                        ? 'El arqueo físico coincide exactamente con el sistema.' 
                        : `Hay una discrepancia de ${formatCurrency(Math.abs(discrepancy))} frente a las ventas esperadas.`}
                    </span>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-amber-400 text-center text-[11px] leading-relaxed">
                    ⚠️ <strong>Caja en operación</strong>. Se está auditando el corte parcial (Corte X). El resultado del arqueo final y discrepancias se mostrará cuando el cajero realice el Corte Z en su terminal.
                  </div>
                )}

                <div className="bg-charcoal/10 border border-aged-bronze/15 rounded-lg p-3 flex flex-col gap-1.5 mt-2">
                  <span className="text-[10px] font-bold text-text-secondary uppercase mb-1">Otros Medios de Pago</span>
                  <div className="flex justify-between text-text-secondary">
                    <span>Tarjeta / Electrónico Sistema:</span>
                    <span className="font-mono text-text-primary">{formatCurrency(cardSales)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-text-primary border-t border-aged-bronze/10 pt-2 mt-1">
                    <span>Venta Total del Turno:</span>
                    <span className="font-mono text-champagne-gold">{formatCurrency(totalSales)}</span>
                  </div>
                </div>
              </div>
            );
          })() : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-text-secondary italic text-xs p-6">
              Selecciona un turno de la lista para ver la auditoría de caja detallada
            </div>
          )}
        </div>
      </div>
    );
  };

  // Check if they match
  const isConsistent = Math.abs(catalogStock - sumOfLocations) < 0.001;

  return (
    <div className="w-full lg:h-full min-h-full bg-obsidian p-2 lg:p-6 font-sans overflow-y-auto lg:overflow-hidden flex flex-col">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-aged-bronze/30 pb-4 mb-6">
        <div>
          <Heading level={2} className="!border-none !pb-0 text-champagne-gold font-light">
            {activeReportTab === 'stock'
              ? 'Reporte de Existencia de Almacén'
              : activeReportTab === 'kardex'
                ? 'Auditoría Visual y Kardex de Inventario'
                : 'Reportes e Inteligencia de Ventas'}
          </Heading>
          <p className="text-xs text-text-secondary mt-1">
            {activeReportTab === 'stock'
              ? 'Control de inventario en bodegas y sucursales con detalle de mínimos de stock y deprecados.'
              : activeReportTab === 'salesByProduct'
                ? 'Reporte detallado de ventas por producto vendido consolidando cantidades, importes, IVA y venta neta.'
                : activeReportTab === 'kardex'
                  ? 'Monitoreo de consistencia de stock por sucursal y registro del libro diario de movimientos.'
                  : 'Análisis de ingresos, rentabilidad de productos, sucursales y desempeño del personal.'}
          </p>
        </div>

        {/* Filters bar */}
        <div className="flex flex-wrap items-center gap-2">
          {activeReportTab === 'sales' || activeReportTab === 'salesByProduct' || activeReportTab === 'salesByPaymentMethod' || activeReportTab === 'cashShifts' ? (
            <>
              <div className="flex bg-charcoal border border-aged-bronze/45 rounded p-0.5">
                {(['today', 'week', 'month', 'last30', 'custom'] as DateRangeType[]).map((range) => (
                  <button
                    key={range}
                    onClick={() => setDateRange(range)}
                    className={`px-3 py-1.5 rounded text-[10px] uppercase font-semibold tracking-wider transition-all duration-200 cursor-pointer ${
                      dateRange === range
                        ? 'bg-charcoal-surface text-champagne-gold shadow-sm'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {range === 'today' ? 'Hoy' : range === 'week' ? 'Semana' : range === 'month' ? 'Mes' : range === 'last30' ? '30 Días' : 'Fijo'}
                  </button>
                ))}
              </div>

              {branches.length > 0 && (
                <div className="flex items-center gap-2 bg-charcoal border border-aged-bronze/45 rounded p-1">
                  <span className="text-[10px] text-text-secondary uppercase px-1">Sucursal:</span>
                  <select
                    value={activeReportTab === 'sales' ? salesFilterBranch : activeReportTab === 'salesByProduct' ? productFilterBranch : activeReportTab === 'salesByPaymentMethod' ? paymentMethodFilterBranch : cashShiftsFilterBranch}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (activeReportTab === 'sales') setSalesFilterBranch(val);
                      else if (activeReportTab === 'salesByProduct') setProductFilterBranch(val);
                      else if (activeReportTab === 'salesByPaymentMethod') setPaymentMethodFilterBranch(val);
                      else setCashShiftsFilterBranch(val);
                    }}
                    className="bg-transparent text-xs text-text-primary focus:outline-none px-1 cursor-pointer font-medium text-champagne-gold"
                  >
                    <option value="all">Todas las Sucursales</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id} className="bg-onyx text-text-primary">{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {dateRange === 'custom' && (
                <div className="flex items-center gap-2 bg-charcoal border border-aged-bronze/45 rounded p-1">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent text-xs text-text-primary focus:outline-none px-1"
                  />
                  <span className="text-[10px] text-text-secondary uppercase">a</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent text-xs text-text-primary focus:outline-none px-1"
                  />
                  <button
                    onClick={
                      activeReportTab === 'salesByProduct'
                        ? fetchProductSalesReport
                        : activeReportTab === 'salesByPaymentMethod'
                        ? fetchPaymentMethodSalesReport
                        : activeReportTab === 'cashShifts'
                        ? fetchCashShifts
                        : fetchReport
                    }
                    className="bg-charcoal-surface border border-aged-bronze/45 hover:border-champagne-gold hover:text-champagne-gold text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded transition-all cursor-pointer"
                  >
                    Filtrar
                  </button>
                </div>
              )}

              {activeReportTab === 'salesByProduct' && (
                <>
                  <div className="flex items-center gap-2 bg-charcoal border border-aged-bronze/45 rounded p-1">
                    <span className="text-[10px] text-text-secondary uppercase px-1">Categoría:</span>
                    <select
                      value={productFilterCategory}
                      onChange={(e) => setProductFilterCategory(e.target.value)}
                      className="bg-transparent text-xs text-text-primary focus:outline-none px-1 cursor-pointer font-medium text-champagne-gold"
                    >
                      <option value="all">Todas</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id} className="bg-onyx text-text-primary">{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 bg-charcoal border border-aged-bronze/45 rounded p-1">
                    <span className="text-[10px] text-text-secondary uppercase px-1">Búsqueda:</span>
                    <input
                      type="text"
                      value={productSearchQuery}
                      onChange={(e) => setProductSearchQuery(e.target.value)}
                      placeholder="Nombre o SKU..."
                      className="bg-transparent text-xs text-text-primary focus:outline-none px-1 w-32 placeholder-text-secondary/50"
                    />
                  </div>
                </>
              )}
            </>
          ) : activeReportTab === 'stock' ? (
            <>
              {/* Location Filter */}
              <div className="flex items-center gap-2 bg-charcoal border border-aged-bronze/45 rounded p-1">
                <span className="text-[10px] text-text-secondary uppercase px-1">Ubicación:</span>
                <select
                  value={stockFilterLocation}
                  onChange={(e) => setStockFilterLocation(e.target.value)}
                  className="bg-transparent text-xs text-text-primary focus:outline-none px-1 cursor-pointer font-medium text-champagne-gold"
                >
                  <option value="all">Todos los Puntos</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={`warehouse:${w.id}`} className="bg-onyx text-text-primary">Bodega: {w.name}</option>
                  ))}
                  {branches.map((b) => (
                    <option key={b.id} value={`branch:${b.id}`} className="bg-onyx text-text-primary">Sucursal: {b.name}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex bg-charcoal border border-aged-bronze/45 rounded p-0.5">
                {(['active', 'inactive', 'all'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setStockFilterStatus(status)}
                    className={`px-3 py-1.5 rounded text-[10px] uppercase font-semibold tracking-wider transition-all duration-200 cursor-pointer ${
                      stockFilterStatus === status
                        ? 'bg-charcoal-surface text-champagne-gold shadow-sm'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {status === 'active' ? 'Activos' : status === 'inactive' ? 'Inactivos' : 'Todos'}
                  </button>
                ))}
              </div>
            </>
          ) : (
            /* Kardex date filters */
            <div className="flex items-center gap-2 bg-charcoal border border-aged-bronze/45 rounded p-1">
              <span className="text-[10px] text-text-secondary uppercase px-1">Rango Kardex:</span>
              <input
                type="date"
                value={auditStartDate}
                onChange={(e) => setAuditStartDate(e.target.value)}
                className="bg-transparent text-xs text-text-primary focus:outline-none px-1"
              />
              <span className="text-[10px] text-text-secondary uppercase">a</span>
              <input
                type="date"
                value={auditEndDate}
                onChange={(e) => setAuditEndDate(e.target.value)}
                className="bg-transparent text-xs text-text-primary focus:outline-none px-1"
              />
            </div>
          )}
        </div>
      </div>

      {/* Sub tabs navigation */}
      <div className="flex border-b border-aged-bronze/25 gap-1 mb-6 overflow-x-auto -mx-2 px-2 lg:mx-0 lg:px-0 lg:gap-6">
        <button
          onClick={() => setActiveReportTab('sales')}
          className={`pb-3 text-xs lg:text-sm font-medium tracking-wide transition-all border-b-2 cursor-pointer whitespace-nowrap px-2 ${
            activeReportTab === 'sales'
              ? 'border-champagne-gold text-champagne-gold font-semibold'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          Reporte de Ventas
        </button>
        <button
          onClick={() => setActiveReportTab('salesByProduct')}
          className={`pb-3 text-xs lg:text-sm font-medium tracking-wide transition-all border-b-2 cursor-pointer whitespace-nowrap px-2 ${
            activeReportTab === 'salesByProduct'
              ? 'border-champagne-gold text-champagne-gold font-semibold'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          Ventas por Producto
        </button>
        <button
          onClick={() => setActiveReportTab('salesByPaymentMethod')}
          className={`pb-3 text-xs lg:text-sm font-medium tracking-wide transition-all border-b-2 cursor-pointer whitespace-nowrap px-2 ${
            activeReportTab === 'salesByPaymentMethod'
              ? 'border-champagne-gold text-champagne-gold font-semibold'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          Métodos de Pago
        </button>
        <button
          onClick={() => setActiveReportTab('cashShifts')}
          className={`pb-3 text-xs lg:text-sm font-medium tracking-wide transition-all border-b-2 cursor-pointer whitespace-nowrap px-2 ${
            activeReportTab === 'cashShifts'
              ? 'border-champagne-gold text-champagne-gold font-semibold'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          Cortes de Caja
        </button>
        <button
          onClick={() => setActiveReportTab('stock')}
          className={`pb-3 text-xs lg:text-sm font-medium tracking-wide transition-all border-b-2 cursor-pointer whitespace-nowrap px-2 ${
            activeReportTab === 'stock'
              ? 'border-champagne-gold text-champagne-gold font-semibold'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          Inventario
        </button>
        <button
          onClick={() => setActiveReportTab('kardex')}
          className={`pb-3 text-xs lg:text-sm font-medium tracking-wide transition-all border-b-2 cursor-pointer whitespace-nowrap px-2 ${
            activeReportTab === 'kardex'
              ? 'border-champagne-gold text-champagne-gold font-semibold'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          Kardex Visual
        </button>
      </div>

      {error && (
        <div className="bg-error-red/20 border border-error-red text-white p-4 rounded-md text-xs mb-6 flex justify-between items-center">
          <span>{error}</span>
          <button 
            onClick={
              activeReportTab === 'stock'
                ? fetchStockData
                : activeReportTab === 'kardex'
                  ? () => selectedAuditProductId && fetchAuditData(selectedAuditProductId)
                  : fetchReport
            } 
            className="underline font-semibold hover:text-text-secondary cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Main Grid/List View */}
      {activeReportTab === 'sales' ? (
        <div className="flex-1 overflow-y-auto pr-0 lg:pr-2 flex flex-col gap-6">
          {/* KPI Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-onyx-surface border border-aged-bronze/40 rounded-lg p-5 flex flex-col justify-between shadow-xl">
              <span className="text-[10px] text-text-secondary uppercase tracking-widest font-semibold">
                Venta Total Bruta
              </span>
              <span className="text-2xl font-light text-champagne-gold mt-2">
                {formatCurrency(reportData?.totalSales || 0)}
              </span>
              <div className="text-[10px] text-text-secondary mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-success-green inline-block"></span>
                Ingresos cerrados y facturados en rango
              </div>
            </div>

            <div className="bg-onyx-surface border border-aged-bronze/40 rounded-lg p-5 flex flex-col justify-between shadow-xl">
              <span className="text-[10px] text-text-secondary uppercase tracking-widest font-semibold">
                Órdenes Completadas
              </span>
              <span className="text-2xl font-light text-text-primary mt-2">
                {reportData?.totalOrdersCount || 0}
              </span>
              <div className="text-[10px] text-text-secondary mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-champagne-gold inline-block"></span>
                Transacciones cobradas totales
              </div>
            </div>

            <div className="bg-onyx-surface border border-aged-bronze/40 rounded-lg p-5 flex flex-col justify-between shadow-xl">
              <span className="text-[10px] text-text-secondary uppercase tracking-widest font-semibold">
                Ticket Promedio
              </span>
              <span className="text-2xl font-light text-text-primary mt-2">
                {formatCurrency(reportData?.averageTicket || 0)}
              </span>
              <div className="text-[10px] text-text-secondary mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-success-green inline-block"></span>
                Consumo promedio por transacción
              </div>
            </div>
          </div>

          {/* Middle panels: Branch sales and Hourly peaks */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Sales by Branch */}
            <div className="lg:col-span-7 bg-onyx-surface border border-aged-bronze/40 rounded-lg p-5 shadow-xl flex flex-col">
              <span className="text-xs font-semibold text-champagne-gold uppercase tracking-wider mb-4">
                Ventas por Sucursal
              </span>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-charcoal-surface border-b border-aged-bronze/20 text-text-secondary uppercase text-[9px] tracking-wider">
                      <th className="p-3 font-medium">Sucursal</th>
                      <th className="p-3 font-medium text-center">Pedidos</th>
                      <th className="p-3 font-medium text-right">Venta Total</th>
                      <th className="p-3 font-medium">Participación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-aged-bronze/10">
                    {(reportData?.salesByBranch || []).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-text-secondary italic">No hay ventas registradas</td>
                      </tr>
                    ) : (
                      (reportData?.salesByBranch || []).map((branch) => {
                        const share = (reportData?.totalSales || 0) > 0 ? (branch.totalSales / reportData!.totalSales) * 100 : 0;
                        return (
                          <tr key={branch.id} className="hover:bg-charcoal-surface/10">
                            <td className="p-3 font-medium text-text-primary">{branch.name}</td>
                            <td className="p-3 text-center text-text-secondary">{branch.ordersCount}</td>
                            <td className="p-3 text-right font-medium text-champagne-gold">{formatCurrency(branch.totalSales)}</td>
                            <td className="p-3 w-40">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-charcoal-surface h-2 rounded-full overflow-hidden">
                                  <div className="bg-champagne-gold h-full" style={{ width: `${share}%` }}></div>
                                </div>
                                <span className="text-[10px] text-text-secondary font-mono w-8 text-right">{share.toFixed(0)}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Hourly Peaks */}
            <div className="lg:col-span-5 bg-onyx-surface border border-aged-bronze/40 rounded-lg p-5 shadow-xl flex flex-col">
              <span className="text-xs font-semibold text-champagne-gold uppercase tracking-wider mb-4">
                Ventas por Hora (Pico Operativo)
              </span>
              <div className="flex-1 flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                {(reportData?.hourlySales || [])
                  .filter(h => h.totalSales > 0)
                  .sort((a, b) => b.totalSales - a.totalSales)
                  .slice(0, 5)
                  .map((h, idx) => (
                    <div key={h.hour} className="flex items-center justify-between p-2 rounded bg-charcoal-surface/30 border border-aged-bronze/10 text-xs">
                      <span className="text-text-primary font-medium">
                        {idx + 1}. {h.hour}:00 hrs
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-champagne-gold font-mono">{formatCurrency(h.totalSales)}</span>
                        <Badge variant="warning">Pico {idx === 0 ? 'Máximo' : ''}</Badge>
                      </div>
                    </div>
                  ))}
                {(!(reportData?.hourlySales || []).some(h => h.totalSales > 0)) && (
                  <div className="flex-1 flex items-center justify-center text-text-secondary italic text-xs">
                    Sin registros suficientes
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Lower panels: Top products, and Waiters/Cashiers */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
            {/* Top Products */}
            <div className="lg:col-span-7 bg-onyx-surface border border-aged-bronze/40 rounded-lg p-5 shadow-xl flex flex-col">
              <span className="text-xs font-semibold text-champagne-gold uppercase tracking-wider mb-4">
                Productos Estrella: Volumen y Rentabilidad
              </span>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-charcoal-surface border-b border-aged-bronze/20 text-text-secondary uppercase text-[9px] tracking-wider">
                      <th className="p-3 font-medium">Nombre</th>
                      <th className="p-3 font-medium text-center">Unidades</th>
                      <th className="p-3 font-medium text-right">Venta Bruta</th>
                      <th className="p-3 font-medium text-right">Utilidad Neta (Margen)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-aged-bronze/10">
                    {(reportData?.topProducts || []).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-text-secondary italic">No hay productos vendidos</td>
                      </tr>
                    ) : (
                      (reportData?.topProducts || []).slice(0, 6).map((prod) => (
                        <tr key={prod.id} className="hover:bg-charcoal-surface/10">
                          <td className="p-3 font-medium text-text-primary">
                            {prod.name}
                            {prod.sku && <span className="block text-[9px] text-text-secondary font-mono">{prod.sku}</span>}
                          </td>
                          <td className="p-3 text-center text-text-secondary">{prod.quantitySold}</td>
                          <td className="p-3 text-right font-medium text-text-primary">{formatCurrency(prod.totalSales)}</td>
                          <td className="p-3 text-right font-semibold text-champagne-gold">{formatCurrency(prod.profitMargin)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Waiters and Cashiers */}
            <div className="lg:col-span-5 bg-onyx-surface border border-aged-bronze/40 rounded-lg p-5 shadow-xl flex flex-col gap-6">
              {/* Top Waiters */}
              <div>
                <span className="text-xs font-semibold text-champagne-gold uppercase tracking-wider mb-3 block">
                  Meseros que más Venden
                </span>
                <div className="flex flex-col gap-2 max-h-[120px] overflow-y-auto pr-1">
                  {(reportData?.topWaiters || []).length === 0 ? (
                    <span className="text-xs text-text-secondary italic text-center py-2 block">Sin meseros registrados</span>
                  ) : (
                    (reportData?.topWaiters || []).slice(0, 3).map((w, idx) => (
                      <div key={w.id} className="flex items-center justify-between text-xs py-1.5 border-b border-aged-bronze/10">
                        <span className="text-text-primary font-medium">{idx + 1}. {w.name}</span>
                        <div className="flex items-center gap-2">
                           <span className="text-text-secondary">{w.ordersCount} ped.</span>
                           <span className="font-semibold text-champagne-gold font-mono">{formatCurrency(w.totalSales)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Top Cashiers */}
              <div>
                <span className="text-xs font-semibold text-champagne-gold uppercase tracking-wider mb-3 block">
                  Cajeros / Administradores (Operadores)
                </span>
                <div className="flex flex-col gap-2 max-h-[120px] overflow-y-auto pr-1">
                  {(reportData?.topCashiers || []).length === 0 ? (
                    <span className="text-xs text-text-secondary italic text-center py-2 block">Sin operadores registrados</span>
                  ) : (
                    (reportData?.topCashiers || []).slice(0, 3).map((c, idx) => (
                      <div key={c.id} className="flex items-center justify-between text-xs py-1.5 border-b border-aged-bronze/10">
                        <span className="text-text-primary font-medium">{idx + 1}. {c.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-text-secondary">{c.ordersCount} ped.</span>
                          <span className="font-semibold text-champagne-gold font-mono">{formatCurrency(c.totalSales)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Business Intelligence Advisory Panel */}
          <div className="bg-charcoal-surface/40 border border-champagne-gold/30 rounded-lg p-5 mb-6 shadow-xl flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-base">💡</span>
              <h4 className="text-sm font-semibold text-champagne-gold uppercase tracking-wider">
                Sugerencias de Inteligencia para Maximizar Ganancias
              </h4>
            </div>
            <ul className="list-disc pl-5 text-xs text-text-secondary flex flex-col gap-2.5 leading-relaxed">
              {topProfitProducts.length > 0 && (
                <li>
                  <strong>Foco en Margen Neto</strong>: El producto <span className="text-champagne-gold font-semibold">{topProfitProducts[0].name}</span> genera la mayor utilidad neta (<span className="text-text-primary font-medium font-mono">{formatCurrency(topProfitProducts[0].profitMargin)}</span>) en este período. Promover ventas cruzadas de este artículo incrementará drásticamente la utilidad final.
                </li>
              )}
              {reportData && reportData.averageTicket < 150 && (
                <li>
                  <strong>Incrementar Ticket Promedio</strong>: Tu ticket promedio es de <span className="text-text-primary font-medium font-mono">{formatCurrency(reportData.averageTicket)}</span>. Considera crear combos (ej. bebida + alimento) u ofrecer productos adicionales de bajo costo para elevar el consumo medio.
                </li>
              )}
              {(reportData?.hourlySales || []).some(h => h.totalSales > 0) && (
                <li>
                  <strong>Eficiencia de Producción</strong>: Revisa tus picos de venta horaria. Pre-elabora o ensambla lotes de productos terminados (recetas) 30 minutos antes de la hora pico más alta para reducir tiempos de espera de los clientes y evitar cuellos de botella en la cocina.
                </li>
              )}
            </ul>
          </div>
        </div>
      ) : activeReportTab === 'salesByProduct' ? (
        renderSalesByProductTab()
      ) : activeReportTab === 'salesByPaymentMethod' ? (
        renderSalesByPaymentMethodTab()
      ) : activeReportTab === 'cashShifts' ? (
        renderCashShiftsTab()
      ) : activeReportTab === 'stock' ? (
        /* Stock Existence Report Tab */
        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          <div className="bg-onyx-surface border border-aged-bronze/40 rounded-lg p-5 shadow-xl flex-1 flex flex-col min-h-0">
            <span className="text-xs font-semibold text-champagne-gold uppercase tracking-wider mb-4 flex justify-between items-center">
              <span>Listado de Existencias en Almacén</span>
              <span className="text-xs font-normal text-text-secondary lowercase font-sans">
                Mostrando {filteredStockLevels.length} registros
              </span>
            </span>
            
            <div className="flex-1 overflow-y-auto pr-1">
              <table className="w-full text-left border-collapse text-xs select-text font-sans">
                <thead>
                  <tr className="bg-charcoal-surface border-b border-aged-bronze/20 text-text-secondary uppercase text-[9px] tracking-wider sticky top-0 z-10">
                    <th className="p-3 font-medium">Producto</th>
                    <th className="p-3 font-medium">Categoría</th>
                    <th className="p-3 font-medium">Ubicación</th>
                    <th className="p-3 font-medium">Tipo</th>
                    <th className="p-3 font-medium text-right">Existencia</th>
                    <th className="p-3 font-medium text-center">Estado</th>
                    <th className="p-3 font-medium text-right">Último Movimiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-aged-bronze/10">
                  {filteredStockLevels.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-text-secondary italic">
                        No se encontraron existencias en el inventario con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredStockLevels.map((level) => {
                      const product = products.find(p => p.id === level.productId);
                      const catName = product ? (categories.find(c => c.id === product.categoryId)?.name || 'Sin Categoría') : 'Cargando...';
                      
                      // Location Name resolution
                      let locationName = '-';
                      if (level.warehouseId) {
                        locationName = `Bodega: ${warehouses.find(w => w.id === level.warehouseId)?.name || 'Central'}`;
                      } else if (level.branchId) {
                        locationName = `Sucursal: ${branches.find(b => b.id === level.branchId)?.name || 'Punto de Venta'}`;
                      }

                      // Check for low stock warning
                      const qty = parseFloat(level.quantity);
                      const minStock = product ? parseFloat(product.minStock || '0') : 0;
                      const isLowStock = product && minStock > 0 && qty < minStock;

                      return (
                        <tr key={level.id} className="hover:bg-charcoal-surface/10">
                          <td className="p-3 font-medium text-text-primary">{level.productName}</td>
                          <td className="p-3 text-text-secondary">
                            <Badge variant="charcoal">{catName}</Badge>
                          </td>
                          <td className="p-3 text-text-secondary">{locationName}</td>
                          <td className="p-3">
                            {level.isIngredient ? (
                              <Badge variant="warning">Insumo</Badge>
                            ) : (
                              <Badge variant="success">Venta</Badge>
                            )}
                          </td>
                          <td className="p-3 text-right font-mono font-medium">
                            <span className={isLowStock ? 'text-error-red font-bold animate-pulse' : 'text-text-primary'}>
                              {qty.toFixed(level.isIngredient ? 3 : 0)}
                            </span>
                            {isLowStock && (
                              <span className="text-[9px] text-error-red block font-sans font-normal">
                                mín: {minStock}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {level.isActive === false ? (
                              <Badge variant="error" className="bg-red-500/10 text-error-red border border-error-red/20">Deprecado</Badge>
                            ) : (
                              <Badge variant="success">Activo</Badge>
                            )}
                          </td>
                          <td className="p-3 text-right text-text-secondary font-mono">
                            {level.updatedAt ? new Date(level.updatedAt).toLocaleString() : '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Kardex & Auditoria Tab */
        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          <div className="bg-onyx-surface border border-aged-bronze/40 rounded-lg p-5 shadow-xl flex-1 flex flex-col min-h-0">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-4 border-b border-aged-bronze/10 pb-4">
              <div className="flex flex-col gap-1 w-full md:w-96 select-text">
                <span className="text-xs font-semibold text-champagne-gold uppercase tracking-wider">
                  Seleccione Producto / Insumo para Auditar
                </span>
                <Autocomplete
                  options={products.map((p) => ({
                    id: p.id,
                    label: p.name,
                    sublabel: `${p.internalCode ? `Código: ${p.internalCode}` : p.sku ? `SKU: ${p.sku}` : ''} - Costo: $${p.cost || '0.00'}`,
                  }))}
                  value={selectedAuditProductId}
                  onChange={setSelectedAuditProductId}
                  placeholder="Buscar producto o insumo..."
                />
              </div>

              {selectedAuditProduct && (
                <div className="flex flex-wrap gap-2 text-xs select-none">
                  <Badge variant="charcoal">
                    Categoría: {categories.find(c => c.id === selectedAuditProduct.categoryId)?.name || 'Sin Categoría'}
                  </Badge>
                  {selectedAuditProduct.isIngredient ? (
                    <Badge variant="warning">Insumo</Badge>
                  ) : (
                    <Badge variant="success">Venta</Badge>
                  )}
                </div>
              )}
            </div>

            {/* If loading or no product selected */}
            {isAuditLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <svg className="animate-spin h-8 w-8 text-champagne-gold" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-xs text-text-secondary">Generando reporte de auditoría y movimientos...</span>
              </div>
            ) : !selectedAuditProductId ? (
              <div className="flex-1 flex items-center justify-center text-text-secondary italic text-xs">
                Seleccione un producto para ver el desglose por sucursales y Kardex
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-1 min-h-0 select-text">
                {/* 1. Consistency / Integrity Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-charcoal-surface/30 border border-aged-bronze/10 rounded-lg flex flex-col gap-1">
                    <span className="text-[10px] text-text-secondary uppercase">Stock Consolidado (Catálogo)</span>
                    <span className="text-xl font-bold font-mono text-champagne-gold">
                      {catalogStock.toFixed(selectedAuditProduct?.isIngredient ? 3 : 0)}
                    </span>
                  </div>

                  <div className="p-4 bg-charcoal-surface/30 border border-aged-bronze/10 rounded-lg flex flex-col gap-1">
                    <span className="text-[10px] text-text-secondary uppercase">Suma de Existencias Física</span>
                    <span className="text-xl font-bold font-mono text-text-primary">
                      {sumOfLocations.toFixed(selectedAuditProduct?.isIngredient ? 3 : 0)}
                    </span>
                  </div>

                  <div className={`p-4 border rounded-lg flex flex-col justify-center gap-1 ${
                    isConsistent
                      ? 'border-success-green/20 bg-success-green/5 text-success-green'
                      : 'border-warning-yellow/20 bg-warning-yellow/5 text-warning-yellow'
                  }`}>
                    <span className="text-[10px] uppercase opacity-75">Estado de Integridad</span>
                    <span className="text-sm font-bold flex items-center gap-1.5">
                      {isConsistent ? (
                        <>✓ Existencias Cuadradas</>
                      ) : (
                        <>⚠ Discrepancia Detectada</>
                      )}
                    </span>
                  </div>
                </div>

                {/* 2. Branch breakdown visual display */}
                <div className="flex flex-col gap-3">
                  <span className="text-xs font-semibold text-champagne-gold uppercase tracking-wider">
                    Desglose de existencias por Ubicación (Sucursales y Bodegas)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {auditLocations.length === 0 ? (
                      <span className="text-xs text-text-secondary italic">No se encontraron existencias físicas registradas para este producto.</span>
                    ) : (
                      auditLocations.map((loc, i) => {
                        const maxVal = sumOfLocations > 0 ? sumOfLocations : 1;
                        const pct = Math.min(100, Math.max(0, (loc.quantity / maxVal) * 100));
                        return (
                          <div key={i} className="p-3 bg-charcoal-surface border border-aged-bronze/15 rounded flex flex-col gap-2 shadow">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-text-primary font-medium">{loc.warehouseName || loc.branchName || 'Ubicación'}</span>
                              <span className="font-bold font-mono text-champagne-gold">
                                {loc.quantity.toFixed(selectedAuditProduct?.isIngredient ? 3 : 0)}
                              </span>
                            </div>
                            <div className="w-full bg-onyx-surface rounded-full h-1.5 overflow-hidden">
                              <div 
                                className="bg-champagne-gold h-full rounded-full transition-all duration-500" 
                                style={{ width: `${pct}%` }} 
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* 3. Movements Ledger (Kardex) */}
                <div className="flex flex-col gap-3 flex-1 min-h-[300px]">
                  <span className="text-xs font-semibold text-champagne-gold uppercase tracking-wider">
                    Libro Diario de Movimientos (Kardex Histórico)
                  </span>
                  <div className="overflow-x-auto border border-aged-bronze/10 rounded flex-1">
                    <table className="w-full text-left border-collapse text-xs select-text">
                      <thead>
                        <tr className="border-b border-aged-bronze/20 bg-charcoal-surface text-[10px] font-semibold text-text-secondary uppercase sticky top-0 z-10">
                          <th className="py-2.5 px-3">Fecha y Hora</th>
                          <th className="py-2.5 px-3">Ubicación</th>
                          <th className="py-2.5 px-3">Tipo Movimiento</th>
                          <th className="py-2.5 px-3 text-right">Variación</th>
                          <th className="py-2.5 px-3 text-right">Saldo Ant.</th>
                          <th className="py-2.5 px-3 text-right">Saldo Post.</th>
                          <th className="py-2.5 px-3">Usuario</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-aged-bronze/5 text-[11px] font-sans">
                        {auditMovements.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-text-secondary italic">
                              No hay movimientos históricos registrados en el Kardex para el rango de fechas seleccionado.
                            </td>
                          </tr>
                        ) : (
                          auditMovements.map((m) => {
                            const isPositive = m.quantity > 0;
                            const isInternal = m.type === 'transfer_out' || m.type === 'transfer_in';
                            
                            let typeLabel = m.type;
                            if (m.type === 'receipt') typeLabel = 'Compra Prov';
                            else if (m.type === 'sale') typeLabel = 'Venta POS';
                            else if (m.type === 'production_input') typeLabel = 'Consumo Ensamble';
                            else if (m.type === 'production_output') typeLabel = 'Entrada Ensamble';
                            else if (m.type === 'transfer_out') typeLabel = 'Traspaso Env';
                            else if (m.type === 'transfer_in') typeLabel = 'Traspaso Rec';
                            else if (m.type === 'adjustment') typeLabel = 'Ajuste Manual';
                            else if (m.type === 'initial') typeLabel = 'Inventario Inicial';

                            return (
                              <tr key={m.id} className="hover:bg-charcoal-surface/10 transition-colors">
                                <td className="py-2 px-3 font-mono text-text-secondary whitespace-nowrap">
                                  {new Date(m.createdAt).toLocaleString('es-MX', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </td>
                                <td className="py-2 px-3 text-text-primary whitespace-nowrap">
                                  {m.warehouseName || m.branchName || 'N/A'}
                                </td>
                                <td className="py-2 px-3 font-medium">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider ${
                                    isInternal 
                                      ? 'bg-warning-yellow/10 text-warning-yellow border border-warning-yellow/20'
                                      : isPositive 
                                        ? 'bg-success-green/10 text-success-green border border-success-green/20'
                                        : 'bg-error-red/10 text-error-red border border-error-red/20'
                                  }`}>
                                    {typeLabel}
                                  </span>
                                </td>
                                <td className={`py-2 px-3 text-right font-mono font-bold ${
                                  isInternal 
                                    ? 'text-warning-yellow' 
                                    : isPositive 
                                      ? 'text-success-green' 
                                      : 'text-error-red'
                                }`}>
                                  {isPositive ? '+' : ''}{m.quantity.toFixed(selectedAuditProduct?.isIngredient ? 3 : 0)}
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-text-secondary">
                                  {m.previousBalance.toFixed(selectedAuditProduct?.isIngredient ? 3 : 0)}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-semibold text-text-primary">
                                  {m.finalBalance.toFixed(selectedAuditProduct?.isIngredient ? 3 : 0)}
                                </td>
                                <td className="py-2 px-3 text-text-secondary truncate max-w-[120px]" title={m.createdByName}>
                                  {m.createdByName || 'Sistema'}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
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
