import React from 'react';
import { Typography } from '../atoms/Typography';

interface BrandCardProps {
  name: string;
  description: string;
  logoUrl?: string;
  isActive: boolean;
  onClick: () => void;
  customOverlay?: React.ReactNode;
}

export const BrandCard: React.FC<BrandCardProps> = ({
  name,
  description,
  logoUrl,
  isActive,
  onClick,
  customOverlay,
}) => {
  return (
    <div
      onClick={onClick}
      className={`interactive-card bg-mafia-gradient border rounded-lg p-8 text-center items-center flex flex-col gap-6 min-h-[320px] justify-center relative overflow-hidden cursor-pointer transition-all duration-300 ${
        isActive
          ? 'border-mafia-gold shadow-glow-gold scale-[1.02]'
          : 'border-mafia-bronze hover:border-mafia-gold/50'
      }`}
    >
      <div className="w-24 h-24 flex items-center justify-center p-2 relative">
        {customOverlay}
        {logoUrl && (
          <img
            src={logoUrl}
            alt={`${name} logo`}
            className="w-full h-full object-contain"
          />
        )}
      </div>
      <div>
        <Typography variant="h3" className="mb-2 text-mafia-gold font-spec-brand text-lg">
          {name}
        </Typography>
        <Typography variant="body-md" className="text-on-surface-variant font-sans text-sm">
          {description}
        </Typography>
      </div>
    </div>
  );
};
