import React, { useState } from 'react';
import {
  Plus,
  FileText,
  Trash2,
  MoveUp,
  MoveDown,
  LayoutGrid
} from 'lucide-react';
import type { MenuSection, Dish, LayoutTemplate } from '../../types/menu';
import { DishEditor } from './DishEditor';
import { QuickTextImportModal } from './QuickTextImportModal';

interface SectionEditorProps {
  section: MenuSection;
  onChange: (updated: MenuSection) => void;
  onDelete: () => void;
  canDelete: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export const SectionEditor: React.FC<SectionEditorProps> = ({
  section,
  onChange,
  onDelete,
  canDelete,
  onMoveUp,
  onMoveDown
}) => {
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);

  const handleDishChange = (index: number, updatedDish: Dish) => {
    const newDishes = [...section.dishes];
    newDishes[index] = updatedDish;
    onChange({ ...section, dishes: newDishes });
  };

  const handleAddDish = () => {
    const newDish: Dish = {
      id: 'dish-' + Date.now(),
      name: 'NUEVO PLATILLO',
      description: 'Descripción breve de los ingredientes...',
      price: 150,
      imageMode: 'transparent',
      imageTransform: { scale: 1, x: 0, y: 0, rotation: 0 }
    };
    onChange({
      ...section,
      dishes: [...section.dishes, newDish]
    });
  };

  const handleDeleteDish = (index: number) => {
    const newDishes = section.dishes.filter((_, i) => i !== index);
    onChange({ ...section, dishes: newDishes });
  };

  const handleDishMove = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= section.dishes.length) return;
    const newDishes = [...section.dishes];
    const [moved] = newDishes.splice(fromIndex, 1);
    newDishes.splice(toIndex, 0, moved);
    onChange({ ...section, dishes: newDishes });
  };

  const handleImportedText = (
    catName: string | undefined,
    catSubtitle: string | undefined,
    importedDishes: Dish[],
    mode: 'replace' | 'append' | 'new-section'
  ) => {
    if (mode === 'replace') {
      onChange({
        ...section,
        name: catName || section.name,
        subtitle: catSubtitle || section.subtitle,
        dishes: importedDishes
      });
    } else {
      onChange({
        ...section,
        name: section.name || catName || 'NUEVA SECCIÓN',
        subtitle: section.subtitle || catSubtitle,
        dishes: [...section.dishes, ...importedDishes]
      });
    }
  };

  return (
    <div className="bg-zinc-925 border border-zinc-800 rounded-2xl p-5 space-y-5">
      {/* Section Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800">
        <div className="flex-1">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-amber-500 mb-1">
            Nombre de la Categoría
          </label>
          <input
            type="text"
            value={section.name}
            onChange={(e) => onChange({ ...section, name: e.target.value })}
            placeholder="Ej. ENSALADAS"
            className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100 font-cormorant font-bold uppercase tracking-widest focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          {onMoveUp && (
            <button
              type="button"
              onClick={onMoveUp}
              title="Subir sección"
              className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <MoveUp className="w-4 h-4" />
            </button>
          )}
          {onMoveDown && (
            <button
              type="button"
              onClick={onMoveDown}
              title="Bajar sección"
              className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <MoveDown className="w-4 h-4" />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              title="Eliminar sección"
              className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors ml-1"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Subtitle & Layout Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">
            Subtítulo / Lema de la Categoría
          </label>
          <input
            type="text"
            value={section.subtitle || ''}
            onChange={(e) => onChange({ ...section, subtitle: e.target.value })}
            placeholder="Ej. Frescura en cada bocado..."
            className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-amber-500 font-baskerville italic"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1 flex items-center gap-1">
            <LayoutGrid className="w-3.5 h-3.5 text-amber-500" />
            Diseño Editorial de Página
          </label>
          <select
            value={section.layoutTemplate || 'auto'}
            onChange={(e) => onChange({ ...section, layoutTemplate: e.target.value as LayoutTemplate })}
            className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
          >
            <option value="auto">✨ Automático (Según número de platillos)</option>
            <option value="editorial-three">Editorial 3 Platillos (Estilo Cacharelo Escalonado)</option>
            <option value="diagonal-two">Diagonal Alternado (2 Platillos)</option>
            <option value="hero-one">Hero Especialidad (1 Platillo Destacado)</option>
            <option value="editorial-four">Editorial Cuatro (4 Platillos)</option>
            <option value="dense-list">Lista Completa / Desayunos (5+ Platillos)</option>
          </select>
        </div>
      </div>

      {/* Kicker & Decorative Quote Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
        <div>
          <label className="block text-[11px] font-medium text-zinc-400 mb-1">
            Kicker Superior (Tracking Amplio)
          </label>
          <input
            type="text"
            value={section.kicker || ''}
            onChange={(e) => onChange({ ...section, kicker: e.target.value })}
            placeholder="NUESTRA COCINA, TU MOMENTO"
            className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-amber-500 font-montserrat uppercase tracking-wider"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-zinc-400 mb-1">
            Frase Decorativa Inclinada (Quote)
          </label>
          <input
            type="text"
            value={section.quote || ''}
            onChange={(e) => onChange({ ...section, quote: e.target.value })}
            placeholder="“Comer bien también es un placer”"
            className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-amber-500 font-cormorant italic text-[13px]"
          />
        </div>
      </div>

      {/* Action Bar: Quick Text Import + Add Dish */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800/80">
        <span className="text-xs font-medium text-zinc-400">
          Platillos en esta categoría ({section.dishes.length})
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            Importar Texto Rápido
          </button>

          <button
            type="button"
            onClick={handleAddDish}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg shadow transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar Platillo
          </button>
        </div>
      </div>

      {/* Dishes List */}
      <div className="space-y-3">
        {section.dishes.length === 0 ? (
          <div className="p-8 text-center border-2 border-dashed border-zinc-800 rounded-xl">
            <p className="text-xs text-zinc-500 mb-3">
              Esta categoría aún no tiene platillos.
            </p>
            <button
              type="button"
              onClick={handleAddDish}
              className="px-4 py-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 transition-all"
            >
              + Agregar el primer platillo
            </button>
          </div>
        ) : (
          section.dishes.map((dish, index) => (
            <div key={dish.id} className="relative group/dish">
              {/* Dish Reorder Buttons */}
              <div className="absolute right-2 top-2 z-10 hidden group-hover/dish:flex items-center gap-1 bg-zinc-800/90 rounded-md p-0.5 border border-zinc-700">
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => handleDishMove(index, index - 1)}
                    className="p-1 text-zinc-300 hover:text-white"
                    title="Subir"
                  >
                    <MoveUp className="w-3 h-3" />
                  </button>
                )}
                {index < section.dishes.length - 1 && (
                  <button
                    type="button"
                    onClick={() => handleDishMove(index, index + 1)}
                    className="p-1 text-zinc-300 hover:text-white"
                    title="Bajar"
                  >
                    <MoveDown className="w-3 h-3" />
                  </button>
                )}
              </div>

              <DishEditor
                dish={dish}
                onChange={(updated) => handleDishChange(index, updated)}
                onDelete={() => handleDeleteDish(index)}
                isExpandedDefault={index === 0 && section.dishes.length === 1}
              />
            </div>
          ))
        )}
      </div>

      {/* Quick Text Import Modal */}
      <QuickTextImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportedText}
      />
    </div>
  );
};
