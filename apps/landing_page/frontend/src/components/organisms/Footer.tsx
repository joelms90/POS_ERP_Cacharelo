import React from 'react';

export const Footer: React.FC = () => {
  const handleScroll = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    } else if (targetId === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <footer className="bg-[#0d0f0f] border-t border-outline-variant/50 transition-all duration-300 w-full">
      <div className="flex flex-col md:flex-row justify-between items-center w-full px-margin-mobile md:px-margin-desktop py-12 max-w-container-max mx-auto gap-gutter">
        {/* Brand */}
        <div className="font-hero font-spec-hero text-mafia-gold text-xl md:text-2xl mb-6 md:mb-0">
          Grupo Cacharelo
        </div>

        {/* Links */}
        <div className="flex flex-wrap justify-center gap-6 font-sans font-semibold text-xs uppercase">
          <a
            className="text-on-surface-variant hover:text-primary transition-all duration-300"
            href="#privacidad"
          >
            Privacidad
          </a>
          <a
            className="text-on-surface-variant hover:text-primary transition-all duration-300"
            href="#terminos"
          >
            Términos
          </a>
          <a
            className="text-on-surface-variant hover:text-primary transition-all duration-300"
            href="#linea-segura"
            onClick={(e) => handleScroll(e, 'linea-segura')}
          >
            Línea Segura
          </a>
          <a
            className="text-on-surface-variant hover:text-primary transition-all duration-300"
            href="#contacto"
            onClick={(e) => handleScroll(e, 'contacto')}
          >
            Franquicias
          </a>
        </div>

        {/* Copyright */}
        <div className="mt-8 md:mt-0 font-sans text-xs md:text-sm text-on-surface-variant text-center md:text-right">
          © 2026 Grupo Cacharelo. Tradición y Respeto.
        </div>
      </div>
    </footer>
  );
};
