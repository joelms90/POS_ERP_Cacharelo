import React, { useState, useMemo } from 'react';
import { X, FileText, Plus, Check } from 'lucide-react';
import { parseRawMenuText } from '../../utils/textParser';
import type { Dish } from '../../types/menu';

interface QuickTextImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (categoryName: string | undefined, categorySubtitle: string | undefined, dishes: Dish[], mode: 'replace' | 'append' | 'new-section') => void;
}

const SAMPLE_PASTE = `ENSALADAS
Frescura en cada bocado

CAPRESSE
Rodajas de jitomate y queso mozzarella fresco marinadas con vinagre balsámico y nuestra mezcla italiana.
177

CESAR
Lechuga aderezada acompañada de croutones, huevo cocido y queso parmesano rallado.
162

CESAR CON POLLO
Nuestra clásica ensalada César coronada con pechuga de pollo a la parrilla marinada en finas hierbas.
189`;

export const QuickTextImportModal: React.FC<QuickTextImportModalProps> = ({
  isOpen,
  onClose,
  onImport
}) => {
  const [rawText, setRawText] = useState<string>(SAMPLE_PASTE);

  const parsed = useMemo(() => {
    return parseRawMenuText(rawText);
  }, [rawText]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl bg-zinc-900 border border-zinc-750 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-100 font-montserrat">
                Importador Rápido de Texto
              </h3>
              <p className="text-xs text-zinc-400">
                Pega tu lista desde WhatsApp, Word o notas. El sistema detecta nombres, descripciones y precios automáticamente.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area: Two Columns */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 p-6 overflow-y-auto">
          {/* Left Column: Input Textarea */}
          <div className="flex flex-col">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Texto Copiado
              </label>
              <button
                type="button"
                onClick={() => setRawText(SAMPLE_PASTE)}
                className="text-[11px] text-amber-400 hover:underline"
              >
                Cargar Ejemplo
              </button>
            </div>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Pega aquí el texto..."
              rows={14}
              className="w-full flex-1 p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 font-mono focus:outline-none focus:border-amber-500 transition-colors resize-none leading-relaxed"
            />
            <p className="text-[11px] text-zinc-500 mt-2">
              Tip: Puedes separar platillos con líneas en blanco o simplemente incluir el precio (ej. 177 o $177).
            </p>
          </div>

          {/* Right Column: Live Detection Preview */}
          <div className="flex flex-col bg-zinc-950/70 border border-zinc-800 rounded-xl p-4 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                Vista Previa Detectada ({parsed.dishes.length} platillos)
              </span>
            </div>

            {/* Category header detection */}
            {parsed.categoryName && (
              <div className="mb-3 p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                <span className="text-[10px] text-zinc-500 uppercase font-mono block">Categoría Detectada</span>
                <span className="text-sm font-bold text-amber-300 font-cormorant tracking-wide">
                  {parsed.categoryName}
                </span>
                {parsed.categorySubtitle && (
                  <span className="text-xs text-zinc-400 block italic mt-0.5">
                    {parsed.categorySubtitle}
                  </span>
                )}
              </div>
            )}

            {/* Dishes list */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {parsed.dishes.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-zinc-500 italic p-6 text-center">
                  Escribe o pega texto en el panel izquierdo para ver los platillos detectados.
                </div>
              ) : (
                parsed.dishes.map((dish, i) => (
                  <div
                    key={i}
                    className="p-2.5 bg-zinc-900/90 border border-zinc-800 rounded-lg text-xs hover:border-zinc-700 transition-all"
                  >
                    <div className="flex items-center justify-between font-medium">
                      <span className="text-zinc-200 font-semibold">{dish.name}</span>
                      <span className="text-amber-400 font-mono font-bold">${dish.price}</span>
                    </div>
                    {dish.description && (
                      <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                        {dish.description}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-950/80">
          <span className="text-xs text-zinc-400">
            {parsed.dishes.length} platillos listos para importar
          </span>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                onImport(parsed.categoryName, parsed.categorySubtitle, parsed.dishes, 'append');
                onClose();
              }}
              disabled={parsed.dishes.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-zinc-200 bg-zinc-800 hover:bg-zinc-750 disabled:opacity-40 rounded-xl transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Añadir a Sección Actual
            </button>
            <button
              onClick={() => {
                onImport(parsed.categoryName, parsed.categorySubtitle, parsed.dishes, 'new-section');
                onClose();
              }}
              disabled={parsed.dishes.length === 0}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-40 rounded-xl shadow-lg shadow-amber-950/50 transition-all"
            >
              <Check className="w-4 h-4" />
              Crear Nueva Sección
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
