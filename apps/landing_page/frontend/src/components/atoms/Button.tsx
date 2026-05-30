import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  children,
  className = '',
  ...props
}) => {
  const baseStyle =
    'px-8 py-3 rounded-[4px] font-sans font-semibold text-xs tracking-widest uppercase transition-all duration-300 active:scale-95 cursor-pointer inline-flex items-center justify-center gap-2';
  
  const variants = {
    primary: 'bg-primary-container text-on-primary-container hover:shadow-glow-gold hover:bg-[#ebd564]',
    secondary: 'border border-mafia-bronze bg-transparent text-on-surface hover:border-primary-container hover:text-primary',
  };

  return (
    <button
      className={`${baseStyle} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
