import React, { useState } from 'react';
import { Typography } from '../atoms/Typography';
import { BrandCard } from '../molecules/BrandCard';

import pastesLogo from '../../assets/logos/pastes-logo.png';
import hamburguesasLogo from '../../assets/logos/hamburguesas-logo.png';
import grupoCachareloLogo from '../../assets/logos/grupo-cacharelo-logo.png';
import coffeeLogo from '../../assets/logos/cacharelo-cofee-gold-logo.png';

import pastesExpanded from '../../assets/pastes_expanded.png';
import burgerExpanded from '../../assets/burger_expanded.png';
import antojitosExpanded from '../../assets/antojitos_expanded.png';
import cafeteriaExpanded from '../../assets/cafeteria_expanded.png';

export const BrandGrid: React.FC = () => {
  const [activeBrandId, setActiveBrandId] = useState<string | null>(null);

  const brands = [
    {
      id: 'pastes',
      name: 'Pastes y Empanadas',
      description: 'De Tradición',
      logoUrl: pastesLogo,
      expandedImage: pastesExpanded,
      specialties: ['Papas con Carne (Minero)', 'Pollo con Mole', 'Empanadas de Manzana', 'Tinga de Pollo'],
      pdfMenuUrl: '/menus/menu-pastes.pdf',
    },
    {
      id: 'hamburguesas',
      name: 'Las Hamburguesas',
      description: 'Del Imperio',
      logoUrl: hamburguesasLogo,
      expandedImage: burgerExpanded,
      specialties: ['Doble Bacon Burger', 'Cacharelo Imperial', 'Papas con Queso', 'Aros de Cebolla'],
      pdfMenuUrl: '/menus/menu-hamburguesas.pdf',
    },
    {
      id: 'antano',
      name: 'El Sabor de Antaño',
      description: 'Xastipam',
      logoUrl: grupoCachareloLogo,
      expandedImage: antojitosExpanded,
      specialties: ['Tacos de Cochinita', 'Sopes Tradicionales', 'Flautas de Pollo', 'Pozole Rojo'],
      pdfMenuUrl: '/menus/menu-antano.pdf',
    },
    {
      id: 'excelencia',
      name: 'La Excelencia',
      description: 'Multimarca',
      logoUrl: coffeeLogo,
      expandedImage: cafeteriaExpanded,
      specialties: ['Café Latte Art', 'Pastel de Chocolate Belga', 'Croissants Rellenos', 'Espresso Macchiato'],
      pdfMenuUrl: '/menus/menu-cafeteria.pdf',
    },
  ];

  // Smooth scroll to the details panel when opened
  React.useEffect(() => {
    if (activeBrandId) {
      const element = document.getElementById('brand-detail-panel');
      if (element) {
        setTimeout(() => {
          if (element && typeof element.scrollIntoView === 'function') {
            element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 150);
      }
    }
  }, [activeBrandId]);

  const activeBrand = brands.find((b) => b.id === activeBrandId);

  return (
    <section className="w-full py-24 px-margin-mobile md:px-margin-desktop bg-[#0B0B0C]" id="marcas">
      <div className="max-w-container-max mx-auto flex flex-col items-center">
        <Typography variant="h2" className="text-[#d4b038]  mb-16 text-center font-spec-hero">
          NUESTRAS CUATRO MARCAS
        </Typography>
        
        {/* Brand Grid: stays stable at 4 columns on desktop, 2 on tablet */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter w-full">
          {brands.map((brand) => (
            <BrandCard
              key={brand.id}
              name={brand.name}
              description={brand.description}
              logoUrl={brand.logoUrl}
              isActive={activeBrandId === brand.id}
              onClick={() => setActiveBrandId(activeBrandId === brand.id ? null : brand.id)}
            />
          ))}
        </div>

        {/* Animated Slide-Down Detail Panel */}
        <div
          id="brand-detail-panel"
          className={`w-full overflow-hidden transition-all duration-500 ease-in-out ${
            activeBrandId !== null ? 'max-h-[900px] opacity-100 mt-12' : 'max-h-0 opacity-0 mt-0 pointer-events-none'
          }`}
        >
          {activeBrand && (
            <div className="bg-mafia-gradient border border-mafia-bronze rounded-lg p-6 md:p-8 flex flex-col md:flex-row gap-8 items-stretch relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
              {/* Close button */}
              <button
                onClick={() => setActiveBrandId(null)}
                className="absolute top-4 right-4 text-on-surface-variant hover:text-mafia-gold transition-colors cursor-pointer z-10"
                aria-label="Close brand details"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>

              {/* Details Left */}
              <div className="flex-1 flex flex-col justify-between gap-6">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 flex items-center justify-center p-1 bg-transparent">
                      <img
                        src={activeBrand.logoUrl}
                        alt={`${activeBrand.name} logo`}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div>
                      <Typography variant="h3" className="text-mafia-gold font-spec-brand text-xl">
                        {activeBrand.name}
                      </Typography>
                      <Typography variant="label-sm" className="text-on-surface-variant font-sans uppercase tracking-wider text-xs">
                        {activeBrand.description}
                      </Typography>
                    </div>
                  </div>

                  {activeBrand.specialties && activeBrand.specialties.length > 0 && (
                    <div className="mt-2 animate-in fade-in slide-in-from-left-4 duration-300 delay-100">
                      <Typography variant="label-sm" className="text-mafia-gold font-sans font-bold text-xs uppercase tracking-wider mb-2 block">
                        Especialidades:
                      </Typography>
                      <ul className="flex flex-wrap gap-2">
                        {activeBrand.specialties.map((spec, i) => (
                          <li
                            key={i}
                            className="bg-neutral-900 border border-mafia-bronze text-[#e5e5e5] text-xs px-3 py-1.5 rounded-[4px] font-sans font-medium"
                          >
                            {spec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {activeBrand.pdfMenuUrl && (
                  <div className="mt-auto pt-4 animate-in fade-in slide-in-from-bottom-4 duration-300 delay-200">
                    <a
                      href={activeBrand.pdfMenuUrl}
                      download
                      className="inline-flex items-center gap-2 bg-primary-container text-on-primary-container px-6 py-2.5 rounded-[4px] font-sans font-bold text-xs uppercase hover:bg-[#d4b038] hover:shadow-glow-gold transition-all duration-300 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-lg">download</span>
                      Descargar Menú PDF
                    </a>
                  </div>
                )}
              </div>

              {/* Right Image */}
              {activeBrand.expandedImage && (
                <div className="flex-1 min-h-[220px] md:min-h-full rounded-lg overflow-hidden border border-mafia-bronze relative group animate-in fade-in zoom-in-95 duration-400 delay-150">
                  <img
                    src={activeBrand.expandedImage}
                    alt={`${activeBrand.name} especialidad`}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
