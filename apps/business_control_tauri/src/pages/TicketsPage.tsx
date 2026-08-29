import React, { useState, useEffect, useMemo } from 'react';
import { api, TicketsTodayReport, TicketEntry, TicketItem } from '../services/api';
import { Heading } from '../components/atoms/Heading';
import { Badge } from '../components/atoms/Badge';
import { Autocomplete } from '../components/molecules/Autocomplete';

interface TicketsPageProps {
  businessId: string;
}

const GUEST_LABELS: Record<number, string> = {
  1: 'Persona 1', 2: 'Persona 2', 3: 'Persona 3', 4: 'Persona 4',
  5: 'Persona 5', 6: 'Persona 6', 7: 'Persona 7', 8: 'Persona 8',
  9: 'Persona 9', 10: 'Persona 10', 11: 'Persona 11', 12: 'Persona 12',
};

const guestLabel = (guest: number) => GUEST_LABELS[guest] || `Invitado ${guest}`;

export const TicketsPage: React.FC<TicketsPageProps> = ({ businessId }) => {
  const [report, setReport] = useState<TicketsTodayReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [expandedTickets, setExpandedTickets] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.getBranches(businessId).then(setBranches).catch(() => {});
  }, [businessId]);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    const branchParam = selectedBranchId !== 'all' ? selectedBranchId : undefined;
    api.getTicketsToday(businessId, branchParam)
      .then((data) => {
        setReport(data);
        setExpandedTickets(new Set());
      })
      .catch((err) => setError(err.message || 'Error al cargar tickets'))
      .finally(() => setIsLoading(false));
  }, [businessId, selectedBranchId]);

  const branchOptions = useMemo(() => {
    const opts = [{ id: 'all', label: 'Todas las sucursales' }];
    for (const b of branches) {
      opts.push({ id: b.id, label: b.name });
    }
    return opts;
  }, [branches]);

  const toggleExpand = (id: string) => {
    setExpandedTickets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-MX', {
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City',
    });

  const paymentBadge = (method: string) => {
    const color = method === 'cash' ? 'bg-green-600/20 text-green-400' : 'bg-blue-600/20 text-blue-400';
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>{method.toUpperCase()}</span>;
  };

  const summary = useMemo(() => {
    if (!report?.tickets.length) return null;
    const realTickets = report.tickets.filter((t) => t.total > 0);
    const totalSales = realTickets.reduce((s, t) => s + t.totalPaid, 0);
    const cashSales = report.tickets.reduce(
      (s, t) => s + t.payments.filter((p) => p.method === 'cash').reduce((a, p) => a + p.amount, 0), 0,
    );
    const cardSales = report.tickets.reduce(
      (s, t) => s + t.payments.filter((p) => p.method === 'card').reduce((a, p) => a + p.amount, 0), 0,
    );
    const withDiscrepancy = realTickets.filter((t) => Math.abs(t.total - t.totalPaid) > 0.01);
    return {
      totalSales, cashSales, cardSales,
      totalTickets: realTickets.length,
      withDiscrepancy: withDiscrepancy.length,
    };
  }, [report]);

  const ticketsByTable = useMemo(() => {
    if (!report?.tickets.length) return [];
    const map = new Map<string, TicketEntry[]>();
    for (const t of report.tickets) {
      const key = t.tableLabel;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [report]);

  // Group items by guest for a single ticket
  const groupItemsByGuest = (items: TicketItem[]) => {
    const map = new Map<number, TicketItem[]>();
    for (const item of items) {
      const guest = item.assignedGuest ?? 0;
      if (!map.has(guest)) map.set(guest, []);
      map.get(guest)!.push(item);
    }
    // Sort: unassigned (0) first, then by guest number
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  };

  // --- Render ---
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Heading level={1}>Tickets del Día</Heading>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-2 border-champagne-gold border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Heading level={1}>Tickets del Día</Heading>
        <div className="bg-error-red/10 border border-error-red/30 rounded p-6 text-center">
          <p className="text-error-red font-medium">{error}</p>
          <button
            onClick={() => {
              setIsLoading(true);
              setError(null);
              const branchParam = selectedBranchId !== 'all' ? selectedBranchId : undefined;
              api.getTicketsToday(businessId, branchParam)
                .then(setReport).catch((err) => setError(err.message))
                .finally(() => setIsLoading(false));
            }}
            className="mt-3 px-4 py-2 bg-charcoal-surface border border-aged-bronze/30 rounded text-text-primary text-sm hover:bg-charcoal-surface/70 cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 max-w-screen-xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Heading level={1}>Tickets del Día</Heading>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-secondary">Sucursal:</span>
          <Autocomplete value={selectedBranchId} onChange={setSelectedBranchId} options={branchOptions} placeholder="Filtrar sucursal…" className="w-56" />
        </div>
      </div>

      {report && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-charcoal-surface border border-aged-bronze/20 rounded-lg p-4">
              <p className="text-[10px] text-text-secondary uppercase tracking-widest">Total Vendido</p>
              <p className="text-xl font-bold text-champagne-gold mt-1">${summary?.totalSales.toFixed(2)}</p>
            </div>
            <div className="bg-charcoal-surface border border-aged-bronze/20 rounded-lg p-4">
              <p className="text-[10px] text-text-secondary uppercase tracking-widest">Efectivo</p>
              <p className="text-xl font-bold text-green-400 mt-1">${summary?.cashSales.toFixed(2)}</p>
            </div>
            <div className="bg-charcoal-surface border border-aged-bronze/20 rounded-lg p-4">
              <p className="text-[10px] text-text-secondary uppercase tracking-widest">Tarjeta</p>
              <p className="text-xl font-bold text-blue-400 mt-1">${summary?.cardSales.toFixed(2)}</p>
            </div>
            <div className="bg-charcoal-surface border border-aged-bronze/20 rounded-lg p-4">
              <p className="text-[10px] text-text-secondary uppercase tracking-widest">Tickets</p>
              <p className="text-xl font-bold text-text-primary mt-1">{summary?.totalTickets}</p>
            </div>
            <div className={`bg-charcoal-surface border rounded-lg p-4 ${summary?.withDiscrepancy ? 'border-amber-500/30' : 'border-aged-bronze/20'}`}>
              <p className="text-[10px] text-text-secondary uppercase tracking-widest">Con Discrepancia</p>
              <p className={`text-xl font-bold mt-1 ${summary?.withDiscrepancy ? 'text-amber-400' : 'text-text-primary'}`}>{summary?.withDiscrepancy}</p>
            </div>
          </div>

          <div className="text-xs text-text-secondary">
            Fecha: {report.date} &nbsp;|&nbsp; Sucursal: {report.branchName || 'Todas'} &nbsp;|&nbsp;
            {report.tickets.filter((t) => t.total > 0).length} tickets reales
            {report.tickets.filter((t) => t.total === 0).length > 0 && (
              <span className="text-text-secondary/50"> + {report.tickets.filter((t) => t.total === 0).length} splits</span>
            )}
          </div>

          {ticketsByTable.map(([tableLabel, tickets]) => {
            const tableReal = tickets.filter((t) => t.total > 0);
            if (tableReal.length === 0) return null;
            const tableTotal = tableReal.reduce((s, t) => s + t.totalPaid, 0);
            return (
              <div key={tableLabel} className="bg-charcoal-surface border border-aged-bronze/20 rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-aged-bronze/10 border-b border-aged-bronze/20 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-champagne-gold">{tableLabel}</span>
                    <Badge>{tableReal.length} ticket(s)</Badge>
                  </div>
                  <span className="text-sm font-mono text-text-primary">${tableTotal.toFixed(2)}</span>
                </div>
                <div className="divide-y divide-aged-bronze/10">
                  {tickets.map((ticket) => {
                    const isExpanded = expandedTickets.has(ticket.id);
                    const isSplit = ticket.total === 0;
                    const hasDiscrepancy = ticket.total > 0 && Math.abs(ticket.total - ticket.totalPaid) > 0.01;
                    const hasMultiplePayments = ticket.payments.length > 1;
                    const guestGroups = groupItemsByGuest(ticket.items);
                    const hasGuests = ticket.items.some((i) => (i.assignedGuest ?? 0) > 0);

                    return (
                      <div key={ticket.id}>
                        <button
                          onClick={() => toggleExpand(ticket.id)}
                          className="w-full px-4 py-3 flex items-center justify-between hover:bg-aged-bronze/5 transition-colors text-left cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <svg className={`w-4 h-4 text-text-secondary transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <span className={`text-xs font-mono ${isSplit ? 'text-text-secondary/50' : 'text-text-primary'}`}>
                              {formatTime(ticket.createdAt)}
                            </span>
                            <span className={`text-sm ${isSplit ? 'text-text-secondary/50 line-through' : 'text-text-primary'}`}>
                              {isSplit ? 'Split (sin monto)' : ticket.waiterName}
                            </span>
                            {hasDiscrepancy && <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded text-[10px] font-bold">!</span>}
                            {hasMultiplePayments && !isSplit && <span className="px-1.5 py-0.5 bg-purple-500/10 text-purple-400 rounded text-[10px]">DIV</span>}
                            {hasGuests && !isSplit && <span className="px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 rounded text-[10px]">POR PERSONA</span>}
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            {ticket.payments.map((p, pi) => (
                              <React.Fragment key={pi}>{paymentBadge(p.method)}</React.Fragment>
                            ))}
                            <span className={`text-sm font-mono font-bold ${isSplit ? 'text-text-secondary/50' : 'text-text-primary'}`}>
                              ${isSplit ? '0.00' : ticket.total.toFixed(2)}
                            </span>
                          </div>
                        </button>

                        {isExpanded && !isSplit && (
                          <div className="px-4 py-3 bg-obsidian/50 border-t border-aged-bronze/10">
                            {/* Payment Summary Header */}
                            <div className="mb-4 flex flex-wrap gap-2 items-center">
                              <span className="text-[10px] text-text-secondary uppercase tracking-wider">Pagos:</span>
                              {ticket.payments.map((p, pi) => (
                                <span key={pi} className="inline-flex items-center gap-1 px-2 py-0.5 bg-charcoal-surface rounded text-xs">
                                  {paymentBadge(p.method)}
                                  <span className="font-mono">${p.amount.toFixed(2)}</span>
                                  {p.reference && <span className="text-text-secondary/70 text-[10px]">({p.reference})</span>}
                                </span>
                              ))}
                              {hasDiscrepancy && (
                                <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded text-xs font-bold">
                                  ⚠ Falta ${(ticket.total - ticket.totalPaid).toFixed(2)}
                                </span>
                              )}
                            </div>

                            {/* Products Section — group by Comensal if applicable */}
                            <div className="mb-4">
                              <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-2">
                                Productos ({ticket.items.reduce((s, i) => s + i.quantity, 0)} artículos)
                              </p>
                              {hasGuests ? (
                                // Grouped by guest (por comensal)
                                <div className="space-y-3">
                                  {guestGroups.map(([guest, items]) => (
                                    <div key={guest} className="pl-2 border-l-2 border-aged-bronze/20">
                                      <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">
                                        {guest === 0 ? 'Sin asignar' : guestLabel(guest)}
                                        <span className="font-normal ml-1">({items.reduce((s, i) => s + i.quantity, 0)} art.)</span>
                                      </p>
                                      <table className="w-full text-xs">
                                        <tbody>
                                          {items.map((item, ii) => (
                                            <tr key={ii} className="border-b border-aged-bronze/5">
                                              <td className="py-1 text-text-secondary w-8">{item.quantity}x</td>
                                              <td className="py-1 text-text-primary">
                                                {item.productName}
                                                {item.notes && <span className="text-text-secondary/70 text-[10px] ml-1">— {item.notes}</span>}
                                              </td>
                                              <td className="py-1 text-right font-mono text-text-primary w-20">${item.price.toFixed(2)}</td>
                                              <td className="py-1 text-right font-mono text-text-secondary w-20">= ${(item.quantity * item.price).toFixed(2)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                // Simple product list
                                <table className="w-full text-xs">
                                  <tbody>
                                    {ticket.items.map((item, ii) => (
                                      <tr key={ii} className="border-b border-aged-bronze/5">
                                        <td className="py-1 text-text-secondary w-8">{item.quantity}x</td>
                                        <td className="py-1 text-text-primary">
                                          {item.productName}
                                          {item.notes && <span className="text-text-secondary/70 text-[10px] ml-1">— {item.notes}</span>}
                                        </td>
                                        <td className="py-1 text-right font-mono text-text-primary w-20">${item.price.toFixed(2)}</td>
                                        <td className="py-1 text-right font-mono text-text-secondary w-20">= ${(item.quantity * item.price).toFixed(2)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>

                            {/* Financial Breakdown */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-aged-bronze/10 pt-3">
                              {/* Left: totals */}
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between"><span className="text-text-secondary">Subtotal</span><span className="font-mono">${ticket.subtotal.toFixed(2)}</span></div>
                                {ticket.discount > 0 && <div className="flex justify-between"><span className="text-text-secondary">Descuento</span><span className="font-mono text-amber-400">-${ticket.discount.toFixed(2)}</span></div>}
                                <div className="flex justify-between"><span className="text-text-secondary">IVA (16%)</span><span className="font-mono">${ticket.tax.toFixed(2)}</span></div>
                                <div className="flex justify-between font-bold border-t border-aged-bronze/10 pt-1 mt-1">
                                  <span className="text-text-secondary">Total</span><span className="font-mono text-champagne-gold">${ticket.total.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between font-bold">
                                  <span className="text-text-secondary">Cobrado</span>
                                  <span className={`font-mono ${hasDiscrepancy ? 'text-amber-400' : 'text-green-400'}`}>${ticket.totalPaid.toFixed(2)}</span>
                                </div>
                              </div>
                              {/* Right: per-payment detail (equal split) */}
                              {hasMultiplePayments && (
                                <div>
                                  <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-2">División de Pagos</p>
                                  <div className="space-y-1 text-xs">
                                    {ticket.payments.map((p, pi) => (
                                      <div key={pi} className="flex items-center justify-between bg-charcoal-surface/50 rounded px-2 py-1">
                                        <div className="flex items-center gap-2">
                                          {paymentBadge(p.method)}
                                          <span className="text-text-secondary text-[10px]">{p.reference || ''}</span>
                                        </div>
                                        <span className="font-mono font-bold">${p.amount.toFixed(2)}</span>
                                      </div>
                                    ))}
                                  </div>
                                  <p className="text-[10px] text-text-secondary/70 mt-2">
                                    {ticket.items.reduce((s, i) => s + i.quantity, 0)} productos — divididos en {ticket.payments.length} {ticket.payments.length > 1 ? 'pagos' : 'pago'}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {report.tickets.length === 0 && (
            <div className="text-center py-16 text-text-secondary">
              <p className="text-lg">No hay tickets cobrados hoy</p>
              <p className="text-xs mt-1">Los tickets aparecerán aquí conforme se vayan cerrando</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
