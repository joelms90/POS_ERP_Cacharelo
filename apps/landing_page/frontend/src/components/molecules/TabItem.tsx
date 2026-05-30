import React from 'react';

interface TabItemProps {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  badge?: string;
}

export const TabItem: React.FC<TabItemProps> = ({
  active,
  onClick,
  icon,
  label,
  badge,
}) => {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3 px-4 rounded-[4px] flex items-center justify-center gap-2 font-sans font-semibold text-xs uppercase tracking-wider transition-all duration-300 cursor-pointer ${
        active
          ? 'bg-primary-container text-on-primary-container shadow-glow-gold'
          : 'bg-transparent text-on-surface hover:text-primary'
      }`}
    >
      <span
        className="material-symbols-outlined text-sm"
        style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
      >
        {icon}
      </span>
      <span>
        {label} {badge && <span className="text-mafia-gold font-bold ml-1">{badge}</span>}
      </span>
    </button>
  );
};
