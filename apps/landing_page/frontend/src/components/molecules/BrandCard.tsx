import React from 'react';
import { Typography } from '../atoms/Typography';

interface BrandCardProps {
  name: string;
  description: string;
  logoUrl?: string;
  isExpanded: boolean;
  onClick: () => void;
  expandedImage?: string;
  specialties?: string[];
  pdfMenuUrl?: string;
  customOverlay?: React.ReactNode;
}

export const BrandCard: React.FC<BrandCardProps> = ({
  name,
  description,
  logoUrl,
  isExpanded,
  onClick,
  expandedImage,
  specialties,
  pdfMenuUrl,
  customOverlay,
}) => {
  return (
    <div
      onClick={onClick}
      className={`interactive-card bg-mafia-gradient border border-mafia-bronze rounded-lg flex flex-col justify-center relative overflow-hidden transition-all duration-500 ease-in-out cursor-pointer ${
        isExpanded
          ? 'lg:col-span-4 col-span-1 p-6 md:p-8 min-h-[380px] sm:col-span-2 order-first'
          : 'col-span-1 p-8 text-center items-center min-h-[320px]'
      }`}
    >
      {isExpanded ? (
        <div className="flex flex-col lg:flex-row gap-6 w-full h-full text-left items-stretch animate-in fade-in duration-300">
          {/* Left Column: Details */}
          <div className="flex-1 flex flex-col justify-between gap-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                {logoUrl && (
                  <div className="w-16 h-16 flex items-center justify-center p-1 bg-transparent">
                    <img
                      src={logoUrl}
                      alt={`${name} logo`}
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
                <div>
                  <Typography variant="h3" className="text-mafia-gold font-spec-brand text-lg md:text-xl">
                    {name}
                  </Typography>
                  <Typography variant="label-sm" className="text-on-surface-variant font-sans uppercase tracking-wider text-[10px]">
                    {description}
                  </Typography>
                </div>
              </div>

              {specialties && specialties.length > 0 && (
                <div className="mt-2 animate-in fade-in slide-in-from-left-4 duration-300 delay-100">
                  <Typography variant="label-sm" className="text-mafia-gold font-sans font-bold text-xs uppercase tracking-wider mb-2 block">
                    Especialidades:
                  </Typography>
                  <ul className="flex flex-wrap gap-2">
                    {specialties.map((spec, i) => (
                      <li
                        key={i}
                        className="bg-neutral-900 border border-mafia-bronze text-[#e5e5e5] text-[11px] px-3 py-1 rounded-[4px] font-sans font-medium"
                      >
                        {spec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {pdfMenuUrl && (
              <div className="mt-auto pt-4 animate-in fade-in slide-in-from-bottom-4 duration-300 delay-200">
                <a
                  href={pdfMenuUrl}
                  download
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-2 bg-primary-container text-on-primary-container px-5 py-2 rounded-[4px] font-sans font-bold text-xs uppercase hover:bg-[#ebd564] hover:shadow-glow-gold transition-all duration-300 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">download</span>
                  Descargar Menú PDF
                </a>
              </div>
            )}
          </div>

          {/* Right Column: Image */}
          {expandedImage && (
            <div className="flex-1 min-h-[180px] lg:min-h-full rounded-lg overflow-hidden border border-mafia-bronze relative group animate-in fade-in zoom-in-95 duration-400 delay-150">
              <img
                src={expandedImage}
                alt={`${name} especialidad`}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center text-center gap-6 animate-in fade-in duration-300">
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
      )}
    </div>
  );
};
