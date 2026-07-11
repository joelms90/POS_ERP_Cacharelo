import React, { useCallback, useEffect, useState } from 'react';
import { AdminUser, api } from '../services/api';
import { Heading } from '../components/atoms/Heading';
import { Input } from '../components/atoms/Input';
import { Button } from '../components/atoms/Button';
import { FormField } from '../components/molecules/FormField';

interface AdministratorsPageProps {
  businessId: string;
}

type AdminRole = 'owner' | 'inventory_admin';

const businessOptions = [
  { id: 'd3b07384-d113-4a0e-a555-e5b12824bf01', name: 'Cafetería' },
  { id: 'd3b07384-d113-4a0e-a555-e5b12824bf03', name: 'Empanadas' },
  { id: 'd3b07384-d113-4a0e-a555-e5b12824bf07', name: 'Tortas' },
  { id: 'd3b07384-d113-4a0e-a555-e5b12824bf05', name: 'Hamburguesas' },
];

const businessName = (id: string) =>
  businessOptions.find((business) => business.id === id)?.name || id.slice(0, 8);

const roleLabel = (role: AdminRole) =>
  role === 'owner' ? 'Owner' : 'Administrador de Inventario';

export const AdministratorsPage: React.FC<AdministratorsPageProps> = ({ businessId }) => {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'inventory_admin' as AdminRole,
    businessIds: [businessId],
  });

  const loadAdmins = useCallback(async () => {
    setLoading(true);
    try {
      setAdmins(await api.getAdminUsers(businessId));
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'No se pudieron cargar los administradores.' });
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  const resetForm = () => {
    setEditingId(null);
    setForm({ name: '', email: '', password: '', role: 'inventory_admin', businessIds: [businessId] });
  };

  const handleEdit = (admin: AdminUser) => {
    setEditingId(admin.id);
    setForm({
      name: admin.name,
      email: admin.email,
      password: '',
      role: admin.role,
      businessIds: admin.businessAccess?.map((access) => access.businessId) || [admin.businessId || businessId],
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);

    if (!form.name.trim() || !form.email.trim()) {
      setMessage({ type: 'error', text: 'Nombre y correo son requeridos.' });
      return;
    }
    if (!editingId && form.password.length < 6) {
      setMessage({ type: 'error', text: 'La contraseña temporal debe tener al menos 6 caracteres.' });
      return;
    }
    if (form.businessIds.length === 0) {
      setMessage({ type: 'error', text: 'Selecciona al menos un negocio.' });
      return;
    }

    const businessAccess = form.businessIds.map((id) => ({
      businessId: id,
      role: form.role,
    }));

    setSaving(true);
    try {
      if (editingId) {
        await api.updateAdminUser(editingId, {
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          businessAccess,
          ...(form.password.trim() ? { password: form.password } : {}),
        });
        setMessage({ type: 'success', text: 'Administrador actualizado.' });
      } else {
        await api.addAdminUser({
          businessId,
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          businessAccess,
        });
        setMessage({ type: 'success', text: 'Administrador creado.' });
      }
      resetForm();
      await loadAdmins();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'No se pudo guardar el administrador.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (admin: AdminUser) => {
    if (!confirm(`Desactivar acceso de ${admin.name}?`)) return;
    setSaving(true);
    try {
      await api.deactivateAdminUser(admin.id);
      setMessage({ type: 'success', text: 'Administrador desactivado.' });
      await loadAdmins();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'No se pudo desactivar.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 min-h-full animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-aged-bronze/10 pb-4">
        <div>
          <Heading level={2} className="!border-none !pb-0 font-light !text-lg sm:!text-2xl">
            Administradores
          </Heading>
          <p className="text-sm text-text-secondary mt-1 font-sans">
            Controla accesos de owner y administradores de inventario para Business Control.
          </p>
        </div>
        <button
          onClick={loadAdmins}
          disabled={loading}
          className="px-4 py-2 border border-aged-bronze/40 hover:border-champagne-gold/60 bg-onyx-surface hover:bg-charcoal-surface/60 rounded text-sm text-text-secondary hover:text-champagne-gold disabled:opacity-50"
        >
          Sincronizar
        </button>
      </div>

      {message && (
        <div className={`rounded border px-4 py-3 text-sm ${
          message.type === 'error'
            ? 'border-error-red/40 bg-error-red/10 text-red-200'
            : 'border-green-500/40 bg-green-500/10 text-green-100'
        }`}>
          {message.text}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <form
          onSubmit={handleSubmit}
          className="w-full lg:w-96 bg-onyx-surface border border-aged-bronze/30 rounded p-5 flex flex-col gap-4"
        >
          <h3 className="text-champagne-gold text-sm uppercase tracking-widest font-semibold">
            {editingId ? 'Editar acceso' : 'Nuevo acceso'}
          </h3>

          <FormField label="Nombre" required>
            <Input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Nombre del administrador"
              disabled={saving}
            />
          </FormField>

          <FormField label="Correo" required>
            <Input
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="correo@cacharelo.com"
              disabled={saving}
            />
          </FormField>

          <FormField label={editingId ? 'Nueva contraseña' : 'Contraseña temporal'} required={!editingId}>
            <Input
              type="password"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              placeholder={editingId ? 'Dejar vacía para conservar' : 'Mínimo 6 caracteres'}
              disabled={saving}
            />
          </FormField>

          <label className="flex flex-col gap-2 text-xs text-text-secondary uppercase tracking-wider">
            Rol
            <select
              value={form.role}
              onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as AdminRole }))}
              disabled={saving}
              className="px-3 py-2 bg-charcoal-surface text-text-primary border border-aged-bronze/40 focus:border-champagne-gold rounded text-sm focus:outline-none"
            >
              <option value="inventory_admin">Administrador de Inventario</option>
              <option value="owner">Owner</option>
            </select>
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-xs text-text-secondary uppercase tracking-wider">
              Negocios asignados
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {businessOptions.map((business) => (
                <label
                  key={business.id}
                  className="flex items-center gap-2 px-3 py-2 rounded border border-aged-bronze/30 bg-charcoal-surface/50 text-sm text-text-primary"
                >
                  <input
                    type="checkbox"
                    checked={form.businessIds.includes(business.id)}
                    onChange={(event) => {
                      setForm((prev) => ({
                        ...prev,
                        businessIds: event.target.checked
                          ? Array.from(new Set([...prev.businessIds, business.id]))
                          : prev.businessIds.filter((id) => id !== business.id),
                      }));
                    }}
                    disabled={saving}
                  />
                  <span>{business.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving} fullWidth>
              {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear'}
            </Button>
            {editingId && (
              <Button type="button" variant="secondary" disabled={saving} onClick={resetForm}>
                Cancelar
              </Button>
            )}
          </div>
        </form>

        <section className="flex-1 w-full bg-onyx-surface border border-aged-bronze/30 rounded overflow-hidden">
          <div className="px-5 py-4 border-b border-aged-bronze/20 flex items-center justify-between">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-widest">
              Accesos activos
            </span>
            <span className="text-xs text-aged-bronze">{admins.length}</span>
          </div>

          {loading ? (
            <div className="p-8 text-sm text-text-secondary">Cargando administradores...</div>
          ) : admins.length === 0 ? (
            <div className="p-8 text-sm text-text-secondary">Sin administradores registrados.</div>
          ) : (
            <div className="divide-y divide-aged-bronze/15">
              {admins.map((admin) => (
                <div key={admin.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="text-sm text-text-primary font-semibold">{admin.name}</div>
                    <div className="text-xs text-text-secondary mt-1">{admin.email}</div>
                    <div className="text-[10px] text-aged-bronze uppercase tracking-widest mt-2">
                      {roleLabel(admin.role)}
                    </div>
                    <div className="text-[11px] text-text-secondary mt-2">
                      {(admin.businessAccess || []).map((access) => businessName(access.businessId)).join(', ') || businessName(admin.businessId || businessId)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(admin)}
                      disabled={saving}
                      className="px-3 py-2 rounded border border-aged-bronze/30 text-xs text-text-secondary hover:text-champagne-gold hover:border-champagne-gold/50 disabled:opacity-50"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeactivate(admin)}
                      disabled={saving}
                      className="px-3 py-2 rounded border border-error-red/40 text-xs text-red-200 hover:bg-error-red/10 disabled:opacity-50"
                    >
                      Desactivar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
