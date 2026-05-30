import React, { useState } from 'react';
import { LandingTemplate } from '../templates/LandingTemplate';
import { Hero } from '../organisms/Hero';
import { BrandGrid } from '../organisms/BrandGrid';
import { MapTabber } from '../organisms/MapTabber';
import { ContactForm } from '../organisms/ContactForm';
import { InfoModal } from '../organisms/InfoModal';

export const LandingPage: React.FC = () => {
  const [activeModal, setActiveModal] = useState<'privacy' | 'terms' | null>(null);

  return (
    <>
      <LandingTemplate
        onOpenPrivacy={() => setActiveModal('privacy')}
        onOpenTerms={() => setActiveModal('terms')}
      >
        <Hero />
        
        <div className="w-full divider-cinematic max-w-container-max mx-auto"></div>
        
        <BrandGrid />
        
        <div className="w-full divider-cinematic max-w-container-max mx-auto"></div>
        
        {/* Territories Section (US2) */}
        <MapTabber />
        
        <div className="w-full divider-cinematic max-w-container-max mx-auto"></div>
        
        {/* Contact Form Section (US3) */}
        <ContactForm />
      </LandingTemplate>

      <InfoModal
        isOpen={activeModal !== null}
        onClose={() => setActiveModal(null)}
        type={activeModal}
      />
    </>
  );
};
