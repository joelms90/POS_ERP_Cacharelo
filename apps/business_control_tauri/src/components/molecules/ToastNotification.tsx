import React, { useEffect } from 'react';

export interface ToastNotificationProps {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning';
  onClose: (id: string) => void;
  durationMs?: number;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({
  id,
  message,
  type,
  onClose,
  durationMs = 4000,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, durationMs);

    return () => clearTimeout(timer);
  }, [id, durationMs, onClose]);

  const borderColors = {
    success: 'border-success-green/80 shadow-success-green/5',
    error: 'border-error-red/80 shadow-error-red/5',
    warning: 'border-champagne-gold/80 shadow-champagne-gold/5',
  };

  const icons = {
    success: (
      <svg className="w-5 h-5 text-success-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5 text-error-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5 text-champagne-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  };

  return (
    <div
      className={`flex items-start gap-3 w-80 p-4 bg-onyx-surface text-text-primary border rounded-lg shadow-lg animate-slide-in transition-all duration-300 ${borderColors[type]}`}
      role="alert"
    >
      <div className="flex-shrink-0 mt-0.5">{icons[type]}</div>
      <div className="flex-grow text-sm font-sans tracking-wide leading-relaxed">
        {message}
      </div>
      <button
        onClick={() => onClose(id)}
        className="flex-shrink-0 text-text-secondary hover:text-text-primary transition-colors duration-200"
        aria-label="Close"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: Array<{
    id: string;
    message: string;
    type: 'success' | 'error' | 'warning';
  }>;
  onClose: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose }) => {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-auto">
      {toasts.map((toast) => (
        <ToastNotification
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={onClose}
        />
      ))}
    </div>
  );
};
