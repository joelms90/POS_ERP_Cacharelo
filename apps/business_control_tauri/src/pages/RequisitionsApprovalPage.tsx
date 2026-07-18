import React, { useState, useEffect } from 'react';
import { api, BranchRequisition } from '../services/api';
import { Heading } from '../components/atoms/Heading';
import { Button } from '../components/atoms/Button';

interface RequisitionsApprovalPageProps {
  businessId: string;
}

export const RequisitionsApprovalPage: React.FC<RequisitionsApprovalPageProps> = ({ businessId }) => {
  const [requisitions, setRequisitions] = useState<BranchRequisition[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequisition, setSelectedRequisition] = useState<BranchRequisition | null>(null);
  const [approvalNotes, setApprovalNotes] = useState<string>('');

  const fetchRequisitions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getPendingRequisitions(businessId);
      setRequisitions(data);
    } catch (err: any) {
      console.error(err);
      setError('Error al cargar requisiciones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequisitions();
  }, [businessId]);

  const handleApprove = async (id: string) => {
    try {
      await api.updateRequisitionStatus(id, {
        status: 'approved',
        notes: approvalNotes || undefined,
      });
      setRequisitions(requisitions.filter((r) => r.id !== id));
      setSelectedRequisition(null);
      setApprovalNotes('');
    } catch (err) {
      alert('Error al aprobar la requisición');
    }
  };

  const handleReject = async (id: string) => {
    if (!approvalNotes.trim()) {
      alert('Debe proporcionar una razón para rechazar');
      return;
    }
    try {
      await api.updateRequisitionStatus(id, {
        status: 'rejected',
        notes: approvalNotes,
      });
      setRequisitions(requisitions.filter((r) => r.id !== id));
      setSelectedRequisition(null);
      setApprovalNotes('');
    } catch (err) {
      alert('Error al rechazar la requisición');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: 'bg-yellow-500/20 text-yellow-300',
      approved: 'bg-green-500/20 text-green-300',
      rejected: 'bg-red-500/20 text-red-300',
      completed: 'bg-blue-500/20 text-blue-300',
    };
    const labels = {
      pending: 'Pendiente',
      approved: 'Aprobada',
      rejected: 'Rechazada',
      completed: 'Completada',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${badges[status as keyof typeof badges] || badges.pending}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  return (
    <div className="w-full lg:h-full min-h-full bg-obsidian p-2 lg:p-6 font-sans overflow-y-auto lg:overflow-hidden">
      <div className="flex flex-col lg:flex-row gap-6 min-h-fit lg:h-full max-w-7xl mx-auto w-full">
        {/* Left Side: Requisitions List */}
        <div className="flex-1 bg-onyx-surface border border-aged-bronze/40 rounded-lg p-4 lg:p-6 flex flex-col lg:h-full overflow-hidden shadow-xl">
          <Heading level={2} className="!text-lg sm:!text-2xl !border-none !pb-0 text-champagne-gold mb-6">
            Requisiciones Pendientes
          </Heading>

          {error && (
            <div className="bg-error-red/10 border border-error-red/30 text-error-red rounded p-3 text-xs mb-4">
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
          ) : requisitions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-text-secondary text-xs">
              <svg className="w-12 h-12 text-aged-bronze/50 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>No hay requisiciones pendientes</span>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-3">
              {requisitions.map((req) => (
                <div
                  key={req.id}
                  onClick={() => setSelectedRequisition(req)}
                  className={`bg-charcoal/40 border ${selectedRequisition?.id === req.id ? 'border-champagne-gold' : 'border-aged-bronze/20'} rounded-lg p-4 cursor-pointer hover:border-aged-bronze/40 transition-colors`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-semibold text-text-primary text-sm">{req.fromBranchName}</h4>
                      <span className="text-xs text-text-secondary">
                        Solicitado por: {req.requestedByName}
                      </span>
                    </div>
                    {getStatusBadge(req.status)}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs mt-3 pt-2 border-t border-aged-bronze/10">
                    <div>
                      <span className="text-[10px] text-text-secondary block">Destino</span>
                      <span className="text-text-primary font-medium">{req.toWarehouseName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-text-secondary block">Productos</span>
                      <span className="text-text-primary font-medium">{req.items?.length || 0}</span>
                    </div>
                  </div>
                  {req.notes && (
                    <div className="text-xs text-text-secondary mt-2 pt-2 border-t border-aged-bronze/10">
                      <span className="font-medium">Notas: </span>
                      {req.notes}
                    </div>
                  )}
                  <div className="text-[10px] text-text-secondary mt-2">
                    {new Date(req.createdAt).toLocaleDateString('es-MX', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Requisition Details & Actions */}
        {selectedRequisition && (
          <div className="w-full lg:w-96 bg-onyx-surface border border-aged-bronze/40 rounded-lg p-4 lg:p-6 shadow-xl lg:h-full overflow-y-auto">
            <Heading level={3} className="!text-base !border-none !pb-0 text-champagne-gold mb-4">
              Detalle de Requisición
            </Heading>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-1">Sucursal Solicitante</label>
                <p className="text-sm text-text-primary">{selectedRequisition.fromBranchName}</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-1">Bodega Destino</label>
                <p className="text-sm text-text-primary">{selectedRequisition.toWarehouseName}</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-1">Solicitado Por</label>
                <p className="text-sm text-text-primary">{selectedRequisition.requestedByName}</p>
              </div>

              {selectedRequisition.notes && (
                <div>
                  <label className="text-xs font-semibold text-text-secondary block mb-1">Notas de Solicitud</label>
                  <p className="text-sm text-text-primary bg-charcoal/40 p-2 rounded">{selectedRequisition.notes}</p>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-2">Productos Solicitados</label>
                <div className="space-y-2">
                  {selectedRequisition.items?.map((item, index) => (
                    <div key={index} className="bg-charcoal/40 p-2 rounded flex justify-between items-center">
                      <span className="text-xs text-text-primary">{item.productName || `Producto ${item.productId}`}</span>
                      <span className="text-xs text-champagne-gold font-medium">{item.quantityRequested} unidades</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-2">Notas de Aprobación/Rechazo</label>
                <textarea
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal border border-aged-bronze/30 rounded text-text-primary text-sm"
                  rows={3}
                  placeholder="Opcional para aprobar, requerido para rechazar..."
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => handleApprove(selectedRequisition.id)}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  Aprobar
                </Button>
                <Button
                  onClick={() => handleReject(selectedRequisition.id)}
                  className="flex-1 bg-error-red hover:bg-error-red/80"
                >
                  Rechazar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
