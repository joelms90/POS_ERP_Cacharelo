import React, { useState, useEffect, useRef } from 'react';

export interface AutocompleteOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface AutocompleteProps {
  options: AutocompleteOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export const Autocomplete: React.FC<AutocompleteProps> = ({
  options,
  value,
  onChange,
  placeholder = '-- Buscar --',
  required = false,
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Synchronize input text with the selected option
  useEffect(() => {
    const selectedOption = options.find((opt) => opt.id === value);
    if (selectedOption) {
      setSearch(selectedOption.label);
    } else {
      setSearch('');
    }
  }, [value, options]);

  // Filter options based on search text (case and accent insensitive)
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const filteredOptions = options.filter((opt) => {
    if (!search || value && options.find((o) => o.id === value)?.label === search) return true;
    const query = normalize(search);
    return (
      normalize(opt.label).includes(query) ||
      (opt.sublabel && normalize(opt.sublabel).includes(query))
    );
  });

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        // Reset search to current value label on blur
        const selectedOption = options.find((opt) => opt.id === value);
        setSearch(selectedOption ? selectedOption.label : '');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value, options]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredOptions.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        const selected = filteredOptions[highlightedIndex];
        onChange(selected.id);
        setSearch(selected.label);
        setIsOpen(false);
        setHighlightedIndex(-1);
        inputRef.current?.blur();
      } else if (!isOpen) {
        setIsOpen(true);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
      inputRef.current?.blur();
    }
  };

  const handleOptionClick = (option: AutocompleteOption) => {
    onChange(option.id);
    setSearch(option.label);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  return (
    <div ref={containerRef} className={`relative w-full font-sans ${className}`}>
      <div className="relative flex items-center">
        {/* Search Icon */}
        <div className="absolute left-3 text-text-secondary pointer-events-none">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(0);
            if (!e.target.value) {
              onChange('');
            }
          }}
          onFocus={() => {
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          placeholder={placeholder}
          required={required && !value}
          disabled={disabled}
          onKeyDown={handleKeyDown}
          className="w-full bg-charcoal-surface border border-aged-bronze focus:border-champagne-gold disabled:opacity-50 text-xs text-text-primary pl-9 pr-8 py-2.5 rounded focus:outline-none placeholder-text-secondary/60 transition-all font-sans"
        />

        {/* Clear/Chevron Button */}
        <div className="absolute right-3 flex items-center gap-1">
          {value && !disabled && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setSearch('');
                setIsOpen(false);
                inputRef.current?.focus();
              }}
              className="text-text-secondary hover:text-error-red transition-colors p-0.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen((prev) => !prev)}
            className="text-text-secondary hover:text-champagne-gold transition-colors p-0.5"
          >
            <svg
              className={`w-3.5 h-3.5 transform transition-transform duration-200 ${
                isOpen ? 'rotate-180' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Options Dropdown */}
      {isOpen && !disabled && filteredOptions.length > 0 && (
        <ul className="absolute z-50 w-full bg-onyx-surface border border-aged-bronze/40 rounded shadow-2xl mt-1 overflow-y-auto max-h-60 list-none p-0 m-0 divide-y divide-aged-bronze/10">
          {filteredOptions.map((option, index) => (
            <li
              key={option.id}
              onClick={() => handleOptionClick(option)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`px-4 py-2 text-xs cursor-pointer flex flex-col gap-0.5 transition-colors font-sans ${
                value === option.id
                  ? 'bg-charcoal-surface text-champagne-gold font-medium'
                  : index === highlightedIndex
                  ? 'bg-charcoal-surface/60 text-text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <span className="font-medium">{option.label}</span>
              {option.sublabel && (
                <span className="text-[10px] text-text-secondary font-mono">
                  {option.sublabel}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {isOpen && !disabled && filteredOptions.length === 0 && (
        <div className="absolute z-50 w-full bg-onyx-surface border border-aged-bronze/40 rounded shadow-2xl mt-1 p-4 text-center text-xs text-text-secondary italic font-sans">
          No se encontraron resultados
        </div>
      )}
    </div>
  );
};
