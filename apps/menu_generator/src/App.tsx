import React, { useState, useEffect, useRef } from 'react';
import { toPng } from 'html-to-image';
import {
  Layers,
  Store,
  Palette,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import type { MenuCatalog, MenuSection } from './types/menu';
import {
  CACHARELO_MENU_PRESET,
  MENU_PRESETS
} from './data/defaultMenu';
import { EditorHeader } from './components/editor/EditorHeader';
import { SectionEditor } from './components/editor/SectionEditor';
import { MenuInfoEditor } from './components/editor/MenuInfoEditor';
import { ThemeEditor } from './components/editor/ThemeEditor';
import { PagePreviewContainer } from './components/preview/PagePreviewContainer';
import { YamlModal } from './components/editor/YamlModal';
import { generateDigitalPdf } from './utils/pdfGenerator';

const STORAGE_KEY = 'cacharelo_menu_studio_v3';
const HASH_KEY = 'cacharelo_preset_code_hash_v1';

// Fast 32-bit hash to detect code changes in defaultMenu.ts
function getCatalogHash(data: any): string {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash * 33) ^ str.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

export function App() {
  const currentPresetHash = getCatalogHash(CACHARELO_MENU_PRESET);

  // Load initial catalog from localStorage or default preset
  const [catalog, setCatalog] = useState<MenuCatalog>(() => {
    try {
      const savedHash = localStorage.getItem(HASH_KEY);
      // If defaultMenu.ts was modified in source code, fresh code takes precedence!
      if (savedHash && savedHash !== currentPresetHash) {
        console.info('defaultMenu.ts has changed in source code! Loading fresh preset.');
        localStorage.setItem(HASH_KEY, currentPresetHash);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(CACHARELO_MENU_PRESET));
        return CACHARELO_MENU_PRESET;
      }

      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.sections && parsed.sections.length >= 10) {
          // Auto-migrate legacy cover to the new full-bleed gold standard
          if (!parsed.cover?.backgroundImage || parsed.cover.backgroundImage.includes('cacharelo-cover-ref') || parsed.cover.cardMode === 'floating-card') {
            parsed.cover = {
              ...CACHARELO_MENU_PRESET.cover,
              ...parsed.cover,
              backgroundImage: '/backgrounds/cafe-interior-cover.png',
              cardMode: 'full-bleed',
              title: '',
              subtitle: '',
              footer: 'DESAYUNOS  •  COMIDAS  •  CAFÉ  •  MOMENTOS',
              tagline: 'Aquí sabe mejor'
            };
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved menu catalog, using default', e);
    }
    try {
      localStorage.setItem(HASH_KEY, currentPresetHash);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(CACHARELO_MENU_PRESET));
    } catch {}
    return CACHARELO_MENU_PRESET;
  });

  // Active page: -1 is Cover, 0+ is Section index, -99 is View All Pages
  const [activePageIndex, setActivePageIndex] = useState<number>(-1);
  const [sidebarTab, setSidebarTab] = useState<'sections' | 'branding' | 'theme'>('sections');
  const [zoom, setZoom] = useState<number>(0.72);
  const [designerMode, setDesignerMode] = useState<boolean>(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [isYamlModalOpen, setIsYamlModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const previewRef = useRef<HTMLDivElement | null>(null);

  // Auto-save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog));
    } catch (e) {
      console.warn('Could not auto-save to localStorage', e);
    }
  }, [catalog]);

  // Hot-reload when defaultMenu.ts is modified in code during development
  useEffect(() => {
    try {
      const savedHash = localStorage.getItem(HASH_KEY);
      if (savedHash && savedHash !== currentPresetHash) {
        localStorage.setItem(HASH_KEY, currentPresetHash);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(CACHARELO_MENU_PRESET));
        setCatalog(CACHARELO_MENU_PRESET);
        showToast('Cambios detectados en src/data/defaultMenu.ts: Menú actualizado', 'info');
      }
    } catch (e) {
      console.warn('Hash check error', e);
    }
  }, [currentPresetHash]);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleResetToDefaultCode = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(HASH_KEY, currentPresetHash);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(CACHARELO_MENU_PRESET));
    } catch (e) {
      console.warn(e);
    }
    setCatalog(CACHARELO_MENU_PRESET);
    setActivePageIndex(0);
    showToast('Menú restablecido con éxito desde src/data/defaultMenu.ts');
  };

  // Section handlers
  const handleAddSection = () => {
    const newSection: MenuSection = {
      id: 'sec-' + Date.now(),
      name: 'NUEVA CATEGORÍA',
      subtitle: 'Descripción breve de la categoría',
      layoutTemplate: 'auto',
      dishes: [
        {
          id: 'dish-' + Date.now(),
          name: 'PLATILLO ESPECIAL',
          description: 'Ingredientes frescos y elaboración artesanal.',
          price: 160,
          imageMode: 'circle',
          imageTransform: { scale: 1, x: 0, y: 0, rotation: 0 }
        }
      ]
    };
    const newSections = [...catalog.sections, newSection];
    setCatalog({ ...catalog, sections: newSections });
    setActivePageIndex(newSections.length - 1);
    showToast('Nueva página agregada al catálogo');
  };

  const handleUpdateSection = (index: number, updated: MenuSection) => {
    const newSections = [...catalog.sections];
    newSections[index] = updated;
    setCatalog({ ...catalog, sections: newSections });
  };

  const handleDeleteSection = (index: number) => {
    if (catalog.sections.length <= 1) {
      showToast('El catálogo debe tener al menos una categoría', 'error');
      return;
    }
    const newSections = catalog.sections.filter((_, i) => i !== index);
    setCatalog({ ...catalog, sections: newSections });
    if (activePageIndex >= newSections.length) {
      setActivePageIndex(Math.max(0, newSections.length - 1));
    }
    showToast('Categoría eliminada');
  };

  const handleMoveSection = (from: number, to: number) => {
    if (to < 0 || to >= catalog.sections.length) return;
    const newSections = [...catalog.sections];
    const [moved] = newSections.splice(from, 1);
    newSections.splice(to, 0, moved);
    setCatalog({ ...catalog, sections: newSections });
    setActivePageIndex(to);
  };

  // Preset loader
  const handleLoadPreset = (key: string) => {
    if (key === 'blank') {
      const blankCatalog: MenuCatalog = {
        version: '1.0.0',
        id: 'menu-' + Date.now(),
        title: 'Nuevo Menú',
        restaurant: {
          name: 'Mi Restaurante',
          logo: '',
          slogan: 'Cocina & Sabor'
        },
        cover: {
          enabled: true,
          title: 'MENÚ',
          subtitle: 'Especialidades de la Casa',
          style: 'minimal-gold'
        },
        theme: CACHARELO_MENU_PRESET.theme,
        sections: [
          {
            id: 'sec-1',
            name: 'ESPECIALIDADES',
            subtitle: 'Selección del Chef',
            layoutTemplate: 'editorial-three',
            dishes: [
              {
                id: 'dish-1',
                name: 'PLATO ESTRELLA',
                description: 'Descripción de los ingredientes...',
                price: 180,
                imageMode: 'circle',
                imageTransform: { scale: 1, x: 0, y: 0, rotation: 0 }
              }
            ]
          }
        ]
      };
      setCatalog(blankCatalog);
      setActivePageIndex(0);
      showToast('Menú en blanco creado');
    } else if (MENU_PRESETS[key]) {
      setCatalog(MENU_PRESETS[key]);
      setActivePageIndex(0);
      showToast(`Plantilla "${MENU_PRESETS[key].title}" cargada`);
    }
  };

  // Direct High-Resolution Digital PDF Generator (Carta & A4)
  const handleExportPDF = async (targetSize?: 'letter' | 'a4', singleOnly = false) => {
    if (isGeneratingPdf) return;
    try {
      setIsGeneratingPdf(true);
      const chosenSize = targetSize || catalog.theme.pageSize || 'letter';
      const sizeLabel = chosenSize === 'a4' ? 'A4 (21.0 × 29.7 cm)' : 'Carta (21.6 × 27.9 cm)';
      const targetIndex = singleOnly
        ? (activePageIndex === -99 ? 0 : activePageIndex)
        : undefined;

      const pageDesc = targetIndex !== undefined
        ? (targetIndex === -1 ? 'Portada' : `Página ${targetIndex + 1}: ${catalog.sections[targetIndex]?.name || ''}`)
        : `Menú Completo (${catalog.sections.length + (catalog.cover.enabled ? 1 : 0)} páginas)`;

      showToast(`Generando PDF Digital ${sizeLabel} — ${pageDesc}...`, 'info');

      const res = await generateDigitalPdf({
        catalog,
        singlePageIndex: targetIndex,
        targetFormat: chosenSize,
        onProgress: (_cur, _tot, message) => {
          showToast(message, 'info');
        }
      });

      // Open digital PDF directly in new tab
      try {
        window.open(res.blobUrl, '_blank');
      } catch (e) {
        console.warn('Could not auto-open digital PDF tab', e);
      }

      showToast(`¡PDF digital generado y descargado (${res.filename})!`, 'success');
    } catch (err: any) {
      console.error('Failed to generate digital PDF', err);
      showToast(`Error al generar PDF: ${err?.message || err}`, 'error');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // High-Resolution PNG Export
  const handleExportPNG = async () => {
    try {
      showToast('Generando imagen de alta resolución...', 'info');

      // Target active page element or cover
      const targetElement = document.querySelector(
        activePageIndex === -99
          ? '.menu-page-container'
          : '#active-menu-page .menu-page'
      ) as HTMLElement;

      if (!targetElement) {
        showToast('No se encontró el elemento para exportar', 'error');
        return;
      }

      const dataUrl = await toPng(targetElement, {
        pixelRatio: 2.5, // Crisp 2.5x retina quality for printing
        quality: 0.98,
        backgroundColor: catalog.theme.pageBackground
      });

      const link = document.createElement('a');
      const pageName = activePageIndex === -1
        ? 'portada'
        : catalog.sections[activePageIndex]?.name.toLowerCase().replace(/\s+/g, '-') || 'pagina';
      link.download = `${catalog.restaurant.name.toLowerCase()}-menu-${pageName}.png`;
      link.href = dataUrl;
      link.click();

      showToast('¡Imagen PNG descargada con éxito!');
    } catch (err) {
      console.error('Failed to export PNG', err);
      showToast('Error al exportar imagen PNG', 'error');
    }
  };

  // JSON Import & Export
  const handleSaveJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(catalog, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${catalog.restaurant.name.toLowerCase()}-menu-config.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Configuración del menú descargada en JSON');
  };

  const handleLoadJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && parsed.sections && parsed.restaurant) {
          setCatalog(parsed);
          setActivePageIndex(0);
          showToast('Archivo JSON cargado correctamente');
        } else {
          showToast('Formato de archivo inválido', 'error');
        }
      } catch (err) {
        console.error('Error parsing JSON', err);
        showToast('Error al leer el archivo JSON', 'error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* Editor Top Navigation Header */}
      <EditorHeader
        catalog={catalog}
        activePageIndex={activePageIndex}
        onPageChange={(idx) => setActivePageIndex(idx)}
        onAddSection={handleAddSection}
        onLoadPreset={handleLoadPreset}
        onResetToDefaultCode={handleResetToDefaultCode}
        onExportPDF={handleExportPDF}
        onExportPNG={handleExportPNG}
        onSaveJSON={handleSaveJSON}
        onLoadJSON={handleLoadJSON}
        onOpenYamlModal={() => setIsYamlModalOpen(true)}
        zoom={zoom}
        onZoomChange={setZoom}
        designerMode={designerMode}
        onToggleDesignerMode={() => {
          setDesignerMode(!designerMode);
          showToast(designerMode ? 'Modo Automático activado' : 'Modo Diseñador activado');
        }}
        isGeneratingPdf={isGeneratingPdf}
      />

      {/* Main Workspace (Split: Editor Sidebar + Page Preview) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left Side: Interactive Editor Panels */}
        <aside className="editor-sidebar w-full lg:w-[480px] xl:w-[520px] bg-zinc-950 border-r border-zinc-800/80 flex flex-col shrink-0 overflow-hidden shadow-xl z-20">
          {/* Sidebar Tab Selector */}
          <div className="flex border-b border-zinc-800 bg-zinc-900/60 p-2 gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setSidebarTab('sections')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                sidebarTab === 'sections'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Categorías
            </button>

            <button
              type="button"
              onClick={() => setSidebarTab('branding')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                sidebarTab === 'branding'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              Restaurante
            </button>

            <button
              type="button"
              onClick={() => setSidebarTab('theme')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                sidebarTab === 'theme'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              Estilo & Tema
            </button>
          </div>

          {/* Sidebar Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* TAB 1: Sections & Dishes */}
            {sidebarTab === 'sections' && (
              <div className="space-y-4">
                {/* Active Section Quick Switcher Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  {catalog.sections.map((sec, idx) => (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => setActivePageIndex(idx)}
                      className={`px-3 py-1.5 rounded-lg shrink-0 font-medium transition-all ${
                        activePageIndex === idx
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                          : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {idx + 1}. {sec.name || 'Sin nombre'}
                    </button>
                  ))}
                </div>

                {/* Section Editor for Current Page */}
                {activePageIndex >= 0 && catalog.sections[activePageIndex] ? (
                  <SectionEditor
                    section={catalog.sections[activePageIndex]}
                    onChange={(updated) => handleUpdateSection(activePageIndex, updated)}
                    onDelete={() => handleDeleteSection(activePageIndex)}
                    canDelete={catalog.sections.length > 1}
                    onMoveUp={activePageIndex > 0 ? () => handleMoveSection(activePageIndex, activePageIndex - 1) : undefined}
                    onMoveDown={activePageIndex < catalog.sections.length - 1 ? () => handleMoveSection(activePageIndex, activePageIndex + 1) : undefined}
                  />
                ) : activePageIndex === -1 ? (
                  <div className="p-6 bg-zinc-900/60 border border-zinc-800 rounded-2xl text-center space-y-3">
                    <h4 className="text-sm font-semibold text-zinc-200 font-montserrat">
                      Editando la Portada
                    </h4>
                    <p className="text-xs text-zinc-400">
                      Puedes personalizar los textos, títulos y estilo de la portada en la pestaña "Restaurante".
                    </p>
                    <button
                      type="button"
                      onClick={() => setSidebarTab('branding')}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold transition-colors"
                    >
                      Ir a Configuración de Portada
                    </button>
                  </div>
                ) : (
                  <div className="p-6 bg-zinc-900/60 border border-zinc-800 rounded-2xl text-center space-y-3">
                    <h4 className="text-sm font-semibold text-zinc-200 font-montserrat">
                      Vista Completa de Páginas
                    </h4>
                    <p className="text-xs text-zinc-400">
                      Selecciona una categoría arriba para editar sus platillos y fotografías.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Restaurant Identity & Cover */}
            {sidebarTab === 'branding' && (
              <MenuInfoEditor
                restaurant={catalog.restaurant}
                cover={catalog.cover}
                onRestaurantChange={(updated) => setCatalog({ ...catalog, restaurant: updated })}
                onCoverChange={(updated) => setCatalog({ ...catalog, cover: updated })}
              />
            )}

            {/* TAB 3: Theme & Colors */}
            {sidebarTab === 'theme' && (
              <ThemeEditor
                theme={catalog.theme}
                onChange={(updated) => setCatalog({ ...catalog, theme: updated })}
              />
            )}
          </div>
        </aside>

        {/* Right Side: Zoomable Live Page Preview Container */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          <PagePreviewContainer
            catalog={catalog}
            activePageIndex={activePageIndex}
            zoom={zoom}
            containerRef={previewRef}
          />
        </main>
      </div>

      {/* Floating Toast Feedback */}
      {toastMessage && (
        <div className="toast-container fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-xl shadow-2xl animate-fade-in text-xs font-medium">
          {toastMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          ) : (
            <CheckCircle className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* YAML Import / Export Modal */}
      <YamlModal
        isOpen={isYamlModalOpen}
        onClose={() => setIsYamlModalOpen(false)}
        catalog={catalog}
        onImportYaml={(newCatalog) => {
          setCatalog(newCatalog);
          setActivePageIndex(0);
          showToast(`Menú YAML importado (${newCatalog.sections.length} categorías)`);
        }}
      />
    </div>
  );
}

export default App;
