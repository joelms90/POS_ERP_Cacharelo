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

  return (
    <section className="w-full py-24 px-margin-mobile md:px-margin-desktop bg-[#0B0B0C]" id="marcas">
      <div className="max-w-container-max mx-auto flex flex-col items-center">
        <Typography variant="h2" className="mb-16 text-center font-spec-hero text-mafia-gold">
          Nuestras cuatro marcas
        </Typography>
        
        {/* Accordion CSS Grid: dynamically adjust grid columns on desktop */}
        <div
          className={`grid grid-cols-1 sm:grid-cols-2 gap-gutter w-full transition-all duration-500 ease-in-out ${
            activeBrandId !== null ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
          }`}
        >
          {brands.map((brand) => (
            <BrandCard
              key={brand.id}
              name={brand.name}
              description={brand.description}
              logoUrl={brand.logoUrl}
              isExpanded={activeBrandId === brand.id}
              onClick={() => setActiveBrandId(activeBrandId === brand.id ? null : brand.id)}
              expandedImage={brand.expandedImage}
              specialties={brand.specialties}
              pdfMenuUrl={brand.pdfMenuUrl}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
