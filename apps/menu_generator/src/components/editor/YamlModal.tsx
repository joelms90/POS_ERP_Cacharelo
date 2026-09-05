import React, { useState, useEffect } from 'react';
import { X, FileCode, Check, Copy, Download, Upload } from 'lucide-react';
import { exportMenuToYaml, parseMenuYaml } from '../../utils/yamlMenuParser';
import type { MenuCatalog } from '../../types/menu';

interface YamlModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalog: MenuCatalog;
  onImportYaml: (newCatalog: MenuCatalog) => void;
}

export const YamlModal: React.FC<YamlModalProps> = ({
  isOpen,
  onClose,
  catalog,
  onImportYaml
}) => {
  const [yamlText, setYamlText] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      try {
        const exported = exportMenuToYaml(catalog);
        setYamlText(exported);
        setErrorMsg(null);
      } catch (err: any) {
        setErrorMsg('Error al serializar el menú a YAML: ' + err.message);
      }
    }
  }, [isOpen, catalog]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(yamlText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([yamlText], { type: 'text/yaml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${catalog.restaurant.name.toLowerCase()}-menu.yaml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    try {
      setErrorMsg(null);
      const parsedCatalog = parseMenuYaml(yamlText, catalog);
      onImportYaml(parsedCatalog);
      onClose();
    } catch (err: any) {
      setErrorMsg('Error al procesar el archivo YAML: ' + (err.message || String(err)));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setYamlText(content);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl bg-zinc-925 border border-zinc-750 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100 font-montserrat flex items-center gap-2">
                Editor & Sincronización YAML
                <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-500/15 text-amber-300 rounded">
                  menu.yaml
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                Pega tu estructura de menú o descarga el catálogo actual en formato YAML limpio y editable.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error notification banner */}
        {errorMsg && (
          <div className="px-6 py-2.5 bg-red-950/60 border-b border-red-800/60 text-xs text-red-200">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Code Editor Body */}
        <div className="flex-1 p-5 flex flex-col overflow-hidden bg-zinc-950">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-850">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Contenido YAML del Catálogo ({catalog.sections.length} categorías)
            </span>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                Cargar .yaml
                <input
                  type="file"
                  accept=".yaml,.yml,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? '¡Copiado!' : 'Copiar'}
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                Descargar
              </button>
            </div>
          </div>

          <textarea
            value={yamlText}
            onChange={(e) => setYamlText(e.target.value)}
            spellCheck={false}
            className="flex-1 w-full p-4 bg-zinc-900/90 border border-zinc-800 rounded-xl font-mono text-xs text-zinc-200 focus:outline-none focus:border-amber-500 resize-none leading-relaxed selection:bg-amber-600 selection:text-white"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-950/80">
          <span className="text-xs text-zinc-400">
            Formato compatible con la especificación de menús de Cacharelo.
          </span>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-750 rounded-xl transition-colors"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleImport}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-xl shadow-lg shadow-amber-950/50 transition-all"
            >
              <Check className="w-4 h-4" />
              Aplicar YAML al Catálogo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
