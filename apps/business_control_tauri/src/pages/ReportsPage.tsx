import React, { useState, useEffect } from 'react';
import { api, SalesDashboardReport } from '../services/api';
import { Heading } from '../components/atoms/Heading';
import { Badge } from '../components/atoms/Badge';

interface ReportsPageProps {
  businessId: string;
}

type DateRangeType = 'today' | 'week' | 'month' | 'last30' | 'custom';

export const ReportsPage: React.FC<ReportsPageProps> = ({ businessId }) => {
  const [reportData, setReportData] = useState<SalesDashboardReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Date range state
  const [dateRange, setDateRange] = useState<DateRangeType>('month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

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

      const data = await api.getSalesDashboardReport(businessId, startISO, endISO);
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
  }, [businessId, startDate, endDate]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
  };

  if (isLoading && !reportData) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-obsidian text-text-secondary select-none">
        <svg className="animate-spin h-8 w-8 text-champagne-gold" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-xs uppercase tracking-widest">Generando Métricas de Negocio...</span>
      </div>
    );
  }

  // Calculate top profit margins
  const topProfitProducts = reportData?.topProducts
    ? [...reportData.topProducts].sort((a, b) => b.profitMargin - a.profitMargin)
    : [];

  return (
    <div className="w-full lg:h-full min-h-full bg-obsidian p-2 lg:p-6 font-sans overflow-y-auto lg:overflow-hidden flex flex-col">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-aged-bronze/30 pb-4 mb-6">
        <div>
          <Heading level={2} className="!border-none !pb-0 text-champagne-gold font-light">
            Reportes e Inteligencia de Ventas
          </Heading>
          <p className="text-xs text-text-secondary mt-1">
            Análisis de ingresos, rentabilidad de productos, sucursales y desempeño del personal.
          </p>
        </div>

        {/* Filters bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-charcoal border border-aged-bronze/45 rounded p-0.5">
            {(['today', 'week', 'month', 'last30', 'custom'] as DateRangeType[]).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 rounded text-[10px] uppercase font-semibold tracking-wider transition-all duration-200 ${
                  dateRange === range
                    ? 'bg-charcoal-surface text-champagne-gold shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {range === 'today' ? 'Hoy' : range === 'week' ? 'Semana' : range === 'month' ? 'Mes' : range === 'last30' ? '30 Días' : 'Fijo'}
              </button>
            ))}
          </div>

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
                onClick={fetchReport}
                className="bg-charcoal-surface border border-aged-bronze/45 hover:border-champagne-gold hover:text-champagne-gold text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded transition-all"
              >
                Filtrar
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-error-red/20 border border-error-red text-white p-4 rounded-md text-xs mb-6 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={fetchReport} className="underline font-semibold hover:text-text-secondary">Reintentar</button>
        </div>
      )}

      {/* Main Grid View */}
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
                  {reportData?.salesByBranch.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-text-secondary italic">No hay ventas registradas</td>
                    </tr>
                  ) : (
                    reportData?.salesByBranch.map((branch) => {
                      const share = reportData.totalSales > 0 ? (branch.totalSales / reportData.totalSales) * 100 : 0;
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
              {reportData?.hourlySales
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
              {(!reportData?.hourlySales.some(h => h.totalSales > 0)) && (
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
                  {reportData?.topProducts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-text-secondary italic">No hay productos vendidos</td>
                    </tr>
                  ) : (
                    reportData?.topProducts.slice(0, 6).map((prod) => (
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
                {reportData?.topWaiters.length === 0 ? (
                  <span className="text-xs text-text-secondary italic text-center py-2 block">Sin meseros registrados</span>
                ) : (
                  reportData?.topWaiters.slice(0, 3).map((w, idx) => (
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
                {reportData?.topCashiers.length === 0 ? (
                  <span className="text-xs text-text-secondary italic text-center py-2 block">Sin operadores registrados</span>
                ) : (
                  reportData?.topCashiers.slice(0, 3).map((c, idx) => (
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
            {reportData?.hourlySales.some(h => h.totalSales > 0) && (
              <li>
                <strong>Eficiencia de Producción</strong>: Revisa tus picos de venta horaria. Pre-elabora o ensambla lotes de productos terminados (recetas) 30 minutos antes de la hora pico más alta para reducir tiempos de espera de los clientes y evitar cuellos de botella en la cocina.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};
