import React from 'react';
import { Typography } from '../atoms/Typography';

interface BrandCardProps {
  name: string;
  description: string;
  logoUrl?: string;
  iconName?: string;
  iconColorClass?: string;
  customOverlay?: React.ReactNode;
}

export const BrandCard: React.FC<BrandCardProps> = ({
  name,
  description,
  logoUrl,
  iconName,
  iconColorClass = 'text-primary',
  customOverlay,
}) => {
  return (
    <div className="interactive-card bg-mafia-gradient rounded-lg p-8 flex flex-col items-center text-center gap-6 min-h-[320px] justify-center relative overflow-hidden">
      <div className="w-24 h-24 rounded-full border border-mafia-bronze flex items-center justify-center p-2 relative bg-[#121214]">
        {customOverlay}
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={`${name} logo`}
            className="w-full h-full object-contain rounded-full"
          />
        ) : (
          iconName && (
            <span
              className={`material-symbols-outlined text-5xl ${iconColorClass}`}
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {iconName}
            </span>
          )
        )}
      </div>
      <div>
        <Typography variant="h3" className="mb-2">
          {name}
        </Typography>
        <Typography variant="body-md" className="text-on-surface-variant">
          {description}
        </Typography>
      </div>
    </div>
  );
};
