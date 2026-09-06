import React, { useState, useRef, useEffect } from 'react';
import {
  Download,
  Save,
  Upload,
  BookOpen,
  Eye,
  Plus,
  Sparkles,
  Sliders,
  ZoomIn,
  ZoomOut,
  FileCode,
  FileText,
  ChevronDown,
  Loader2,
  RotateCcw
} from 'lucide-react';
import type { MenuCatalog } from '../../types/menu';

interface EditorHeaderProps {
  catalog: MenuCatalog;
  activePageIndex: number; // -1 for cover, 0+ for sections, -99 for "view all"
  onPageChange: (index: number) => void;
  onAddSection: () => void;
  onLoadPreset: (presetKey: string) => void;
  onResetToDefaultCode?: () => void;
  onExportPDF: (format?: 'letter' | 'a4', singleOnly?: boolean) => void;
  onExportPNG: () => void;
  onSaveJSON: () => void;
  onLoadJSON: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenYamlModal: () => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  designerMode: boolean;
  onToggleDesignerMode: () => void;
  isGeneratingPdf?: boolean;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  catalog,
  activePageIndex,
  onPageChange,
  onAddSection,
  onLoadPreset,
  onResetToDefaultCode,
  onExportPDF,
  onExportPNG,
  onSaveJSON,
  onLoadJSON,
  onOpenYamlModal,
  zoom,
  onZoomChange,
  designerMode,
  onToggleDesignerMode,
  isGeneratingPdf = false
}) => {
  const [isPdfMenuOpen, setIsPdfMenuOpen] = useState(false);
  const pdfMenuRef = useRef<HTMLDivElement | null>(null);

  // Close PDF dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pdfMenuRef.current && !pdfMenuRef.current.contains(e.target as Node)) {
        setIsPdfMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  return (
    <header className="app-header bg-zinc-950 border-b border-zinc-800 text-zinc-100 sticky top-0 z-40 select-none shadow-md">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 gap-3 border-b border-zinc-800/80">
        {/* Brand Title & Preset Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold font-cormorant text-lg">
              C
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wider font-montserrat uppercase text-zinc-100 flex items-center gap-1.5">
                Cacharelo
                <span className="text-[10px] font-normal px-1.5 py-0.2 text-amber-400 bg-amber-500/10 rounded font-mono">
                  Menu Studio
                </span>
              </h1>
            </div>
          </div>

          <div className="h-5 w-[1px] bg-zinc-800 hidden sm:block" />

          {/* Preset Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-400 hidden md:inline">Plantilla:</span>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) onLoadPreset(e.target.value);
              }}
              className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-amber-500"
            >
              <option value="">Cargar Menú...</option>
              <option value="cacharelo">Cacharelo Carta Completa (18 Categorías)</option>
              <option value="burgers">Mr. Cacharelo Hamburguesas</option>
              <option value="pastes">Pastes y Empanadas</option>
              <option value="blank">+ Menú en Blanco</option>
            </select>

            {onResetToDefaultCode && (
              <button
                type="button"
                onClick={onResetToDefaultCode}
                title="Restablecer menú desde src/data/defaultMenu.ts (limpia la caché local de tu navegador)"
                className="flex items-center gap-1 px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/40 text-zinc-300 hover:text-amber-300 text-xs rounded-lg transition-colors font-medium"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden lg:inline">Recargar Código</span>
              </button>
            )}
          </div>
        </div>

        {/* Center: Mode Switch (Auto vs Designer) & Zoom */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleDesignerMode}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              designerMode
                ? 'bg-amber-600/20 text-amber-300 border border-amber-500/40 font-semibold'
                : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
            }`}
          >
            {designerMode ? <Sliders className="w-3.5 h-3.5 text-amber-400" /> : <Sparkles className="w-3.5 h-3.5 text-zinc-400" />}
            {designerMode ? 'Modo Diseñador (Activo)' : 'Modo Automático'}
          </button>

          {/* Zoom controls */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 text-xs text-zinc-300">
            <button
              type="button"
              onClick={() => onZoomChange(Math.max(0.4, zoom - 0.1))}
              title="Reducir zoom"
              className="p-1 hover:text-white rounded"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onZoomChange(0.7)}
              title="Ajustar"
              className="px-2 font-mono text-[11px] hover:text-amber-400"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => onZoomChange(Math.min(1.2, zoom + 0.1))}
              title="Aumentar zoom"
              className="p-1 hover:text-white rounded"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right: Export & File Actions */}
        <div className="flex items-center gap-2">
          {/* YAML Import / Export */}
          <button
            type="button"
            onClick={onOpenYamlModal}
            title="Importar / Exportar formato YAML"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-200 text-xs font-semibold rounded-lg transition-colors"
          >
            <FileCode className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">YAML</span>
          </button>

          {/* JSON Save & Load */}
          <button
            type="button"
            onClick={onSaveJSON}
            title="Guardar archivo de menú JSON"
            className="p-1.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 hover:text-white border border-zinc-800 rounded-lg text-xs transition-colors"
          >
            <Save className="w-4 h-4" />
          </button>

          <label
            title="Cargar archivo JSON"
            className="p-1.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 hover:text-white border border-zinc-800 rounded-lg text-xs cursor-pointer transition-colors"
          >
            <Upload className="w-4 h-4" />
            <input
              type="file"
              accept=".json"
              onChange={onLoadJSON}
              className="hidden"
            />
          </label>

          {/* Export PNG */}
          <button
            type="button"
            onClick={onExportPNG}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-850 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Exportar</span> PNG
          </button>

          {/* Digital PDF Export Dropdown */}
          <div className="relative" ref={pdfMenuRef}>
            <div className="flex items-center rounded-lg shadow-lg shadow-amber-950/50 bg-amber-600 hover:bg-amber-500 transition-all overflow-hidden">
              <button
                type="button"
                disabled={isGeneratingPdf}
                onClick={() => onExportPDF(catalog.theme.pageSize, false)}
                title={`Descargar Menú Completo Digital en formato ${catalog.theme.pageSize === 'a4' ? 'A4 (21.0 × 29.7 cm)' : 'Carta (21.6 × 27.9 cm)'}`}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-white text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isGeneratingPdf ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Generando...</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-3.5 h-3.5" />
                    <span>Descargar PDF Digital</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isGeneratingPdf}
                onClick={() => setIsPdfMenuOpen(!isPdfMenuOpen)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-black/15 border-l border-white/20 disabled:opacity-60 transition-colors"
                title="Opciones de formato (Carta / A4)"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Dropdown Menu */}
            {isPdfMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-zinc-900 border border-zinc-750 rounded-xl shadow-2xl p-1.5 z-50 text-xs animate-fade-in space-y-1">
                <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
                  Descarga Digital Directa (Sin Imprimir)
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsPdfMenuOpen(false);
                    onExportPDF('letter', false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-amber-600/20 hover:text-amber-300 text-zinc-200 transition-colors flex flex-col"
                >
                  <span className="font-semibold flex items-center gap-1.5">
                    📄 Menú Completo — Carta
                    {catalog.theme.pageSize === 'letter' && (
                      <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-mono">
                        Activo
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    21.6 × 27.9 cm (215.9 × 279.4 mm / 8.5 × 11 in)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsPdfMenuOpen(false);
                    onExportPDF('a4', false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-amber-600/20 hover:text-amber-300 text-zinc-200 transition-colors flex flex-col"
                >
                  <span className="font-semibold flex items-center gap-1.5">
                    📄 Menú Completo — A4
                    {catalog.theme.pageSize === 'a4' && (
                      <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-mono">
                        Activo
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    21.0 × 29.7 cm (210.0 × 297.0 mm)
                  </span>
                </button>

                <div className="h-[1px] bg-zinc-800 my-1" />

                <button
                  type="button"
                  onClick={() => {
                    setIsPdfMenuOpen(false);
                    onExportPDF('letter', true);
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 transition-colors flex flex-col"
                >
                  <span className="font-medium">
                    📑 Solo Página Actual — Carta (21.6 × 27.9 cm)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsPdfMenuOpen(false);
                    onExportPDF('a4', true);
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 transition-colors flex flex-col"
                >
                  <span className="font-medium">
                    📑 Solo Página Actual — A4 (21.0 × 29.7 cm)
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Bar: Page Tabs */}
      <div className="flex items-center px-4 py-1.5 gap-1.5 overflow-x-auto text-xs bg-zinc-900/50">
        <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold mr-1 shrink-0">
          Páginas:
        </span>

        {/* Cover Page Tab */}
        {catalog.cover.enabled && (
          <button
            type="button"
            onClick={() => onPageChange(-1)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md shrink-0 transition-colors ${
              activePageIndex === -1
                ? 'bg-amber-600 text-white font-medium shadow'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Portada
          </button>
        )}

        {/* Sections Tabs */}
        {catalog.sections.map((section, idx) => (
          <button
            key={section.id}
            type="button"
            onClick={() => onPageChange(idx)}
            className={`px-3 py-1 rounded-md shrink-0 font-medium transition-colors ${
              activePageIndex === idx
                ? 'bg-amber-600 text-white shadow'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            Pág {idx + 1}: {section.name || 'Sin nombre'}
          </button>
        ))}

        {/* Add Section Button */}
        <button
          type="button"
          onClick={onAddSection}
          className="flex items-center gap-1 px-2.5 py-1 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-md shrink-0 font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Nueva Página
        </button>

        <div className="ml-auto shrink-0 pl-2">
          {/* View All / Grid Preview */}
          <button
            type="button"
            onClick={() => onPageChange(-99)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
              activePageIndex === -99
                ? 'bg-zinc-800 text-amber-400 font-semibold border border-amber-500/40'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Ver Todas las Páginas
          </button>
        </div>
      </div>
    </header>
  );
};
