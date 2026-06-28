import React, { useState, useEffect } from 'react';
import { api, Category, Product } from '../services/api';
import { Heading } from '../components/atoms/Heading';
import { Button } from '../components/atoms/Button';
import { Input } from '../components/atoms/Input';
import { FormField } from '../components/molecules/FormField';

interface CategoriesPageProps {
  businessId: string;
}

export const CategoriesPage: React.FC<CategoriesPageProps> = ({ businessId }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [cats, prods] = await Promise.all([
        api.getCategories(businessId),
        api.getProducts(businessId),
      ]);
      setCategories(cats);
      setProducts(prods);
    } catch (err: any) {
      console.error(err);
      setError('Error al cargar categorías. Verifique su conexión.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [businessId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 2) return;

    setIsSaving(true);
    try {
      const savedCategory = await api.addCategory({
        name: name.trim(),
        description: description.trim() || undefined,
      }, businessId);
      setCategories((prev) => [...prev, savedCategory]);
      setName('');
      setDescription('');
    } catch (err: any) {
      alert(err.message || 'Error al crear la categoría.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const productsInCat = products.filter((p) => p.categoryId === id);
    if (productsInCat.length > 0) {
      alert(`No se puede eliminar la categoría "${name}" porque contiene ${productsInCat.length} producto(s) asignado(s).`);
      return;
    }

    if (confirm(`¿Está seguro de que desea eliminar la categoría "${name}"?`)) {
      try {
        await api.deleteCategory(id);
        setCategories(categories.filter((c) => c.id !== id));
      } catch (err: any) {
        alert(err.message || 'No se pudo eliminar la categoría.');
      }
    }
  };

  return (
    <div className="w-full lg:h-full min-h-full bg-obsidian p-2 lg:p-6 font-sans overflow-y-auto lg:overflow-hidden">
      <div className="flex flex-col lg:flex-row gap-6 min-h-fit lg:h-full max-w-7xl mx-auto w-full">
        
        {/* Left Side: Categories List */}
        <div className="flex-1 bg-onyx-surface border border-aged-bronze/40 rounded-lg p-4 lg:p-6 flex flex-col lg:h-full overflow-hidden shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <Heading level={2} className="!text-lg sm:!text-2xl !border-none !pb-0 text-champagne-gold tracking-wide font-light">
              Categorías de Catálogo
            </Heading>
            <span className="text-xs text-text-secondary">
              Total: {categories.length}
            </span>
          </div>

          {error && (
            <div className="bg-error-red/10 border border-error-red/30 text-error-red rounded p-3 text-xs mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <svg className="animate-spin h-6 w-6 text-champagne-gold" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : categories.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-text-secondary text-xs py-12">
              <svg className="w-12 h-12 text-aged-bronze/50 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 7h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>No hay categorías registradas en el catálogo.</span>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto border border-aged-bronze/20 rounded-md">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-charcoal-surface border-b border-aged-bronze/30 text-text-secondary uppercase tracking-wider text-[10px]">
                    <th className="p-4 font-semibold">Nombre</th>
                    <th className="p-4 font-semibold">Descripción</th>
                    <th className="p-4 font-semibold text-center">Artículos</th>
                    <th className="p-4 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-aged-bronze/10">
                  {categories.map((c) => {
                    const count = products.filter((p) => p.categoryId === c.id).length;
                    return (
                      <tr key={c.id} className="hover:bg-charcoal-surface/30 transition-colors">
                        <td className="p-4 font-medium text-text-primary">{c.name}</td>
                        <td className="p-4 text-text-secondary max-w-xs truncate" title={c.description || ''}>
                          {c.description || '-'}
                        </td>
                        <td className="p-4 text-center font-mono text-text-secondary">{count}</td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleDelete(c.id, c.name)}
                            className="text-error-red hover:text-error-red/80 transition-colors p-1"
                            title="Eliminar"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Side: Form Card */}
        <div className="w-full lg:w-96 bg-onyx-surface border border-aged-bronze/40 rounded-lg p-6 flex flex-col lg:h-full lg:overflow-y-auto shadow-xl flex-shrink-0">
          <Heading level={3} className="!border-none !pb-0 text-champagne-gold tracking-wide font-light mb-6">
            Registrar Categoría
          </Heading>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <FormField label="Nombre de Categoría" required>
              <Input
                type="text"
                placeholder="Ej. Bebidas calientes"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </FormField>

            <FormField label="Descripción / Detalle">
              <textarea
                placeholder="Detalle opcional..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-charcoal-surface border border-aged-bronze focus:border-champagne-gold text-text-primary rounded-md p-3 font-sans text-xs focus:outline-none transition-all resize-none"
              />
            </FormField>

            <div className="flex gap-3 mt-4">
              <Button type="submit" variant="primary" className="flex-1" disabled={isSaving || !name.trim()}>
                {isSaving ? 'Registrando...' : 'Registrar'}
              </Button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
};
