import React from 'react';
import { Typography } from '../atoms/Typography';
import { BrandCard } from '../molecules/BrandCard';

import pastesLogo from '../../assets/logos/pastes-logo.png';
import hamburguesasLogo from '../../assets/logos/hamburguesas-logo.png';
import grupoCachareloLogo from '../../assets/logos/grupo-cacharelo-logo.png';
import coffeeLogo from '../../assets/logos/cacharelo-cofee-gold-logo.png';

export const BrandGrid: React.FC = () => {
  const brands = [
    {
      name: 'Pastes y Empanadas',
      description: 'De Tradición',
      logoUrl: pastesLogo,
    },
    {
      name: 'Las Hamburguesas',
      description: 'Del Imperio',
      logoUrl: hamburguesasLogo,
    },
    {
      name: 'El Sabor de Antaño',
      description: 'Xastipam',
      logoUrl: grupoCachareloLogo,
    },
    {
      name: 'La Excelencia',
      description: 'Multimarca',
      logoUrl: coffeeLogo,
    },
  ];

  return (
    <section className="w-full py-24 px-margin-mobile md:px-margin-desktop bg-[#0B0B0C]" id="marcas">
      <div className="max-w-container-max mx-auto flex flex-col items-center">
        <Typography variant="h2" className="mb-16 text-center font-spec-hero text-mafia-gold">
          Nuestras cuatro marcas
        </Typography>
        
        {/* Grid cols 1 on mobile, 2 on tablet, 4 on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter w-full">
          {brands.map((brand, index) => (
            <BrandCard
              key={index}
              name={brand.name}
              description={brand.description}
              logoUrl={brand.logoUrl}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
