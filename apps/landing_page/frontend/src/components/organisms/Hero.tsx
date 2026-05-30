import React from 'react';
import { Typography } from '../atoms/Typography';
import { Button } from '../atoms/Button';

export const Hero: React.FC = () => {
  const handleScroll = (targetId: string) => {
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative w-full min-h-[80vh] md:min-h-[85vh] flex flex-col items-center justify-center pt-24 pb-16 px-margin-mobile md:px-margin-desktop text-center overflow-hidden">
      {/* Atmospheric Background Image */}
      <div className="absolute inset-0 w-full h-full z-0 opacity-40 mix-blend-luminosity">
        <img
          className="w-full h-full object-cover object-center"
          alt="Cinematic espresso and empanada"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuDxxUyZP7pbHEdEYfjfaYRhBR0t7yFy-0gJsmR9AJid_vHIArOQy4jCZ-AF_uJZoH2C_ZKzkVRZxdO4BBevNZk_PWJ_9cfzMqrG4Xc9OFrG5qdRZQSIk2-wotBrI8MmcGQm93Q0wyq3OGuPfUFndlPDBAqLxTZH77l18IUqYfegugx49Pfnp-_n_vBgUlRDQp7afhihoKJL7FBd1T5WGOvheCgKwSUE7I37tWh05CfMli3e3XgMNzIzz3uUGkhM73Hdri65Y1aduAV0"
        />
        {/* Vignette overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,#0B0B0C_90%)] bg-no-repeat bg-cover"></div>
      </div>

      {/* Content Anchor */}
      <div className="max-w-4xl mx-auto flex flex-col items-center gap-8 relative z-10">
        <Typography variant="h1">
          El sabor oficial de tu viaje
        </Typography>
        <Typography
          variant="body-lg"
          className="italic opacity-90 max-w-2xl font-serif text-[#d4b038] drop-shadow-md"
        >
          "Una tradición familiar que se respeta."
        </Typography>

        <div className="flex flex-col sm:flex-row gap-4 mt-8">
          <Button
            variant="primary"
            onClick={() => handleScroll('territorios')}
          >
            Nuestras Operaciones
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleScroll('marcas')}
          >
            Conoce la Historia
          </Button>
        </div>
      </div>

      {/* Subtly separated bottom edge */}
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-[#0B0B0C] to-transparent z-10 pointer-events-none"></div>
    </section>
  );
};
