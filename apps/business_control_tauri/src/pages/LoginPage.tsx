import React from 'react';
import { LoginForm } from '../components/organisms/LoginForm';
import { Heading } from '../components/atoms/Heading';

interface LoginPageProps {
  onUnlock: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onUnlock }) => {
  return (
    <div className="min-h-screen w-screen bg-obsidian flex flex-col items-center justify-center p-6 relative overflow-hidden select-none">
      {/* Decorative Golden Background Glow */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-champagne-gold/5 blur-[120px] -top-40 -left-40 pointer-events-none" />
      <div className="absolute w-[500px] h-[500px] rounded-full bg-champagne-gold/5 blur-[120px] -bottom-40 -right-40 pointer-events-none" />

      {/* Lock Screen Container */}
      <div className="w-full max-w-md bg-onyx-surface border border-aged-bronze/40 p-8 md:p-10 rounded-lg shadow-2xl shadow-obsidian/80 flex flex-col items-center gap-8 relative z-10 animate-fade-in">
        {/* Brand/Header block */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-16 h-16 rounded-full border border-champagne-gold/30 bg-charcoal-surface/40 flex items-center justify-center text-champagne-gold mb-2 shadow-lg shadow-champagne-gold/5">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          
          <Heading level={1} serif className="uppercase tracking-widest text-3xl">
            Cacharelo
          </Heading>
          
          <p className="text-xs text-text-secondary uppercase tracking-widest font-sans mt-0.5">
            Control de Administración
          </p>
        </div>

        {/* Form panel */}
        <div className="w-full border-t border-aged-bronze/10 pt-6">
          <LoginForm onSuccess={onUnlock} />
        </div>
      </div>

      {/* Footer copyright */}
      <footer className="absolute bottom-6 text-[10px] tracking-widest text-text-secondary uppercase font-sans z-10 pointer-events-none">
        © 2026 Empire POS. Todos los derechos reservados.
      </footer>
    </div>
  );
};
