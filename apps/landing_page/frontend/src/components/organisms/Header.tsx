import React, { useState } from 'react';

export const Header: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleScroll = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    } else if (targetId === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <nav
      className="bg-[#121414]/90 backdrop-blur-md sticky top-0 z-50 border-b border-outline-variant/30 w-full transition-all duration-300"
      id="global-nav"
    >
      <div className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto py-4">
        {/* Brand */}
        <a
          className="text-xl md:text-2xl font-hero text-mafia-gold font-spec-brand flex items-center gap-2"
          href="#"
          onClick={(e) => handleScroll(e, 'top')}
        >
          Grupo Cacharelo
        </a>

        {/* Desktop Links */}
        <ul className="hidden md:flex items-center gap-gutter">
          <li>
            <a
              className="text-primary hover:text-primary-container border-b-2 border-primary pb-1 font-sans font-semibold text-xs uppercase transition-all duration-300"
              href="#marcas"
              onClick={(e) => handleScroll(e, 'marcas')}
            >
              Nuestras Marcas
            </a>
          </li>
          <li>
            <a
              className="text-on-surface hover:text-primary transition-colors duration-300 font-sans font-semibold text-xs uppercase"
              href="#territorios"
              onClick={(e) => handleScroll(e, 'territorios')}
            >
              Territorios
            </a>
          </li>
          <li>
            <a
              className="text-on-surface hover:text-primary transition-colors duration-300 font-sans font-semibold text-xs uppercase"
              href="#linea-segura"
              onClick={(e) => handleScroll(e, 'linea-segura')}
            >
              Atención al Cliente
            </a>
          </li>
        </ul>

        {/* Trailing Action */}
        <div className="hidden md:block">
          <button
            onClick={() => {
              const element = document.getElementById('contacto');
              if (element) element.scrollIntoView({ behavior: 'smooth' });
            }}
            className="bg-primary-container text-on-primary-container px-6 py-2 rounded-[4px] font-sans font-semibold text-xs uppercase hover:shadow-glow-gold hover:bg-[#ebd564] transition-all duration-300 active:scale-95 cursor-pointer"
          >
            Contacto
          </button>
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="md:hidden text-primary focus:outline-none flex items-center justify-center"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle navigation menu"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>
            {mobileMenuOpen ? 'close' : 'menu'}
          </span>
        </button>
      </div>

      {/* Mobile Drawer */}
      <div
        className={`md:hidden absolute top-full left-0 w-full bg-[#121214] border-b border-outline-variant/30 transition-all duration-300 ease-in-out origin-top ${
          mobileMenuOpen ? 'max-h-96 opacity-100 py-6 visible' : 'max-h-0 opacity-0 invisible overflow-hidden'
        }`}
      >
        <ul className="flex flex-col items-center gap-6">
          <li>
            <a
              className="text-primary font-sans font-semibold text-xs uppercase tracking-widest"
              href="#marcas"
              onClick={(e) => handleScroll(e, 'marcas')}
            >
              Nuestras Marcas
            </a>
          </li>
          <li>
            <a
              className="text-on-surface hover:text-primary transition-colors duration-300 font-sans font-semibold text-xs uppercase tracking-widest"
              href="#territorios"
              onClick={(e) => handleScroll(e, 'territorios')}
            >
              Territorios
            </a>
          </li>
          <li>
            <a
              className="text-on-surface hover:text-primary transition-colors duration-300 font-sans font-semibold text-xs uppercase tracking-widest"
              href="#linea-segura"
              onClick={(e) => handleScroll(e, 'linea-segura')}
            >
              Atención al Cliente
            </a>
          </li>
          <li className="w-full px-8 mt-2">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                const element = document.getElementById('contacto');
                if (element) element.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full bg-primary-container text-on-primary-container py-3 rounded-[4px] font-sans font-semibold text-xs uppercase tracking-widest hover:shadow-glow-gold transition-all duration-300 cursor-pointer"
            >
              Contacto
            </button>
          </li>
        </ul>
      </div>
    </nav>
  );
};
