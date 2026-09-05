import React, { useState, useEffect } from 'react';
import { X, Sparkles, RefreshCw, Check } from 'lucide-react';
import { removeBackgroundClient } from '../../utils/imageProcessing';

interface BackgroundRemovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalImage: string;
  onApply: (processedDataUrl: string) => void;
}

export const BackgroundRemovalModal: React.FC<BackgroundRemovalModalProps> = ({
  isOpen,
  onClose,
  originalImage,
  onApply
}) => {
  const [tolerance, setTolerance] = useState<number>(32);
  const [feather, setFeather] = useState<number>(2);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'processed' | 'original' | 'split'>('processed');

  const runProcessing = async () => {
    if (!originalImage) return;
    setIsProcessing(true);
    try {
      const result = await removeBackgroundClient(originalImage, {
        tolerance,
        feather
      });
      setProcessedUrl(result);
    } catch (err) {
      console.error('Failed to remove background:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (isOpen && originalImage) {
      runProcessing();
    }
  }, [isOpen, originalImage, tolerance, feather]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl bg-zinc-900 border border-zinc-750 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-100 font-montserrat">
                Eliminador de Fondo Inteligente
              </h3>
              <p className="text-xs text-zinc-400">
                Segmentación perimetral para conservar alimentos blancos (queso, arroz, platos)
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

        {/* View Controls & Preview Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Tabs */}
          <div className="flex justify-center mb-4">
            <div className="inline-flex p-1 bg-zinc-800/80 rounded-xl text-xs font-medium">
              <button
                onClick={() => setActiveTab('processed')}
                className={`px-4 py-1.5 rounded-lg transition-all ${
                  activeTab === 'processed'
                    ? 'bg-amber-600 text-white shadow'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Sin Fondo (Transparente)
              </button>
              <button
                onClick={() => setActiveTab('split')}
                className={`px-4 py-1.5 rounded-lg transition-all ${
                  activeTab === 'split'
                    ? 'bg-amber-600 text-white shadow'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Comparar Lado a Lado
              </button>
              <button
                onClick={() => setActiveTab('original')}
                className={`px-4 py-1.5 rounded-lg transition-all ${
                  activeTab === 'original'
                    ? 'bg-amber-600 text-white shadow'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Original
              </button>
            </div>
          </div>

          {/* Image Display */}
          <div className="relative min-h-[300px] flex items-center justify-center rounded-xl overflow-hidden border border-zinc-800 bg-[radial-gradient(#333_1px,transparent_1px)] [background-size:16px_16px] bg-zinc-950">
            {isProcessing && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-950/70 backdrop-blur-xs">
                <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mb-2" />
                <span className="text-xs text-zinc-300 font-montserrat">Procesando segmentación...</span>
              </div>
            )}

            {activeTab === 'processed' && (
              <div className="p-4 max-h-[360px] flex items-center justify-center">
                {processedUrl ? (
                  <img
                    src={processedUrl}
                    alt="Processed"
                    className="max-h-[320px] max-w-full object-contain filter drop-shadow-[0_12px_18px_rgba(0,0,0,0.5)]"
                  />
                ) : null}
              </div>
            )}

            {activeTab === 'original' && (
              <div className="p-4 max-h-[360px] flex items-center justify-center">
                <img
                  src={originalImage}
                  alt="Original"
                  className="max-h-[320px] max-w-full object-contain rounded-lg"
                />
              </div>
            )}

            {activeTab === 'split' && (
              <div className="grid grid-cols-2 w-full h-full p-4 gap-4">
                <div className="flex flex-col items-center">
                  <span className="text-xs text-zinc-400 mb-2 font-mono">Original</span>
                  <img
                    src={originalImage}
                    alt="Original"
                    className="max-h-[260px] object-contain rounded-lg border border-zinc-800"
                  />
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-xs text-amber-400 mb-2 font-mono">Sin Fondo</span>
                  {processedUrl && (
                    <img
                      src={processedUrl}
                      alt="Processed"
                      className="max-h-[260px] object-contain filter drop-shadow-[0_8px_12px_rgba(0,0,0,0.4)]"
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Adjustment Sliders */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-950/50 p-4 rounded-xl border border-zinc-800">
            <div>
              <div className="flex justify-between text-xs text-zinc-300 mb-1.5">
                <span className="font-medium">Tolerancia de Color</span>
                <span className="font-mono text-amber-400">{tolerance}</span>
              </div>
              <input
                type="range"
                min="10"
                max="75"
                value={tolerance}
                onChange={(e) => setTolerance(Number(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <span className="text-[10px] text-zinc-500 mt-1 block">
                Valores altos remueven sombras suaves; valores bajos protegen bordes delicados.
              </span>
            </div>

            <div>
              <div className="flex justify-between text-xs text-zinc-300 mb-1.5">
                <span className="font-medium">Suavizado de Bordes (Feather)</span>
                <span className="font-mono text-amber-400">{feather}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="6"
                value={feather}
                onChange={(e) => setFeather(Number(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <span className="text-[10px] text-zinc-500 mt-1 block">
                Elimina bordes duros o dentados creando una transición suave.
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-950/80">
          <button
            onClick={() => {
              setTolerance(32);
              setFeather(2);
            }}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Restablecer Valores
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-750 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                if (processedUrl) {
                  onApply(processedUrl);
                  onClose();
                }
              }}
              disabled={!processedUrl || isProcessing}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded-xl shadow-lg shadow-amber-950/50 transition-all"
            >
              <Check className="w-4 h-4" />
              Aplicar al Platillo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
