import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api, Category, Product } from '../services/api';
import { Heading } from '../components/atoms/Heading';
import { Button } from '../components/atoms/Button';
import { Input } from '../components/atoms/Input';
import { Badge } from '../components/atoms/Badge';
import { FormField } from '../components/molecules/FormField';
import { ToastContainer } from '../components/molecules/ToastNotification';

interface CategoriesPageProps {
  businessId: string;
}

export const CategoriesPage: React.FC<CategoriesPageProps> = ({ businessId }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedKdsFilter, setSelectedKdsFilter] = useState<'all' | 'cocina' | 'barra' | 'none'>('all');

  // Edit / Create Category State
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Inspect Products in Category Modal State
  const [inspectingCategory, setInspectingCategory] = useState<Category | null>(null);
  const [inspectSearchQuery, setInspectSearchQuery] = useState<string>('');

  // Toast notifications state
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' | 'warning' }>>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Fetch all categories and products
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [cats, prods] = await Promise.all([
        api.getCategories(businessId),
        api.getProducts(businessId),
      ]);
      setCategories(cats);
      setProducts(prods);
    } catch (err: any) {
      showToast(err.message || 'Error al sincronizar categorías.', 'error');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [businessId, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Save (Create or Update)
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;

    const trimmedName = (editingCategory.name || '').trim();
    if (!trimmedName || trimmedName.length < 2) {
      showToast('El nombre de la categoría debe tener al menos 2 caracteres.', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      if (editingCategory.id) {
        // Update existing category
        const updated = await api.updateCategory(editingCategory.id, {
          name: trimmedName,
          description: editingCategory.description?.trim() || undefined,
          // `null` clears an existing KDS station. Sending `undefined` omits the
          // field, leaving a category previously assigned to cocina/barra unchanged.
          targetStation: editingCategory.targetStation || null,
        });
        setCategories((prev) =>
          prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)),
        );
        showToast(`Categoría "${trimmedName}" actualizada exitosamente.`, 'success');
      } else {
        // Create new category
        const saved = await api.addCategory({
          name: trimmedName,
          description: editingCategory.description?.trim() || undefined,
          // Explicitly persist no KDS station instead of allowing the DB default.
          targetStation: editingCategory.targetStation || null,
        }, businessId);
        setCategories((prev) => [...prev, saved]);
        showToast(`Categoría "${trimmedName}" registrada exitosamente.`, 'success');
      }
      setEditingCategory(null);
    } catch (err: any) {
      showToast(err.message || 'Error al guardar la categoría.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete with safety check
  const handleDeleteCategory = async (id: string, name: string) => {
    const productsInCat = products.filter((p) => p.categoryId === id);
    if (productsInCat.length > 0) {
      showToast(
        `No se puede eliminar "${name}": tiene ${productsInCat.length} producto(s) asignado(s). Reasigna los productos primero.`,
        'warning',
      );
      return;
    }

    if (window.confirm(`¿Confirmas que deseas eliminar la categoría "${name}"? Esta acción no se puede deshacer.`)) {
      try {
        await api.deleteCategory(id);
        setCategories((prev) => prev.filter((c) => c.id !== id));
        showToast(`Categoría "${name}" eliminada correctamente.`, 'success');
      } catch (err: any) {
        showToast(err.message || 'No se pudo eliminar la categoría.', 'error');
      }
    }
  };

  // Export Categories to CSV
  const exportCategoriesToCSV = () => {
    try {
      const headers = ['ID', 'Nombre', 'Descripción', 'Estación KDS', 'Artículos Vinculados'];
      const rows = filteredCategories.map((c) => {
        const count = products.filter((p) => p.categoryId === c.id).length;
        const station =
          c.targetStation === 'cocina'
            ? 'Cocina'
            : c.targetStation === 'barra'
              ? 'Barra'
              : 'Sin estación';
        return [
          c.id,
          c.name,
          c.description || '',
          station,
          count.toString(),
        ].map((val) => `"${String(val || '').replace(/"/g, '""')}"`).join(',');
      });

      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `categorias_catalogo_${businessId}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Categorías exportadas exitosamente a CSV.', 'success');
    } catch {
      showToast('Error al exportar categorías.', 'error');
    }
  };

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return categories.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q));

      const matchStation =
        selectedKdsFilter === 'all'
          ? true
          : selectedKdsFilter === 'none'
            ? !c.targetStation
            : c.targetStation === selectedKdsFilter;

      return matchSearch && matchStation;
    });
  }, [categories, searchQuery, selectedKdsFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = categories.length;
    const cocinaCount = categories.filter((c) => c.targetStation === 'cocina').length;
    const barraCount = categories.filter((c) => c.targetStation === 'barra').length;
    const noKdsCount = categories.filter((c) => !c.targetStation).length;
    return { total, cocinaCount, barraCount, noKdsCount };
  }, [categories]);

  // Products belonging to the category being inspected
  const inspectingProducts = useMemo(() => {
    if (!inspectingCategory) return [];
    return products.filter((p) => {
      const matchCat = p.categoryId === inspectingCategory.id;
      const q = inspectSearchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.includes(q));
      return matchCat && matchSearch;
    });
  }, [inspectingCategory, products, inspectSearchQuery]);

  return (
    <div className="flex flex-col gap-6 min-h-full lg:h-full overflow-y-auto lg:overflow-hidden animate-fade-in relative font-sans text-text-primary">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER PANEL (Matches InventoryPage)                                */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-aged-bronze/10 pb-4">
        <div>
          <Heading level={2} className="!border-none !pb-0 font-light !text-lg sm:!text-2xl text-champagne-gold">
            Categorías de Catálogo
          </Heading>
          <p className="text-xs sm:text-sm text-text-secondary mt-1 font-sans">
            Administra las categorías de platillos, bebidas e insumos del local, así como su estación de preparación en cocina (KDS).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchData()}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 border border-aged-bronze/40 hover:border-champagne-gold/60 bg-onyx-surface hover:bg-charcoal-surface/60 rounded text-sm text-text-secondary hover:text-champagne-gold font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-98"
          >
            <svg
              className={`w-4 h-4 ${isLoading ? 'animate-spin text-champagne-gold' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 3v2m-2.837 5.828l-2.83-2.829m0 0l-3.07 3.07M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Sincronizar</span>
          </button>

          {!editingCategory && (
            <Button
              onClick={() =>
                setEditingCategory({
                  name: '',
                  description: '',
                  targetStation: '',
                })
              }
              className="flex items-center gap-2"
              title="Registrar nueva categoría"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Nueva Categoría</span>
            </Button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MAIN CONTENT (Editing Form vs Table View)                              */}
      {/* ========================================================================= */}
      {editingCategory ? (
        /* Edit / Create Form View (Reuses the layout pattern from InventoryPage) */
        <div className="bg-onyx-surface border border-aged-bronze/40 rounded-lg p-6 shadow-xl shadow-black/20 animate-fade-in flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-aged-bronze/20 pb-4">
            <div>
              <h3 className="text-lg font-light text-champagne-gold tracking-wide">
                {editingCategory.id ? 'Modificar Categoría' : 'Registrar Nueva Categoría'}
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                {editingCategory.id
                  ? 'Actualiza los atributos, estación KDS y descripción de la categoría seleccionada.'
                  : 'Completa los datos requeridos para registrar una nueva categoría en el catálogo.'}
              </p>
            </div>
            <button
              onClick={() => setEditingCategory(null)}
              className="text-text-secondary hover:text-text-primary p-1.5 border border-transparent hover:border-aged-bronze/35 rounded transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSaveCategory} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Name & Station */}
            <div className="flex flex-col gap-5">
              <FormField label="Nombre de la Categoría" required>
                <Input
                  type="text"
                  placeholder="Ej. Desayunos, Bebidas Calientes, Pan Artesanal..."
                  value={editingCategory.name || ''}
                  onChange={(e) =>
                    setEditingCategory((prev) => ({ ...prev, name: e.target.value }))
                  }
                  disabled={isSaving}
                  required
                />
              </FormField>

              <FormField label="Estación de Preparación (KDS)">
                <select
                  value={editingCategory.targetStation || ''}
                  onChange={(e) =>
                    setEditingCategory((prev) => ({
                      ...prev,
                      targetStation: e.target.value as 'cocina' | 'barra' | '',
                    }))
                  }
                  disabled={isSaving}
                  className="w-full px-4 py-2.5 bg-charcoal-surface border border-aged-bronze focus:border-champagne-gold focus:ring-champagne-gold/50 rounded font-sans text-text-primary transition-all duration-300 focus:outline-none focus:ring-2 text-xs"
                >
                  <option value="">Sin estación (No se envía a KDS)</option>
                  <option value="cocina">🍳 Cocina (Platillos, Alimentos, Preparaciones)</option>
                  <option value="barra">🍹 Barra (Bebidas, Café, Coctelería, Tragos)</option>
                </select>
              </FormField>

              {editingCategory.id && (
                <div className="rounded-lg border border-aged-bronze/20 bg-charcoal-surface/40 p-3.5 flex items-center justify-between text-xs text-text-secondary">
                  <span>Productos asignados a esta categoría:</span>
                  <strong className="text-champagne-gold font-mono text-sm">
                    {products.filter((p) => p.categoryId === editingCategory.id).length} artículos
                  </strong>
                </div>
              )}
            </div>

            {/* Right Column: Description & Actions */}
            <div className="flex flex-col gap-5 justify-between">
              <FormField label="Descripción / Detalle Opcional">
                <textarea
                  placeholder="Escribe una breve descripción o notas para el equipo de cocina y meseros..."
                  value={editingCategory.description || ''}
                  onChange={(e) =>
                    setEditingCategory((prev) => ({ ...prev, description: e.target.value }))
                  }
                  disabled={isSaving}
                  rows={4}
                  className="w-full bg-charcoal-surface border border-aged-bronze focus:border-champagne-gold focus:ring-champagne-gold/50 text-text-primary rounded-md p-3 font-sans text-xs focus:outline-none transition-all resize-none"
                />
              </FormField>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-aged-bronze/20">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditingCategory(null)}
                  disabled={isSaving}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving || !(editingCategory.name || '').trim()}
                >
                  {isSaving ? 'Guardando...' : editingCategory.id ? 'Actualizar Categoría' : 'Guardar Categoría'}
                </Button>
              </div>
            </div>
          </form>
        </div>
      ) : (
        /* Categories List View (Matches InventoryPage Table UX) */
        <div className="flex flex-col gap-4 flex-1 min-h-0">
          {/* Search, Filter and Metrics Bar */}
          <div className="flex flex-col md:flex-row gap-4 bg-onyx-surface border border-aged-bronze/40 rounded-lg p-4 shadow-md shadow-black/10 items-stretch md:items-center justify-between">
            {/* Search Input */}
            <div className="w-full md:w-80 relative">
              <Input
                type="text"
                placeholder="Buscar por nombre o descripción..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 text-xs"
              />
              <svg
                className="w-4 h-4 text-text-secondary absolute left-3.5 top-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Filter and Export Actions */}
            <div className="flex flex-wrap items-center gap-3 justify-end">
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-secondary whitespace-nowrap">Estación KDS:</span>
                <select
                  value={selectedKdsFilter}
                  onChange={(e) => setSelectedKdsFilter(e.target.value as any)}
                  className="px-3 py-1.5 bg-charcoal-surface border border-aged-bronze focus:border-champagne-gold rounded font-sans text-xs text-text-primary transition-all duration-300 focus:outline-none cursor-pointer"
                >
                  <option value="all">Todas ({stats.total})</option>
                  <option value="cocina">🍳 Cocina ({stats.cocinaCount})</option>
                  <option value="barra">🍹 Barra ({stats.barraCount})</option>
                  <option value="none">— Sin KDS ({stats.noKdsCount})</option>
                </select>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={exportCategoriesToCSV}
                className="flex items-center gap-1.5 cursor-pointer font-semibold uppercase tracking-wider text-[10px]"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Exportar CSV</span>
              </Button>
            </div>
          </div>

          {/* Quick Metrics Chips */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
            <span className="bg-charcoal-surface/60 border border-aged-bronze/20 px-3 py-1 rounded-full">
              📂 Total: <strong className="text-champagne-gold">{stats.total}</strong> categorías
            </span>
            <span className="bg-charcoal-surface/60 border border-aged-bronze/20 px-3 py-1 rounded-full">
              🍳 Cocina: <strong className="text-amber-400">{stats.cocinaCount}</strong>
            </span>
            <span className="bg-charcoal-surface/60 border border-aged-bronze/20 px-3 py-1 rounded-full">
              🍹 Barra: <strong className="text-cyan-400">{stats.barraCount}</strong>
            </span>
            <span className="bg-charcoal-surface/60 border border-aged-bronze/20 px-3 py-1 rounded-full">
              📦 Artículos en Catálogo: <strong className="text-text-primary">{products.length}</strong>
            </span>
          </div>

          {/* Categories Table Card */}
          <div className="bg-onyx-surface border border-aged-bronze/40 rounded-lg shadow-md shadow-black/20 overflow-hidden flex-1 flex flex-col min-h-[300px]">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse select-text text-xs">
                <thead>
                  <tr className="bg-charcoal-surface/60 border-b border-aged-bronze/35 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                    <th className="px-6 py-4">Categoría</th>
                    <th className="px-6 py-4">Descripción</th>
                    <th className="px-6 py-4 text-center">Estación KDS</th>
                    <th className="px-6 py-4 text-center">Artículos</th>
                    <th className="px-6 py-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-aged-bronze/20 text-sm">
                  {isLoading && categories.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center text-text-secondary">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <svg className="animate-spin h-6 w-6 text-champagne-gold" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Cargando categorías...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredCategories.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center text-text-secondary italic">
                        {categories.length === 0
                          ? 'No hay categorías registradas en este negocio. Haz clic en "Nueva Categoría" para comenzar.'
                          : 'No se encontraron categorías que coincidan con la búsqueda o filtro.'}
                      </td>
                    </tr>
                  ) : (
                    filteredCategories.map((c) => {
                      const count = products.filter((p) => p.categoryId === c.id).length;
                      const isBarra = c.targetStation === 'barra';
                      const isCocina = c.targetStation === 'cocina';

                      return (
                        <tr key={c.id} className="hover:bg-charcoal-surface/20 transition-colors">
                          {/* Name Column */}
                          <td className="px-6 py-4 font-medium text-text-primary">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-charcoal-surface border border-aged-bronze/40 flex items-center justify-center text-sm font-bold text-champagne-gold shrink-0">
                                {isCocina ? '🍳' : isBarra ? '🍹' : '📂'}
                              </div>
                              <div>
                                <span className="font-semibold text-text-primary text-sm">{c.name}</span>
                                <span className="block text-[10px] text-text-secondary font-mono">
                                  ID: {c.id.slice(0, 8)}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Description Column */}
                          <td className="px-6 py-4 text-text-secondary text-xs max-w-sm">
                            <span className="line-clamp-2" title={c.description || ''}>
                              {c.description || <span className="italic text-text-secondary/50">Sin descripción</span>}
                            </span>
                          </td>

                          {/* KDS Station Column */}
                          <td className="px-6 py-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                isBarra
                                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                                  : isCocina
                                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                    : 'bg-charcoal-surface text-text-secondary border border-aged-bronze/30'
                              }`}
                            >
                              <span>{isBarra ? '🍹' : isCocina ? '🍳' : '—'}</span>
                              <span>{isBarra ? 'BARRA' : isCocina ? 'COCINA' : 'Sin KDS'}</span>
                            </span>
                          </td>

                          {/* Associated Products Count Column */}
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => {
                                setInspectingCategory(c);
                                setInspectSearchQuery('');
                              }}
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono font-semibold transition-all ${
                                count > 0
                                  ? 'bg-charcoal-surface hover:bg-champagne-gold/20 text-champagne-gold border border-aged-bronze/30 hover:border-champagne-gold/60 cursor-pointer'
                                  : 'bg-black/20 text-text-secondary/60 border border-aged-bronze/15 cursor-default'
                              }`}
                              title={count > 0 ? "Ver artículos de esta categoría" : "Sin artículos"}
                            >
                              <span>{count}</span>
                              <span className="text-[10px] font-sans font-normal text-text-secondary">artículos</span>
                            </button>
                          </td>

                          {/* Action Buttons Column */}
                          <td className="px-6 py-4 text-center">
                            <div className="inline-flex items-center justify-center gap-2">
                              {/* View Products Button */}
                              {count > 0 && (
                                <button
                                  onClick={() => {
                                    setInspectingCategory(c);
                                    setInspectSearchQuery('');
                                  }}
                                  className="p-1.5 hover:text-champagne-gold text-text-secondary transition-colors focus:outline-none rounded hover:bg-charcoal-surface"
                                  title="Ver artículos vinculados"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </button>
                              )}

                              {/* Edit Button */}
                              <button
                                onClick={() => setEditingCategory(c)}
                                className="p-1.5 hover:text-champagne-gold text-text-secondary transition-colors focus:outline-none rounded hover:bg-charcoal-surface"
                                title="Editar categoría"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>

                              {/* Delete Button */}
                              <button
                                onClick={() => handleDeleteCategory(c.id, c.name)}
                                className="p-1.5 hover:text-error-red text-text-secondary transition-colors focus:outline-none rounded hover:bg-charcoal-surface"
                                title="Eliminar categoría"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. PRODUCT INSPECTOR MODAL ("Artículos de la Categoría")                  */}
      {/* ========================================================================= */}
      {inspectingCategory && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[85vh] bg-obsidian border border-aged-bronze/40 rounded-xl shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-aged-bronze/20 flex items-center justify-between bg-charcoal-surface/60">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-champagne-gold/20 border border-champagne-gold/50 flex items-center justify-center text-lg">
                  {inspectingCategory.targetStation === 'cocina' ? '🍳' : inspectingCategory.targetStation === 'barra' ? '🍹' : '📂'}
                </div>
                <div>
                  <h3 className="text-base font-bold text-champagne-gold flex items-center gap-2">
                    <span>{inspectingCategory.name}</span>
                    <Badge variant={inspectingCategory.targetStation ? 'gold' : 'charcoal'} className="text-[10px]">
                      {inspectingCategory.targetStation === 'cocina' ? 'Cocina' : inspectingCategory.targetStation === 'barra' ? 'Barra' : 'Sin KDS'}
                    </Badge>
                  </h3>
                  <span className="text-xs text-text-secondary">
                    {products.filter((p) => p.categoryId === inspectingCategory.id).length} artículos vinculados a esta categoría
                  </span>
                </div>
              </div>

              <button
                onClick={() => setInspectingCategory(null)}
                className="text-text-secondary hover:text-white p-1 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Filter in Modal */}
            <div className="px-4 py-2 bg-charcoal-surface/40 border-b border-aged-bronze/15">
              <Input
                type="text"
                placeholder="Filtrar artículos de esta categoría..."
                value={inspectSearchQuery}
                onChange={(e) => setInspectSearchQuery(e.target.value)}
                className="text-xs py-1.5"
              />
            </div>

            {/* Products Table in Modal */}
            <div className="p-4 overflow-y-auto flex-1">
              {inspectingProducts.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center text-text-secondary text-xs">
                  <span>No hay productos que coincidan con la búsqueda.</span>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-aged-bronze/25 text-[10px] text-text-secondary uppercase tracking-wider">
                      <th className="pb-2">Producto</th>
                      <th className="pb-2">Código SKU / EAN</th>
                      <th className="pb-2 text-right">Costo</th>
                      <th className="pb-2 text-right">Precio Venta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-aged-bronze/10">
                    {inspectingProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-charcoal-surface/30">
                        <td className="py-2.5 font-medium text-text-primary">
                          <div className="flex items-center gap-2.5">
                            {p.imageUrl ? (
                              <img
                                src={p.imageUrl}
                                alt={p.name}
                                className="w-7 h-7 rounded object-cover border border-aged-bronze/30 bg-charcoal-surface shrink-0"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-7 h-7 rounded border border-dashed border-aged-bronze/30 bg-charcoal-surface flex items-center justify-center text-text-secondary text-[8px] shrink-0">
                                N/A
                              </div>
                            )}
                            <span>{p.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 font-mono text-text-secondary text-[11px]">
                          {p.sku || p.barcode || p.internalCode || '-'}
                        </td>
                        <td className="py-2.5 text-right font-mono text-text-secondary">
                          ${p.cost || '0.00'}
                        </td>
                        <td className="py-2.5 text-right font-mono font-bold text-champagne-gold">
                          ${p.price || '0.00'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-charcoal-surface/50 border-t border-aged-bronze/20 flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setInspectingCategory(null)}
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Global Toast Container */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
};
