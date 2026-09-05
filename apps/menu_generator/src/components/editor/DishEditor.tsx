import React, { useState } from 'react';
import {
  Trash2,
  Sparkles,
  RotateCcw,
  Sliders,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Upload
} from 'lucide-react';
import type { Dish, ImageMode } from '../../types/menu';
import { readFileAsDataURL } from '../../utils/imageProcessing';
import { BackgroundRemovalModal } from './BackgroundRemovalModal';

interface DishEditorProps {
  dish: Dish;
  onChange: (updated: Dish) => void;
  onDelete: () => void;
  isExpandedDefault?: boolean;
}

const SAMPLE_DISH_IMAGES = [
  { label: 'Ensalada Caprese (Platón Cerámico)', url: '/dishes/caprese_plate.png' },
  { label: 'Ensalada César Sola (Plato Hondo)', url: '/dishes/cesar_salad.png' },
  { label: 'Ensalada César Pollo Parrilla', url: '/dishes/cesar_pollo.png' },
  { label: 'Huevos al Gusto (Tabla Madera)', url: '/dishes/huevos_board.png' },
  { label: 'Bowl de Frutas Frescas', url: '/dishes/fruta_bowl.png' },
  { label: 'Croissant Hojaldrado Mantequilla', url: '/dishes/croissant.png' },
  { label: 'Sandwich Artesanal en Focaccia', url: '/dishes/sandwich.png' },
  { label: 'Bagel con Salmón Ahumado', url: '/dishes/bagel.png' },
  { label: 'Wafles Belgas Nutella', url: '/dishes/wafles.png' },
  { label: 'Focaccia Italiana Tradicional', url: '/dishes/foccacia.png' },
];

export const DishEditor: React.FC<DishEditorProps> = ({
  dish,
  onChange,
  onDelete,
  isExpandedDefault = false
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(isExpandedDefault);
  const [isBgModalOpen, setIsBgModalOpen] = useState<boolean>(false);
  const [showTransformControls, setShowTransformControls] = useState<boolean>(false);

  const transform = dish.imageTransform || { scale: 1, x: 0, y: 0, rotation: 0 };
  const mode = dish.imageMode || 'transparent';

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataURL(file);
      onChange({
        ...dish,
        image: dataUrl,
        imageProcessed: undefined // Reset processed image when new image uploaded
      });
    } catch (err) {
      console.error('Failed to read uploaded image', err);
    }
  };

  const handleModeChange = (newMode: ImageMode) => {
    onChange({
      ...dish,
      imageMode: newMode
    });
  };

  const updateTransform = (key: keyof typeof transform, value: number) => {
    onChange({
      ...dish,
      imageTransform: {
        ...transform,
        [key]: value
      }
    });
  };

  const resetTransform = () => {
    onChange({
      ...dish,
      imageTransform: { scale: 1, x: 0, y: 0, rotation: 0 }
    });
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden transition-all">
      {/* Dish Summary Bar (Clickable header) */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-zinc-850 select-none"
      >
        <div className="flex items-center gap-3">
          {/* Thumbnail preview */}
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0">
            {(dish.imageProcessed || dish.image) ? (
              <img
                src={dish.imageProcessed || dish.image}
                alt={dish.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <ImageIcon className="w-4 h-4 text-zinc-600" />
            )}
          </div>

          <div>
            <span className="text-sm font-semibold text-zinc-200 block font-cormorant tracking-wide">
              {dish.name || 'Platillo sin nombre'}
            </span>
            <span className="text-xs font-mono text-amber-400 font-medium">
              ${dish.price || 0}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {dish.featured && (
            <span className="text-[10px] uppercase font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">
              Destacado
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-zinc-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          )}
        </div>
      </div>

      {/* Expanded Edit Form */}
      {isExpanded && (
        <div className="p-4 border-t border-zinc-800 space-y-4 bg-zinc-950/40">
          {/* Row 1: Name & Price */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Nombre del Platillo
              </label>
              <input
                type="text"
                value={dish.name}
                onChange={(e) => onChange({ ...dish, name: e.target.value })}
                placeholder="Ej. CAPRESSE"
                className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-amber-500 font-cormorant font-bold uppercase tracking-wider"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Precio ($)
              </label>
              <input
                type="number"
                value={dish.price || ''}
                onChange={(e) => onChange({ ...dish, price: parseFloat(e.target.value) || 0 })}
                placeholder="177"
                className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-amber-500 font-mono font-bold"
              />
            </div>
          </div>

          {/* Row 2: Description */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Descripción del Platillo
            </label>
            <textarea
              value={dish.description || ''}
              onChange={(e) => onChange({ ...dish, description: e.target.value })}
              placeholder="Ingredientes, preparación y maridaje sugerido..."
              rows={2}
              className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-amber-500 resize-none font-baskerville leading-relaxed"
            />
          </div>

          {/* Row 3: Photo Management & Mode Controls */}
          <div className="bg-zinc-900/80 p-3.5 rounded-xl border border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                Fotografía del Platillo
              </span>

              {dish.image && (
                <button
                  type="button"
                  onClick={() => setIsBgModalOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 rounded-lg transition-all"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  Eliminar Fondo IA
                </button>
              )}
            </div>

            {/* Image Preview & Upload Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              {/* Thumbnail Display */}
              <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800 shrink-0 flex items-center justify-center group">
                {(dish.imageProcessed || dish.image) ? (
                  <>
                    <img
                      src={dish.imageProcessed || dish.image}
                      alt={dish.name}
                      className="w-full h-full object-cover"
                    />
                    {dish.imageProcessed && (
                      <span className="absolute bottom-0 inset-x-0 bg-amber-600/90 text-[8px] font-bold text-center text-white py-0.5">
                        Sin Fondo
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-[10px] text-zinc-600 text-center px-1">Sin foto</span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex-1 w-full space-y-2">
                <div className="flex gap-2">
                  <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs font-medium rounded-lg cursor-pointer border border-zinc-700 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    Subir Foto
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>

                  {dish.image && (
                    <button
                      type="button"
                      onClick={() => onChange({ ...dish, image: undefined, imageProcessed: undefined })}
                      className="px-2.5 py-1.5 bg-zinc-800 hover:bg-red-500/20 hover:text-red-300 text-zinc-400 text-xs rounded-lg transition-colors"
                      title="Quitar foto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Quick select from sample library */}
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      onChange({
                        ...dish,
                        image: e.target.value,
                        imageProcessed: undefined
                      });
                    }
                  }}
                  className="w-full px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-[11px] text-zinc-400 focus:outline-none focus:border-amber-500"
                >
                  <option value="">O elige una foto del catálogo...</option>
                  {SAMPLE_DISH_IMAGES.map((sample, idx) => (
                    <option key={idx} value={sample.url}>
                      {sample.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Image Mode Buttons */}
            {dish.image && (
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1.5 font-medium">
                  Modo de Presentación:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {(['circle', 'transparent', 'soft-edge', 'ellipse', 'original'] as ImageMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleModeChange(m)}
                      className={`px-2 py-1 rounded text-[10px] font-medium uppercase tracking-wider transition-all ${
                        mode === m
                          ? 'bg-amber-600 text-white font-bold shadow'
                          : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {m === 'circle'
                        ? 'Círculo'
                        : m === 'transparent'
                        ? 'Transparente'
                        : m === 'soft-edge'
                        ? 'Difuminado'
                        : m === 'ellipse'
                        ? 'Elipse'
                        : 'Original'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Transform Controls (Scale, X, Y, Rotation) */}
            {dish.image && (
              <div className="pt-2 border-t border-zinc-800/60">
                <button
                  type="button"
                  onClick={() => setShowTransformControls(!showTransformControls)}
                  className="flex items-center justify-between w-full text-xs text-zinc-400 hover:text-zinc-200"
                >
                  <span className="flex items-center gap-1">
                    <Sliders className="w-3 h-3 text-amber-400" />
                    Ajustar Posición, Escala y Rotación
                  </span>
                  <span className="text-[10px] font-mono text-amber-500">
                    {showTransformControls ? 'Ocultar' : 'Ajustar'}
                  </span>
                </button>

                {showTransformControls && (
                  <div className="mt-3 p-3 bg-zinc-950 rounded-lg space-y-2.5 text-xs">
                    {/* Scale */}
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-zinc-400 w-16">Escala:</span>
                      <input
                        type="range"
                        min="0.6"
                        max="1.8"
                        step="0.05"
                        value={transform.scale}
                        onChange={(e) => updateTransform('scale', parseFloat(e.target.value))}
                        className="flex-1 h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500"
                      />
                      <span className="font-mono text-amber-400 w-12 text-right">
                        {transform.scale.toFixed(2)}x
                      </span>
                    </div>

                    {/* Offset X */}
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-zinc-400 w-16">Eje X:</span>
                      <input
                        type="range"
                        min="-80"
                        max="80"
                        step="2"
                        value={transform.x}
                        onChange={(e) => updateTransform('x', parseInt(e.target.value))}
                        className="flex-1 h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500"
                      />
                      <span className="font-mono text-amber-400 w-12 text-right">
                        {transform.x}px
                      </span>
                    </div>

                    {/* Offset Y */}
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-zinc-400 w-16">Eje Y:</span>
                      <input
                        type="range"
                        min="-80"
                        max="80"
                        step="2"
                        value={transform.y}
                        onChange={(e) => updateTransform('y', parseInt(e.target.value))}
                        className="flex-1 h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500"
                      />
                      <span className="font-mono text-amber-400 w-12 text-right">
                        {transform.y}px
                      </span>
                    </div>

                    {/* Rotation */}
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-zinc-400 w-16">Rotación:</span>
                      <input
                        type="range"
                        min="-35"
                        max="35"
                        step="1"
                        value={transform.rotation}
                        onChange={(e) => updateTransform('rotation', parseInt(e.target.value))}
                        className="flex-1 h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500"
                      />
                      <span className="font-mono text-amber-400 w-12 text-right">
                        {transform.rotation}°
                      </span>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={resetTransform}
                        className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Restablecer Posición
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Row 4: Options & Delete */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={dish.featured || false}
                onChange={(e) => onChange({ ...dish, featured: e.target.checked })}
                className="w-3.5 h-3.5 rounded bg-zinc-800 border-zinc-700 text-amber-600 focus:ring-0 cursor-pointer"
              />
              <span>Marcar como Destacado</span>
            </label>

            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Eliminar Platillo
            </button>
          </div>
        </div>
      )}

      {/* Background Removal Modal */}
      {dish.image && (
        <BackgroundRemovalModal
          isOpen={isBgModalOpen}
          onClose={() => setIsBgModalOpen(false)}
          originalImage={dish.image}
          onApply={(processedUrl) => {
            onChange({
              ...dish,
              imageProcessed: processedUrl,
              imageMode: 'transparent'
            });
          }}
        />
      )}
    </div>
  );
};
