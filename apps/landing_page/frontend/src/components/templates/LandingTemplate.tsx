import React from 'react';
import { Header } from '../organisms/Header';
import { Footer } from '../organisms/Footer';

interface LandingTemplateProps {
  children: React.ReactNode;
  onOpenPrivacy?: () => void;
  onOpenTerms?: () => void;
}

export const LandingTemplate: React.FC<LandingTemplateProps> = ({
  children,
  onOpenPrivacy,
  onOpenTerms,
}) => {
  return (
    <div className="flex flex-col min-h-screen w-full bg-mafia-base text-on-surface">
      <Header />
      <main className="flex-grow w-full flex flex-col">
        {children}
      </main>
      <Footer onOpenPrivacy={onOpenPrivacy} onOpenTerms={onOpenTerms} />
    </div>
  );
};
