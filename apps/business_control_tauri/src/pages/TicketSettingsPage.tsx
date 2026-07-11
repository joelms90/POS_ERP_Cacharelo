import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api, Branch, TicketFiscalConfiguration } from '../services/api';
import { Heading } from '../components/atoms/Heading';
import { Button } from '../components/atoms/Button';
import { Input } from '../components/atoms/Input';
import { FormField } from '../components/molecules/FormField';

interface TicketSettingsPageProps {
  businessId: string;
}

type TicketForm = Omit<TicketFiscalConfiguration, 'id' | 'createdAt' | 'updatedAt' | 'version'>;

const emptyForm = (businessId: string, branch?: Branch): TicketForm => ({
  businessId,
  branchId: branch?.id || null,
  sellerDisplayName: 'Cafeteria Cacharelo',
  legalName: 'Cafeteria Cacharelo S.A. de C.V.',
  fiscalId: 'CACX010101ABC',
  branchName: branch?.name || 'Sucursal Demo',
  branchAddress: branch?.address || 'Av. Principal 123, Centro, Mexico',
  phone: branch?.phone || '555-1234',
  receiptPrefix: 'CCH',
  taxMode: 'breakdown',
  footerText: 'Comprobante de compra. IVA incluido en precios al publico.\ncacharelo.com',
  isActive: true,
});

export const TicketSettingsPage: React.FC<TicketSettingsPageProps> = ({ businessId }) => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [form, setForm] = useState<TicketForm>(() => emptyForm(businessId));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === selectedBranchId),
    [branches, selectedBranchId],
  );

  const loadSettings = useCallback(async (targetBusinessId: string, targetBranchId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const settings = await api.getTicketSettings(targetBusinessId, targetBranchId);
      setForm({
        businessId: settings.businessId,
        branchId: settings.branchId || targetBranchId || null,
        sellerDisplayName: settings.sellerDisplayName,
        legalName: settings.legalName,
        fiscalId: settings.fiscalId,
        branchName: settings.branchName,
        branchAddress: settings.branchAddress,
        phone: settings.phone || '',
        receiptPrefix: settings.receiptPrefix,
        taxMode: settings.taxMode,
        footerText: settings.footerText || '',
        isActive: settings.isActive,
      });
    } catch (err: any) {
      setForm(emptyForm(targetBusinessId));
      setError(err.message || 'No se pudo cargar la configuracion del ticket.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getBranches(businessId);
        setBranches(data);
        const firstBranchId = data[0]?.id || '';
        setSelectedBranchId(firstBranchId);
        await loadSettings(businessId, firstBranchId || undefined);
      } catch (err: any) {
        setError(err.message || 'No se pudieron cargar las sucursales.');
        setForm(emptyForm(businessId));
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [businessId, loadSettings]);

  useEffect(() => {
    if (!selectedBranchId) return;
    loadSettings(businessId, selectedBranchId);
  }, [businessId, selectedBranchId, loadSettings]);

  const updateField = (field: keyof TicketForm, value: string | boolean) => {
    setSavedAt(null);
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleBranchChange = (branchId: string) => {
    setSelectedBranchId(branchId);
    const branch = branches.find((item) => item.id === branchId);
    setForm((current) => ({
      ...current,
      businessId,
      branchId: branchId || null,
      branchName: branch?.name || current.branchName,
      branchAddress: branch?.address || current.branchAddress,
      phone: branch?.phone || current.phone,
    }));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const saved = await api.saveTicketSettings({
        ...form,
        businessId,
        branchId: selectedBranchId || null,
        sellerDisplayName: form.sellerDisplayName.trim(),
        legalName: form.legalName.trim(),
        fiscalId: form.fiscalId.trim().toUpperCase(),
        branchName: form.branchName.trim(),
        branchAddress: form.branchAddress.trim(),
        phone: form.phone?.trim() || null,
        receiptPrefix: form.receiptPrefix.trim().toUpperCase(),
        footerText: form.footerText?.trim() || null,
        isActive: true,
      });
      setForm({
        businessId: saved.businessId,
        branchId: saved.branchId,
        sellerDisplayName: saved.sellerDisplayName,
        legalName: saved.legalName,
        fiscalId: saved.fiscalId,
        branchName: saved.branchName,
        branchAddress: saved.branchAddress,
        phone: saved.phone || '',
        receiptPrefix: saved.receiptPrefix,
        taxMode: saved.taxMode,
        footerText: saved.footerText || '',
        isActive: saved.isActive,
      });
      setSavedAt(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));
    } catch (err: any) {
      setError(err.message || 'No se pudo guardar la configuracion fiscal.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full lg:h-full min-h-full bg-obsidian p-2 lg:p-6 font-sans overflow-y-auto lg:overflow-hidden">
      <div className="flex flex-col lg:flex-row gap-6 min-h-fit lg:h-full max-w-7xl mx-auto w-full">
        <section className="flex-1 bg-onyx-surface border border-aged-bronze/40 rounded-lg p-4 lg:p-6 flex flex-col lg:h-full overflow-hidden shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <Heading level={2} className="!text-lg sm:!text-2xl !border-none !pb-0 text-champagne-gold tracking-wide font-light">
                Ticket Fiscal
              </Heading>
              <p className="text-xs text-text-secondary mt-1">
                Datos que se imprimen y se sincronizan a las terminales POS.
              </p>
            </div>

            <div className="w-full sm:w-72">
              <label className="block text-[10px] uppercase tracking-widest text-text-secondary mb-1">
                Sucursal
              </label>
              <select
                value={selectedBranchId}
                onChange={(event) => handleBranchChange(event.target.value)}
                className="w-full bg-charcoal-surface border border-aged-bronze focus:border-champagne-gold text-text-primary rounded-md p-2.5 font-sans text-xs focus:outline-none"
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id} className="bg-onyx text-text-primary">
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="bg-error-red/10 border border-error-red/30 text-error-red rounded p-3 text-xs mb-4">
              {error}
            </div>
          )}

          {savedAt && (
            <div className="bg-success-green/10 border border-success-green/30 text-success-green rounded p-3 text-xs mb-4">
              Configuracion guardada a las {savedAt}. Se aplicara en la terminal despues de sincronizar.
            </div>
          )}

          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto pr-1">
            <FormField label="Nombre comercial" required>
              <Input value={form.sellerDisplayName} onChange={(event) => updateField('sellerDisplayName', event.target.value)} required />
            </FormField>

            <FormField label="Razon social" required>
              <Input value={form.legalName} onChange={(event) => updateField('legalName', event.target.value)} required />
            </FormField>

            <FormField label="RFC / Identificacion fiscal" required>
              <Input value={form.fiscalId} onChange={(event) => updateField('fiscalId', event.target.value.toUpperCase())} required />
            </FormField>

            <FormField label="Serie del comprobante" required>
              <Input value={form.receiptPrefix} onChange={(event) => updateField('receiptPrefix', event.target.value.toUpperCase())} required />
            </FormField>

            <FormField label="Nombre de sucursal" required>
              <Input value={form.branchName} onChange={(event) => updateField('branchName', event.target.value)} required />
            </FormField>

            <FormField label="Telefono">
              <Input value={form.phone || ''} onChange={(event) => updateField('phone', event.target.value)} />
            </FormField>

            <div className="md:col-span-2">
              <FormField label="Direccion fiscal / sucursal" required>
                <textarea
                  value={form.branchAddress}
                  onChange={(event) => updateField('branchAddress', event.target.value)}
                  rows={3}
                  required
                  className="w-full bg-charcoal-surface border border-aged-bronze focus:border-champagne-gold text-text-primary rounded-md p-3 font-sans text-xs focus:outline-none transition-all resize-none"
                />
              </FormField>
            </div>

            <div className="md:col-span-2">
              <FormField label="Impuestos en ticket">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => updateField('taxMode', 'breakdown')}
                    className={`text-left rounded-md border p-3 transition-colors ${form.taxMode === 'breakdown' ? 'border-champagne-gold bg-charcoal-surface text-champagne-gold' : 'border-aged-bronze/30 bg-charcoal-surface/40 text-text-secondary'}`}
                  >
                    <span className="block text-xs font-semibold">Desglose IVA</span>
                    <span className="block text-[10px] mt-1">Subtotal neto, IVA 16% y total pagado.</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('taxMode', 'included')}
                    className={`text-left rounded-md border p-3 transition-colors ${form.taxMode === 'included' ? 'border-champagne-gold bg-charcoal-surface text-champagne-gold' : 'border-aged-bronze/30 bg-charcoal-surface/40 text-text-secondary'}`}
                  >
                    <span className="block text-xs font-semibold">IVA incluido</span>
                    <span className="block text-[10px] mt-1">Leyenda clara sin cambiar el total cobrado.</span>
                  </button>
                </div>
              </FormField>
            </div>

            <div className="md:col-span-2">
              <FormField label="Pie de ticket">
                <textarea
                  value={form.footerText || ''}
                  onChange={(event) => updateField('footerText', event.target.value)}
                  rows={3}
                  className="w-full bg-charcoal-surface border border-aged-bronze focus:border-champagne-gold text-text-primary rounded-md p-3 font-sans text-xs focus:outline-none transition-all resize-none"
                />
              </FormField>
            </div>

            <div className="md:col-span-2 flex flex-col sm:flex-row gap-3 justify-end pt-2">
              <Button type="button" variant="secondary" onClick={() => loadSettings(businessId, selectedBranchId || undefined)} disabled={loading || saving}>
                Recargar
              </Button>
              <Button type="submit" variant="primary" disabled={loading || saving}>
                {saving ? 'Guardando...' : 'Guardar Configuracion'}
              </Button>
            </div>
          </form>
        </section>

        <aside className="w-full lg:w-80 bg-onyx-surface border border-aged-bronze/40 rounded-lg p-5 lg:h-full lg:overflow-y-auto shadow-xl">
          <Heading level={3} className="!border-none !pb-0 text-champagne-gold tracking-wide font-light mb-4">
            Vista Rapida
          </Heading>
          <div className="bg-charcoal-surface border border-aged-bronze/30 rounded-md p-4 font-mono text-[11px] leading-5 text-text-primary">
            <div className="text-center">{form.sellerDisplayName}</div>
            <div className="text-center">{form.legalName}</div>
            <div className="text-center">RFC: {form.fiscalId}</div>
            <div className="text-center">{form.branchName}</div>
            <div className="text-center text-text-secondary">{form.branchAddress}</div>
            <div className="border-t border-aged-bronze/40 my-2" />
            <div>Operacion: {form.receiptPrefix}-000001</div>
            <div>Fecha: {new Date().toLocaleString('es-MX')}</div>
            <div>Metodo: TARJETA</div>
            <div className="border-t border-aged-bronze/40 my-2" />
            <div className="flex justify-between"><span>1x Producto demo</span><span>$100.00</span></div>
            <div className="border-t border-aged-bronze/40 my-2" />
            {form.taxMode === 'breakdown' ? (
              <>
                <div className="flex justify-between"><span>Subtotal neto</span><span>$86.21</span></div>
                <div className="flex justify-between"><span>IVA 16%</span><span>$13.79</span></div>
              </>
            ) : (
              <div className="text-center">IVA incluido</div>
            )}
            <div className="flex justify-between font-bold text-champagne-gold"><span>Total</span><span>$100.00</span></div>
            <div className="border-t border-aged-bronze/40 my-2" />
            <div className="text-center text-text-secondary">{form.footerText}</div>
          </div>
          {selectedBranch && (
            <p className="text-[10px] text-text-secondary mt-3">
              La configuracion se guarda para {selectedBranch.name} y se reemplaza localmente en cada POS al sincronizar.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
};
