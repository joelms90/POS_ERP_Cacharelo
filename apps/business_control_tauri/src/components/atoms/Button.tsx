import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-semibold rounded transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-champagne-gold/50 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-champagne-gold text-obsidian hover:bg-champagne-gold-light shadow-md shadow-champagne-gold/10 hover:shadow-champagne-gold/20 active:scale-98',
    secondary: 'bg-charcoal-surface text-text-primary border border-aged-bronze hover:border-champagne-gold hover:bg-onyx-surface active:scale-98',
    danger: 'bg-error-red text-white hover:bg-red-700 active:scale-98',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const widthStyle = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthStyle} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
