import React from 'react';
import { Badge } from '../atoms/Badge';

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
    <div className="flex flex-wrap items-center gap-4 text-sm font-sans">
      {/* API Server Status */}
      <div className="flex items-center gap-2">
        <span className="text-text-secondary text-xs">Servidor Sync:</span>
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              apiOnline ? 'bg-success-green animate-pulse' : 'bg-error-red'
            }`}
          />
          <Badge variant={apiOnline ? 'success' : 'error'}>
            {apiOnline ? 'Online' : 'Offline'}
          </Badge>
        </div>
      </div>

      {/* Database Status */}
      <div className="flex items-center gap-2">
        <span className="text-text-secondary text-xs">Base de Datos ({databaseType}):</span>
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              databaseConnected ? 'bg-success-green' : 'bg-error-red'
            }`}
          />
          <Badge variant={databaseConnected ? 'success' : 'error'}>
            {databaseConnected ? 'Conectado' : 'Desconectado'}
          </Badge>
        </div>
      </div>
    </div>
  );
};
