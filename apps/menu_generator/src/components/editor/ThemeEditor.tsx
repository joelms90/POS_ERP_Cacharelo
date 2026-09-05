import React from 'react';
import type { MenuTheme } from '../../types/menu';
import { Palette, Type, Disc, FileSpreadsheet } from 'lucide-react';

interface ThemeEditorProps {
  theme: MenuTheme;
  onChange: (updated: MenuTheme) => void;
}

const COLOR_PRESETS = [
  { name: 'Cacharelo Imperial (Crema & Oro)', bg: '#FAF7F2', text: '#2D2926', accent: '#C8A265', border: '#C8A265' },
  { name: 'Lino Cálido & Oro Vintage', bg: '#F5EFEB', text: '#2D2926', accent: '#C8A265', border: '#C8A265' },
  { name: 'Blanco Estudio Minimalista', bg: '#FFFFFF', text: '#111827', accent: '#C8A265', border: '#2D2926' },
  { name: 'Obsidian Dark Luxury', bg: '#18181B', text: '#F4F4F5', accent: '#D4AF37', border: '#52525B' }
];

export const ThemeEditor: React.FC<ThemeEditorProps> = ({ theme, onChange }) => {
  return (
    <div className="bg-zinc-925 border border-zinc-800 rounded-2xl p-5 space-y-6">
      <div className="flex items-center gap-2 pb-3 border-b border-zinc-800">
        <Palette className="w-4 h-4 text-amber-500" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-100 font-montserrat">
          Estilo & Tema Editorial
        </h3>
      </div>

      {/* Color Palettes */}
      <div>
        <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">
          Paletas de Color Prediseñadas
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {COLOR_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                onChange({
                  ...theme,
                  pageBackground: preset.bg,
                  textColor: preset.text,
                  accentColor: preset.accent,
                  borderColor: preset.border
                });
              }}
              className="flex items-center gap-3 p-2.5 rounded-xl border border-zinc-800 hover:border-zinc-700 bg-zinc-900/60 text-left transition-all group"
            >
              {/* Color Swatch Circles */}
              <div className="flex -space-x-1.5 shrink-0">
                <span
                  className="w-5 h-5 rounded-full border border-black/20"
                  style={{ backgroundColor: preset.bg }}
                />
                <span
                  className="w-5 h-5 rounded-full border border-black/20"
                  style={{ backgroundColor: preset.accent }}
                />
                <span
                  className="w-5 h-5 rounded-full border border-black/20"
                  style={{ backgroundColor: preset.text }}
                />
              </div>

              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-zinc-200 block truncate group-hover:text-amber-400 transition-colors">
                  {preset.name}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Manual Colors */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-[11px] text-zinc-400 mb-1">Fondo de Página</label>
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg p-1.5">
            <input
              type="color"
              value={theme.pageBackground}
              onChange={(e) => onChange({ ...theme, pageBackground: e.target.value })}
              className="w-6 h-6 rounded border-0 cursor-pointer bg-transparent"
            />
            <span className="text-xs font-mono text-zinc-300">{theme.pageBackground}</span>
          </div>
        </div>

        <div>
          <label className="block text-[11px] text-zinc-400 mb-1">Color de Acento (Oro)</label>
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg p-1.5">
            <input
              type="color"
              value={theme.accentColor}
              onChange={(e) => onChange({ ...theme, accentColor: e.target.value })}
              className="w-6 h-6 rounded border-0 cursor-pointer bg-transparent"
            />
            <span className="text-xs font-mono text-zinc-300">{theme.accentColor}</span>
          </div>
        </div>

        <div>
          <label className="block text-[11px] text-zinc-400 mb-1">Color de Texto</label>
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg p-1.5">
            <input
              type="color"
              value={theme.textColor}
              onChange={(e) => onChange({ ...theme, textColor: e.target.value })}
              className="w-6 h-6 rounded border-0 cursor-pointer bg-transparent"
            />
            <span className="text-xs font-mono text-zinc-300">{theme.textColor}</span>
          </div>
        </div>

        <div>
          <label className="block text-[11px] text-zinc-400 mb-1">Borde / Línea Punteada</label>
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg p-1.5">
            <input
              type="color"
              value={theme.borderColor}
              onChange={(e) => onChange({ ...theme, borderColor: e.target.value })}
              className="w-6 h-6 rounded border-0 cursor-pointer bg-transparent"
            />
            <span className="text-xs font-mono text-zinc-300">{theme.borderColor}</span>
          </div>
        </div>
      </div>

      {/* Typography Selector */}
      <div>
        <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide flex items-center gap-1.5">
          <Type className="w-3.5 h-3.5 text-amber-500" />
          Tipografías del Catálogo
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <span className="text-[11px] text-zinc-400 block mb-1">Titulares & Categorías:</span>
            <select
              value={theme.headingFont}
              onChange={(e) => onChange({ ...theme, headingFont: e.target.value as any })}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
            >
              <option value="cormorant">Cormorant Garamond (Elegante Clásica)</option>
              <option value="playfair">Playfair Display (Editorial Contemporánea)</option>
              <option value="cinzel">Cinzel (Imperial / Monumental)</option>
              <option value="baskerville">Libre Baskerville (Tradicional)</option>
              <option value="montserrat">Montserrat (Moderna Geométrica)</option>
            </select>
          </div>

          <div>
            <span className="text-[11px] text-zinc-400 block mb-1">Descripciones & Detalles:</span>
            <select
              value={theme.bodyFont}
              onChange={(e) => onChange({ ...theme, bodyFont: e.target.value as any })}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
            >
              <option value="baskerville">Libre Baskerville (Serif Fácil Lectura)</option>
              <option value="inter">Inter (Sans-serif Ultra Limpia)</option>
              <option value="montserrat">Montserrat (Sans-serif Elegante)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Backdrop Style of the Dish Photo */}
      <div>
        <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide flex items-center gap-1.5">
          <Disc className="w-3.5 h-3.5 text-amber-500" />
          Fondo de Respaldo de los Platillos (Spotlight Disc)
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { id: 'black-circle', label: 'Círculo Negro Clásico (Referencia)' },
            { id: 'white-ring', label: 'Aro Dorado Resaltado' },
            { id: 'soft-shadow', label: 'Sombra Suave Flotante' },
            { id: 'none', label: 'Sin Respaldo' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange({ ...theme, dishBackdrop: item.id as any })}
              className={`p-2.5 rounded-xl border text-xs font-medium text-center transition-all ${
                theme.dishBackdrop === item.id
                  ? 'bg-amber-600/20 border-amber-500 text-amber-300 font-semibold'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Format & Printing Dimensions */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-zinc-800">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-zinc-400" />
          <span className="text-xs text-zinc-300 font-medium">Tamaño de Impresión:</span>
          <select
            value={theme.pageSize}
            onChange={(e) => onChange({ ...theme, pageSize: e.target.value as any })}
            className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
          >
            <option value="letter">Carta (21.6 × 27.9 cm / 215.9 × 279.4 mm / 8.5 × 11 in)</option>
            <option value="a4">A4 (21.0 × 29.7 cm / 210.0 × 297.0 mm)</option>
          </select>
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={theme.showPageNumbers}
            onChange={(e) => onChange({ ...theme, showPageNumbers: e.target.checked })}
            className="w-3.5 h-3.5 rounded bg-zinc-800 border-zinc-700 text-amber-600 focus:ring-0 cursor-pointer"
          />
          <span>Mostrar Números de Página</span>
        </label>
      </div>
    </div>
  );
};
