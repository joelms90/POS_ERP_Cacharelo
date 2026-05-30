import React from 'react';

interface TypographyProps {
  variant?: 'h1' | 'h2' | 'h3' | 'body-lg' | 'body-md' | 'label-sm';
  as?: React.ElementType;
  className?: string;
  children: React.ReactNode;
}

export const Typography: React.FC<TypographyProps> = ({
  variant = 'body-md',
  as,
  className = '',
  children,
}) => {
  const Component = as || (variant.startsWith('h') ? (variant as React.ElementType) : 'p');

  const styles = {
    h1: 'font-hero font-spec-hero text-4xl md:text-[3.5rem] leading-tight text-mafia-gold font-bold drop-shadow-2xl tracking-widest',
    h2: 'font-serif text-2xl md:text-3xl font-semibold tracking-wider text-on-surface',
    h3: 'font-spec-dish text-xl md:text-2xl text-white font-bold',
    'body-lg': 'font-sans text-lg md:text-xl font-normal leading-relaxed text-[#e2e2e2]',
    'body-md': 'font-sans text-sm md:text-base font-normal leading-relaxed text-[#e5e5e5]',
    'label-sm': 'font-sans text-xs font-semibold uppercase tracking-widest text-on-surface-variant',
  };

  return (
    <Component className={`${styles[variant]} ${className}`}>
      {children}
    </Component>
  );
};
