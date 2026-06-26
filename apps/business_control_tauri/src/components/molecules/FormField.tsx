import React from 'react';

interface FormFieldProps {
  label: string;
  error?: string;
  children: React.ReactElement;
  required?: boolean;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  children,
  required = false,
  className = '',
}) => {
  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      <label className="text-sm font-semibold tracking-wide text-text-secondary">
        {label}
        {required && <span className="text-champagne-gold ml-1">*</span>}
      </label>
      {React.cloneElement(children, { error: !!error } as any)}
      {error && (
        <span className="text-xs font-medium text-error-red tracking-wide">
          {error}
        </span>
      )}
    </div>
  );
};
