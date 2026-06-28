import React, { useEffect, useState } from 'react';
import { api, Inquiry } from '../services/api';
import { Badge } from '../components/atoms/Badge';
import { Button } from '../components/atoms/Button';
import { Heading } from '../components/atoms/Heading';

export const InquiriesPage: React.FC = () => {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'resolved'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch inquiries from backend
  const fetchInquiries = async () => {
    setLoading(true);
    setError(null);
    try {
      // If 'all', pass undefined, otherwise pass the specific status
      const statusParam = statusFilter === 'all' ? undefined : statusFilter;
      const data = await api.getInquiries(statusParam);
      setInquiries(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'No se pudieron cargar las consultas. Verifique la conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInquiries();
  }, [statusFilter]);

  // Handle status update
  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const updated = await api.updateInquiryStatus(id, newStatus);
      
      // Update local state
      setInquiries((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
      );
      
      // If modal is open, update selected inquiry in modal too
      if (selectedInquiry && selectedInquiry.id === id) {
        setSelectedInquiry(updated);
      }
    } catch (err: any) {
      alert(`Error al actualizar el estado: ${err.message}`);
    }
  };

  // Filter inquiries in memory for search term
  const filteredInquiries = inquiries.filter((inquiry) => {
    const term = searchTerm.toLowerCase();
    return (
      inquiry.name.toLowerCase().includes(term) ||
      inquiry.email.toLowerCase().includes(term) ||
      inquiry.subject.toLowerCase().includes(term) ||
      inquiry.message.toLowerCase().includes(term)
    );
  });

  const getInquiryTypeLabel = (type: string) => {
    switch (type) {
      case 'quejas_sugerencias':
        return 'Quejas y Sugerencias';
      case 'ventas':
        return 'Ventas / Presupuesto';
      case 'general':
      default:
        return 'General / Consulta';
    }
  };

  const getInquiryTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'quejas_sugerencias':
        return 'gold';
      case 'ventas':
        return 'bronze';
      default:
        return 'charcoal';
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-col h-full gap-6 animate-fade-in text-text-primary">
      {/* Header section */}
      <div className="flex items-center justify-between border-b border-aged-bronze/20 pb-4">
        <div>
          <Heading level={2} className="!border-none !pb-0 font-sans tracking-wide">
            Consultas Web de Clientes
          </Heading>
          <p className="text-xs text-text-secondary mt-1">
            Mensajes enviados desde el formulario de contacto de cacharelo.com
          </p>
        </div>
        
        <Button variant="secondary" onClick={fetchInquiries} className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 3v2m-2.837 5.828l-2.83-2.829m0 0l-3.07 3.07M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Recargar</span>
        </Button>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-onyx-surface p-4 rounded-lg border border-aged-bronze/20">
        {/* Tab Filters */}
        <div className="flex bg-obsidian p-1 rounded border border-aged-bronze/10">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
              statusFilter === 'all'
                ? 'bg-charcoal-surface text-champagne-gold shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Todas ({inquiries.length})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
              statusFilter === 'pending'
                ? 'bg-charcoal-surface text-champagne-gold shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Pendientes ({inquiries.filter(i => i.status === 'pending').length})
          </button>
          <button
            onClick={() => setStatusFilter('resolved')}
            className={`px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
              statusFilter === 'resolved'
                ? 'bg-charcoal-surface text-champagne-gold shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Resueltas ({inquiries.filter(i => i.status === 'resolved').length})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 md:max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-text-secondary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Buscar por cliente, asunto, mensaje..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-obsidian text-text-primary pl-9 pr-4 py-2 rounded border border-aged-bronze/20 focus:outline-none focus:border-champagne-gold/60 text-sm font-sans transition-colors"
          />
        </div>
      </div>

      {/* Main content table / status messages */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 gap-4">
          <svg className="animate-spin h-8 w-8 text-champagne-gold" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-xs tracking-widest text-text-secondary uppercase">
            Cargando consultas de la base de datos...
          </span>
        </div>
      ) : error ? (
        <div className="bg-error-red/10 border border-error-red/30 rounded-lg p-6 flex flex-col items-center text-center gap-4 my-8">
          <svg className="w-12 h-12 text-error-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h4 className="text-text-primary font-semibold text-lg">Error de Carga</h4>
            <p className="text-text-secondary text-sm mt-1 max-w-lg">{error}</p>
          </div>
          <Button variant="secondary" onClick={fetchInquiries}>
            Reintentar Conexión
          </Button>
        </div>
      ) : filteredInquiries.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center border border-dashed border-aged-bronze/20 rounded-lg bg-onyx-surface/20">
          <svg className="w-12 h-12 text-text-secondary/50 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-sm font-medium text-text-secondary">
            No se encontraron consultas.
          </span>
          <p className="text-xs text-text-secondary/60 mt-1">
            Intente cambiar los filtros o realizar otra búsqueda.
          </p>
        </div>
      ) : (
        /* Inquiries Grid/Table */
        <div className="overflow-x-auto border border-aged-bronze/20 rounded-lg bg-onyx-surface">
          <table className="w-full text-left border-collapse font-sans text-sm">
            <thead>
              <tr className="border-b border-aged-bronze/20 bg-charcoal-surface/40 text-text-secondary text-xs uppercase tracking-wider">
                <th className="p-4 font-semibold">Fecha</th>
                <th className="p-4 font-semibold">Cliente</th>
                <th className="p-4 font-semibold">Tipo / Asunto</th>
                <th className="p-4 font-semibold">Estado</th>
                <th className="p-4 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredInquiries.map((inquiry) => (
                <tr
                  key={inquiry.id}
                  onClick={() => setSelectedInquiry(inquiry)}
                  className="border-b border-aged-bronze/10 hover:bg-charcoal-surface/30 transition-colors duration-200 cursor-pointer"
                >
                  <td className="p-4 whitespace-nowrap text-xs text-text-secondary">
                    {formatDate(inquiry.createdAt)}
                  </td>
                  <td className="p-4">
                    <div className="font-semibold text-text-primary">{inquiry.name}</div>
                    <div className="text-xs text-text-secondary">{inquiry.email}</div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={getInquiryTypeBadgeVariant(inquiry.inquiryType)}>
                        {getInquiryTypeLabel(inquiry.inquiryType)}
                      </Badge>
                    </div>
                    <div className="font-medium text-text-primary line-clamp-1">
                      {inquiry.subject}
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge variant={inquiry.status === 'resolved' ? 'success' : 'warning'}>
                      {inquiry.status === 'resolved' ? 'Resuelto' : 'Pendiente'}
                    </Badge>
                  </td>
                  <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setSelectedInquiry(inquiry)}
                        className="px-2.5 py-1 text-xs font-semibold rounded bg-charcoal-surface hover:bg-aged-bronze/20 border border-aged-bronze/30 text-text-primary transition-colors"
                        title="Ver detalles"
                      >
                        Ver
                      </button>
                      {inquiry.status === 'pending' ? (
                        <button
                          onClick={() => handleUpdateStatus(inquiry.id, 'resolved')}
                          className="px-2.5 py-1 text-xs font-semibold rounded bg-success-green/10 hover:bg-success-green/20 border border-success-green/30 text-success-green transition-colors"
                          title="Marcar como resuelto"
                        >
                          Resolver
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUpdateStatus(inquiry.id, 'pending')}
                          className="px-2.5 py-1 text-xs font-semibold rounded bg-aged-bronze/10 hover:bg-aged-bronze/20 border border-aged-bronze/30 text-text-secondary transition-colors"
                          title="Volver a marcar como pendiente"
                        >
                          Reabrir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Inquiry Detail Modal */}
      {selectedInquiry && (
        <div className="fixed inset-0 bg-obsidian/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div
            className="w-full max-w-2xl bg-onyx-surface border border-aged-bronze/40 rounded-lg shadow-2xl overflow-hidden animate-slide-in flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-aged-bronze/20 bg-charcoal-surface/30 flex justify-between items-start">
              <div>
                <span className="text-[10px] text-text-secondary font-semibold uppercase tracking-wider">
                  Detalle de la Consulta
                </span>
                <Heading level={4} className="!border-none !pb-0 font-sans tracking-wide mt-1">
                  {selectedInquiry.subject}
                </Heading>
              </div>
              <button
                onClick={() => setSelectedInquiry(null)}
                className="text-text-secondary hover:text-text-primary p-1.5 rounded-full hover:bg-charcoal-surface transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm font-sans">
              {/* Metadata panel */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-obsidian/40 border border-aged-bronze/15 p-4 rounded-md">
                <div>
                  <span className="block text-[10px] text-text-secondary uppercase font-medium tracking-wider">
                    Remitente
                  </span>
                  <span className="font-semibold text-text-primary block text-base mt-0.5">
                    {selectedInquiry.name}
                  </span>
                  <a
                    href={`mailto:${selectedInquiry.email}`}
                    className="text-champagne-gold hover:underline text-xs flex items-center gap-1.5 mt-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {selectedInquiry.email}
                  </a>
                  {selectedInquiry.phone && (
                    <a
                      href={`tel:${selectedInquiry.phone}`}
                      className="text-text-secondary hover:text-text-primary text-xs flex items-center gap-1.5 mt-1 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 00.996.86h3.58a1 1 0 00.996-.86l.548-2.2a1 1 0 01.94-.725H19a2 2 0 012 2v3a2 2 0 01-2 2h-3.28a1 1 0 01-.94-.725l-.548-2.2a1 1 0 00-.996-.86H8.98a1 1 0 00-.996.86l-.548 2.2a1 1 0 01-.94.725H5a2 2 0 01-2-2V5z" />
                      </svg>
                      {selectedInquiry.phone}
                    </a>
                  )}
                </div>
                <div className="space-y-3">
                  <div>
                    <span className="block text-[10px] text-text-secondary uppercase font-medium tracking-wider">
                      Fecha de Envío
                    </span>
                    <span className="text-text-primary font-medium block mt-0.5">
                      {formatDate(selectedInquiry.createdAt)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div>
                      <span className="block text-[10px] text-text-secondary uppercase font-medium tracking-wider mb-1">
                        Área de Interés
                      </span>
                      <Badge variant={getInquiryTypeBadgeVariant(selectedInquiry.inquiryType)}>
                        {getInquiryTypeLabel(selectedInquiry.inquiryType)}
                      </Badge>
                    </div>
                    <div>
                      <span className="block text-[10px] text-text-secondary uppercase font-medium tracking-wider mb-1">
                        Estado Actual
                      </span>
                      <Badge variant={selectedInquiry.status === 'resolved' ? 'success' : 'warning'}>
                        {selectedInquiry.status === 'resolved' ? 'Resuelto' : 'Pendiente'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Message body */}
              <div>
                <span className="block text-[10px] text-text-secondary uppercase font-medium tracking-wider mb-2">
                  Mensaje
                </span>
                <div className="bg-obsidian border border-aged-bronze/15 p-5 rounded-md text-text-primary font-sans leading-relaxed whitespace-pre-wrap select-text selection:bg-champagne-gold/30">
                  {selectedInquiry.message}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-6 border-t border-aged-bronze/20 bg-charcoal-surface/30 flex flex-col sm:flex-row justify-between gap-4">
              <div>
                {selectedInquiry.status === 'pending' ? (
                  <Button
                    variant="primary"
                    onClick={() => handleUpdateStatus(selectedInquiry.id, 'resolved')}
                    className="flex items-center gap-2 w-full sm:w-auto"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Marcar como Resuelto</span>
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => handleUpdateStatus(selectedInquiry.id, 'pending')}
                    className="flex items-center gap-2 w-full sm:w-auto"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 3v2m-2.837 5.828l-2.83-2.829m0 0l-3.07 3.07M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Volver a Abrir Consulta</span>
                  </Button>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2">
                <a
                  href={`mailto:${selectedInquiry.email}?subject=Re: ${encodeURIComponent(selectedInquiry.subject)}`}
                  className="inline-flex items-center justify-center font-semibold rounded transition-all duration-300 px-4 py-2 text-base bg-charcoal-surface text-text-primary border border-aged-bronze hover:border-champagne-gold hover:bg-onyx-surface active:scale-98 gap-2 w-full sm:w-auto text-center"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>Responder por Correo</span>
                </a>
                
                <Button variant="secondary" onClick={() => setSelectedInquiry(null)} className="w-full sm:w-auto">
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
