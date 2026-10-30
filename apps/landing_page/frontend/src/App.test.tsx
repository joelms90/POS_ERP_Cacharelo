import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('Grupo Cacharelo Landing Page Rendering', () => {
  it('renders the brand title in navigation', () => {
    render(<App />);
    const brandElement = screen.getAllByText(/Grupo Cacharelo/i);
    expect(brandElement.length).toBeGreaterThan(0);
  });

  it('renders the main tagline in hero section', () => {
    render(<App />);
    const heroTagline = screen.getByText(/El Sabor Oficial De Tu Viaje/i);
    expect(heroTagline).toBeInTheDocument();
  });

  it('renders the three brands cards', () => {
    render(<App />);
    expect(screen.getByText('Pastes y Empanadas')).toBeInTheDocument();
    expect(screen.getAllByText('Tortas Cacharelo')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Cafeterías')[0]).toBeInTheDocument();
  });

  it('expands and collapses a brand card on click', () => {
    render(<App />);
    expect(screen.queryByText(/Especialidades:/i)).not.toBeInTheDocument();

    const pastesCard = screen.getByText('Pastes y Empanadas').closest('.interactive-card')!;
    fireEvent.click(pastesCard);

    expect(screen.getByText(/Especialidades:/i)).toBeInTheDocument();
    expect(screen.getByText('Papas con Carne (Minero)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /descargar menú pdf/i })).toBeInTheDocument();

    fireEvent.click(pastesCard);

    expect(screen.queryByText(/Especialidades:/i)).not.toBeInTheDocument();
  });

  it('renders the territories section tabs', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /todos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pastes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tortas cacharelo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cafeterías/i })).toBeInTheDocument();
  });

  it('renders the contact form and contact options', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /atención al cliente/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^contacto$/i })).toBeInTheDocument();
    expect(screen.getByText('contacto@cacharelo.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar mensaje/i })).toBeInTheDocument();
  });

  it('opens and closes the privacy modal', () => {
    render(<App />);
    expect(screen.queryByRole('heading', { name: /aviso de privacidad/i })).not.toBeInTheDocument();

    const privacyBtn = screen.getByRole('button', { name: /privacidad/i });
    fireEvent.click(privacyBtn);

    expect(screen.getByRole('heading', { name: /aviso de privacidad/i })).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /close modal/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('heading', { name: /aviso de privacidad/i })).not.toBeInTheDocument();
  });

  it('opens and closes the terms modal', () => {
    render(<App />);
    expect(screen.queryByRole('heading', { name: /términos y condiciones/i })).not.toBeInTheDocument();

    const termsBtn = screen.getByRole('button', { name: /términos/i });
    fireEvent.click(termsBtn);

    expect(screen.getByRole('heading', { name: /términos y condiciones/i })).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /close modal/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('heading', { name: /términos y condiciones/i })).not.toBeInTheDocument();
  });
});
