import React from 'react';
import { LandingTemplate } from '../templates/LandingTemplate';
import { Hero } from '../organisms/Hero';
import { BrandGrid } from '../organisms/BrandGrid';

import { MapTabber } from '../organisms/MapTabber';

import { ContactForm } from '../organisms/ContactForm';

export const LandingPage: React.FC = () => {
  return (
    <LandingTemplate>
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
  );
};
