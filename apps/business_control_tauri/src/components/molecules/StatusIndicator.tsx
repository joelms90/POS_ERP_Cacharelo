import React from 'react';

interface StatusIndicatorProps {
  apiOnline: boolean;
  databaseConnected: boolean;
  databaseType?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  apiOnline,
  databaseConnected,
  databaseType = 'PostgreSQL',
}) => {
  return (
    <div className="flex items-center gap-3 font-sans">
      {/* API Server Cloud Status Icon */}
      <div 
        className="flex items-center justify-center p-1.5 rounded-full bg-charcoal/20 border border-aged-bronze/10 cursor-help transition-all hover:bg-charcoal/40"
        title={`Servidor Sync: ${apiOnline ? 'Online' : 'Offline'}`}
      >
        <svg 
          className={`w-5 h-5 transition-colors duration-300 ${
            apiOnline ? 'text-success-green drop-shadow-[0_0_6px_rgba(34,197,94,0.3)] animate-pulse' : 'text-error-red'
          }`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
        </svg>
      </div>

      {/* Database Status Icon */}
      <div 
        className="flex items-center justify-center p-1.5 rounded-full bg-charcoal/20 border border-aged-bronze/10 cursor-help transition-all hover:bg-charcoal/40"
        title={`Base de Datos (${databaseType}): ${databaseConnected ? 'Conectado' : 'Desconectado'}`}
      >
        <svg 
          className={`w-5 h-5 transition-colors duration-300 ${
            databaseConnected ? 'text-success-green drop-shadow-[0_0_6px_rgba(34,197,94,0.3)]' : 'text-error-red'
          }`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
        </svg>
      </div>
    </div>
  );
};
