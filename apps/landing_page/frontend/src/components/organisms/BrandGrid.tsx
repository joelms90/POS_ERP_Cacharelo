import React from 'react';
import { Typography } from '../atoms/Typography';
import { BrandCard } from '../molecules/BrandCard';

export const BrandGrid: React.FC = () => {
  const brands = [
    {
      name: 'Pastes y Empanadas',
      description: 'De Tradición',
      iconName: 'local_pizza',
      iconColorClass: 'text-primary',
    },
    {
      name: 'Las Hamburguesas',
      description: 'Del Imperio',
      iconName: 'lunch_dining',
      iconColorClass: 'text-[#e74c3c] drop-shadow-[0_0_10px_rgba(231,76,60,0.5)]',
    },
    {
      name: 'El Sabor de Antaño',
      description: 'Xastipam',
      iconName: 'person',
      iconColorClass: 'text-[#f39c12]',
      customOverlay: (
        <div className="absolute top-0 w-16 h-4 border-t-4 border-[#f39c12] rounded-t-full"></div>
      ),
    },
    {
      name: 'La Excelencia',
      description: 'Multimarca',
      iconName: 'coffee_maker',
      iconColorClass: 'text-primary',
    },
  ];

  return (
    <section className="w-full py-24 px-margin-mobile md:px-margin-desktop bg-[#0B0B0C]" id="marcas">
      <div className="max-w-container-max mx-auto flex flex-col items-center">
        <Typography variant="h2" className="mb-16 text-center font-spec-hero text-mafia-gold">
          Nuestras Cuatro Marcas
        </Typography>
        
        {/* Grid cols 1 on mobile, 2 on tablet, 4 on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter w-full">
          {brands.map((brand, index) => (
            <BrandCard
              key={index}
              name={brand.name}
              description={brand.description}
              iconName={brand.iconName}
              iconColorClass={brand.iconColorClass}
              customOverlay={brand.customOverlay}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
