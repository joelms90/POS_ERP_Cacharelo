import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', error = false, disabled, ...props }, ref) => {
    return (
      <input
        ref={ref}
        disabled={disabled}
        className={`w-full px-4 py-2 bg-onyx-surface text-text-primary border ${
          error ? 'border-error-red focus:ring-error-red/50' : 'border-aged-bronze focus:border-champagne-gold focus:ring-champagne-gold/50'
        } rounded font-sans placeholder-text-secondary transition-all duration-300 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
