import { render, screen } from '@testing-library/react';
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

  it('renders the four brands cards', () => {
    render(<App />);
    expect(screen.getByText('Pastes y Empanadas')).toBeInTheDocument();
    expect(screen.getByText('Las Hamburguesas')).toBeInTheDocument();
    expect(screen.getByText('El Sabor de Antaño')).toBeInTheDocument();
    expect(screen.getByText('La Excelencia')).toBeInTheDocument();
  });

  it('renders the territories section tabs', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /en la ciudad/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /en tránsito/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /operaciones 24 hrs/i })).toBeInTheDocument();
  });

  it('renders the contact form and safe line phone number', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /línea segura/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /únete a la familia/i })).toBeInTheDocument();
    expect(screen.getByText('55 9244 9939')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar mensaje/i })).toBeInTheDocument();
  });
});
