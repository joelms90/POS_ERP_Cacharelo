import React from 'react';

interface HeadingProps {
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  children: React.ReactNode;
  className?: string;
  serif?: boolean;
}

export const Heading: React.FC<HeadingProps> = ({
  level = 2,
  children,
  className = '',
  serif = false,
}) => {
  const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  
  const baseStyles = 'font-semibold tracking-tight text-text-primary leading-normal';
  
  const levels = {
    1: 'text-3xl md:text-4xl font-light',
    2: 'text-2xl md:text-3xl font-normal border-b border-aged-bronze/20 pb-2',
    3: 'text-xl md:text-2xl font-semibold',
    4: 'text-lg md:text-xl font-semibold',
    5: 'text-base font-semibold',
    6: 'text-sm font-bold uppercase tracking-wider',
  };

  const fontStyle = serif || level === 1 ? 'font-display font-light text-champagne-gold tracking-wide' : 'font-sans';

  return (
    <Tag className={`${baseStyles} ${levels[level]} ${fontStyle} ${className}`}>
      {children}
    </Tag>
  );
};
