import React from 'react';
import type { Restaurant, Cover } from '../../types/menu';
import { Store, Image as ImageIcon, BookOpen, Upload, Trash2, LayoutTemplate } from 'lucide-react';
import { readFileAsDataURL } from '../../utils/imageProcessing';

interface MenuInfoEditorProps {
  restaurant: Restaurant;
  cover: Cover;
  onRestaurantChange: (updated: Restaurant) => void;
  onCoverChange: (updated: Cover) => void;
}

const BRAND_LOGOS = [
  { label: 'Cacharelo Café Dorado', path: '/branding/cacharelo-cofee-gold-logo.png' },
  { label: 'Grupo Cacharelo', path: '/branding/grupo-cacharelo-logo.png' },
  { label: 'Mr. Cacharelo Hamburguesas', path: '/branding/hamburguesas-logo.png' },
  { label: 'Pastes Cacharelo', path: '/branding/pastes-logo.png' }
];

const CURATED_BACKGROUNDS = [
  { label: 'Café & Mármol Artesanal (Oficial)', path: '/backgrounds/cafe-interior-cover.png' },
  { label: 'Cacharelo Panorámica 16:9 (Horizontal)', path: '/backgrounds/Cacharelo_Horizontal.jpeg' },
  { label: 'Plato de Madera (Referencia)', path: '/backgrounds/cacharelo-cover-ref.jpg' },
  { label: 'Lino Cálido Texturizado', path: '/backgrounds/warm-linen.jpg' },
  { label: 'Pizarra Oscura Slate', path: '/backgrounds/dark-slate.jpg' },
  { label: 'Tostado Café Espresso', path: '/backgrounds/espresso-roast.jpg' }
];

export const MenuInfoEditor: React.FC<MenuInfoEditorProps> = ({
  restaurant,
  cover,
  onRestaurantChange,
  onCoverChange
}) => {
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataURL(file);
      onRestaurantChange({
        ...restaurant,
        logo: dataUrl
      });
    } catch (err) {
      console.error('Failed to read logo file', err);
    }
  };

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataURL(file);
      onCoverChange({
        ...cover,
        backgroundImage: dataUrl
      });
    } catch (err) {
      console.error('Failed to read cover background file', err);
    }
  };

  return (
    <div className="bg-zinc-925 border border-zinc-800 rounded-2xl p-5 space-y-6">
      {/* Restaurant Branding Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-zinc-800">
        <Store className="w-4 h-4 text-amber-500" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-100 font-montserrat">
          Identidad del Restaurante & Portada
        </h3>
      </div>

      {/* Row 1: Restaurant Name & Slogan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-400 mb-1">
            Nombre del Restaurante
          </label>
          <input
            type="text"
            value={restaurant.name}
            onChange={(e) => onRestaurantChange({ ...restaurant, name: e.target.value })}
            placeholder="Ej. Cacharelo"
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-amber-500 font-cormorant font-bold text-base"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-400 mb-1">
            Lema / Slogan
          </label>
          <input
            type="text"
            value={restaurant.slogan || ''}
            onChange={(e) => onRestaurantChange({ ...restaurant, slogan: e.target.value })}
            placeholder="Ej. Buen café, grandes momentos"
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Row 2: Official Logo */}
      <div className="bg-zinc-900/70 p-3.5 rounded-xl border border-zinc-800 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
            Logotipo Oficial
          </label>
          <label className="flex items-center gap-1 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs font-medium rounded-lg cursor-pointer border border-zinc-700 transition-colors">
            <Upload className="w-3 h-3" />
            Subir Logo
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
            />
          </label>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center p-2 shrink-0">
            {restaurant.logo ? (
              <img
                src={restaurant.logo}
                alt={restaurant.name}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <span className="text-xs text-zinc-500">Sin logo</span>
            )}
          </div>

          <div className="flex-1">
            <span className="text-[11px] text-zinc-400 block mb-1.5 font-medium">
              O selecciona un logotipo del grupo:
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {BRAND_LOGOS.map((brand, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onRestaurantChange({ ...restaurant, logo: brand.path })}
                  className={`px-2 py-1 rounded text-left text-[11px] truncate transition-colors ${
                    restaurant.logo === brand.path
                      ? 'bg-amber-600/30 text-amber-300 font-semibold border border-amber-500/50'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {brand.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Cover Page Options & Background Image */}
      <div className="pt-2 border-t border-zinc-800 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-amber-500" />
            Página de Portada (Cover)
          </span>
          <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={cover.enabled}
              onChange={(e) => onCoverChange({ ...cover, enabled: e.target.checked })}
              className="w-3.5 h-3.5 rounded bg-zinc-800 border-zinc-700 text-amber-600 focus:ring-0 cursor-pointer"
            />
            <span>Incluir Portada</span>
          </label>
        </div>

        {cover.enabled && (
          <div className="space-y-4 pt-1">
            {/* Texts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">
                  Línea de Categorías (Pie de Portada)
                </label>
                <input
                  type="text"
                  value={cover.footer || ''}
                  onChange={(e) => onCoverChange({ ...cover, footer: e.target.value })}
                  placeholder="DESAYUNOS • COMIDAS • CAFÉ • MOMENTOS"
                  className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-amber-500 font-montserrat uppercase tracking-wider text-[10px]"
                />
              </div>

              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">
                  Lema Caligráfico (Script Tagline)
                </label>
                <input
                  type="text"
                  value={cover.tagline || ''}
                  onChange={(e) => onCoverChange({ ...cover, tagline: e.target.value })}
                  placeholder='"Aquí sabe mejor"'
                  className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-amber-500 font-script text-base"
                />
              </div>

              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">
                  Título Central (Opcional - vacío para cover limpio)
                </label>
                <input
                  type="text"
                  value={cover.title}
                  onChange={(e) => onCoverChange({ ...cover, title: e.target.value })}
                  placeholder="Vacío por defecto"
                  className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-amber-500 font-cormorant font-bold uppercase tracking-widest"
                />
              </div>

              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">
                  Subtítulo Central (Opcional)
                </label>
                <input
                  type="text"
                  value={cover.subtitle || ''}
                  onChange={(e) => onCoverChange({ ...cover, subtitle: e.target.value })}
                  placeholder="Vacío por defecto"
                  className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-amber-500 font-baskerville italic"
                />
              </div>
            </div>

            {/* Background Image Controls */}
            <div className="bg-zinc-900/80 p-4 rounded-xl border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                  Imagen de Fondo de la Portada
                </span>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs font-medium rounded-lg cursor-pointer border border-zinc-700 transition-colors">
                    <Upload className="w-3 h-3" />
                    Subir Imagen
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleBackgroundUpload}
                      className="hidden"
                    />
                  </label>

                  {cover.backgroundImage && (
                    <button
                      type="button"
                      onClick={() => onCoverChange({ ...cover, backgroundImage: undefined })}
                      className="p-1.5 bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-300 rounded-lg transition-colors"
                      title="Quitar fondo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Background Thumbnail and Preloaded Gallery */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                <div className="w-20 h-24 rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800 shrink-0 flex items-center justify-center relative shadow">
                  {cover.backgroundImage ? (
                    <img
                      src={cover.backgroundImage}
                      alt="Cover Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] text-zinc-600 text-center px-1">Sin imagen de fondo</span>
                  )}
                </div>

                <div className="flex-1 w-full space-y-1.5">
                  <span className="text-[11px] text-zinc-400 block font-medium">
                    O elige un fondo culinario prediseñado:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {CURATED_BACKGROUNDS.map((bg, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => onCoverChange({
                          ...cover,
                          backgroundImage: bg.path,
                          cardMode: bg.path.includes('cacharelo-cover-ref') ? 'floating-card' : cover.cardMode
                        })}
                        className={`px-2.5 py-1.5 rounded-lg text-left text-xs truncate transition-all ${
                          cover.backgroundImage === bg.path
                            ? 'bg-amber-600/30 text-amber-300 font-semibold border border-amber-500/50'
                            : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-750'
                        }`}
                      >
                        {bg.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Composition Mode for Background (Floating Card vs Full-Bleed vs Framed) */}
              {cover.backgroundImage && (
                <div className="pt-2 border-t border-zinc-800/80 space-y-3">
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1.5 font-medium flex items-center gap-1">
                      <LayoutTemplate className="w-3 h-3 text-amber-500" />
                      Disposición de la Portada:
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'floating-card', label: 'Tarjeta Flotante (Referencia)' },
                        { id: 'full-bleed', label: 'Fotografía Completa' },
                        { id: 'framed', label: 'Marco Clásico' }
                      ].map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => onCoverChange({ ...cover, cardMode: mode.id as any })}
                          className={`px-2 py-1.5 rounded-lg text-[10px] font-medium text-center transition-all ${
                            (cover.cardMode || 'floating-card') === mode.id
                              ? 'bg-amber-600 text-white font-semibold shadow'
                              : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sliders for Overlay Opacity & Blur */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                        <span>Oscurecimiento / Tinte:</span>
                        <span className="font-mono text-amber-400">
                          {Math.round((cover.backgroundOverlayOpacity ?? 0.25) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="0.85"
                        step="0.05"
                        value={cover.backgroundOverlayOpacity ?? 0.25}
                        onChange={(e) => onCoverChange({ ...cover, backgroundOverlayOpacity: parseFloat(e.target.value) })}
                        className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                        <span>Desenfoque (Blur):</span>
                        <span className="font-mono text-amber-400">
                          {cover.backgroundBlur ?? 0}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="8"
                        step="1"
                        value={cover.backgroundBlur ?? 0}
                        onChange={(e) => onCoverChange({ ...cover, backgroundBlur: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
