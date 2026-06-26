import React from 'react';

interface BadgeProps {
  variant?: 'success' | 'error' | 'warning' | 'info' | 'gold' | 'bronze' | 'charcoal';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'info',
  className = '',
}) => {
  const baseStyles = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border';
  
  const variants = {
    success: 'bg-success-green/10 text-success-green border-success-green/30',
    error: 'bg-error-red/10 text-error-red border-error-red/30',
    warning: 'bg-champagne-gold/10 text-champagne-gold border-champagne-gold/30',
    info: 'bg-text-secondary/10 text-text-secondary border-text-secondary/30',
    gold: 'bg-champagne-gold/20 text-champagne-gold border-champagne-gold/40',
    bronze: 'bg-aged-bronze/20 text-text-primary border-aged-bronze/40',
    charcoal: 'bg-charcoal-surface text-text-secondary border-aged-bronze/30',
  };

  return (
    <span className={`${baseStyles} ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};
