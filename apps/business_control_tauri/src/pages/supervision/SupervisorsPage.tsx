import React, { useCallback, useEffect, useState } from 'react';
import { Heading } from '../../components/atoms/Heading';
import { Button } from '../../components/atoms/Button';
import { api, Branch, SupervisorAssignment } from '../../services/api';
import { errorMessage } from './supervisionUi';

/** Spec 019 D-1: the owner assigns several branches to each supervisor. */
export const SupervisorsPage: React.FC<{ businessId: string }> = ({ businessId }) => {
  const [supervisors, setSupervisors] = useState<SupervisorAssignment[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, brs] = await Promise.all([api.getSupervisorAssignments(businessId), api.getBranches(businessId)]);
      setSupervisors(list);
      setBranches(brs);
      setDraft(Object.fromEntries(list.map((s) => [s.id, s.branches.map((b) => b.branchId)])));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (userId: string, branchId: string) =>
    setDraft((prev) => {
      const current = prev[userId] ?? [];
      return { ...prev, [userId]: current.includes(branchId) ? current.filter((id) => id !== branchId) : [...current, branchId] };
    });

  const save = async (userId: string) => {
    setSaving(userId);
    setError(null);
    setNotice(null);
    try {
      await api.replaceSupervisorAssignments(userId, businessId, draft[userId] ?? []);
      setNotice('Asignaciones guardadas.');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 min-h-full lg:h-full overflow-y-auto lg:overflow-hidden">
      <div>
        <Heading level={2} className="!text-lg sm:!text-2xl">Supervisores de sucursal</Heading>
        <p className="text-xs text-text-secondary mt-1">
          Cada supervisor cubre varias sucursales. Crea al usuario en Administradores con el rol “Supervisor de sucursal” y asígnale aquí sus sucursales.
        </p>
      </div>
      {error && <div className="text-error-red text-sm">{error}</div>}
      {notice && <div className="text-success-green text-sm">{notice}</div>}
      {loading && <div className="text-text-secondary text-sm">Cargando…</div>}
      {!loading && supervisors.length === 0 && (
        <div className="p-8 text-center text-text-secondary text-sm italic">No hay supervisores en este negocio.</div>
      )}
      <div className="flex flex-col gap-3 lg:overflow-y-auto pr-1">
        {supervisors.map((sup) => (
          <div key={sup.id} className="p-4 rounded-lg border border-aged-bronze/20 bg-charcoal/40 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-text-primary">{sup.name}</div>
                <div className="text-xs text-text-secondary">{sup.email ?? ''}</div>
              </div>
              <Button size="sm" onClick={() => save(sup.id)} disabled={saving === sup.id}>
                {saving === sup.id ? 'Guardando…' : 'Guardar sucursales'}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {branches.map((b) => {
                const checked = (draft[sup.id] ?? []).includes(b.id);
                return (
                  <label
                    key={b.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs cursor-pointer ${
                      checked ? 'border-champagne-gold/60 text-champagne-gold bg-champagne-gold/5' : 'border-aged-bronze/30 text-text-secondary'
                    }`}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggle(sup.id, b.id)} />
                    {b.name}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
