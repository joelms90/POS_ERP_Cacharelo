import React, { useState } from 'react';
import { Typography } from '../atoms/Typography';
import { Button } from '../atoms/Button';

export const ContactForm: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
    honeypot: '',
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null as string | null);
  const [fieldErrors, setFieldErrors] = useState({} as Record<string, string>);

  const validate = () => {
    const errors: Record<string, string> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.name.trim()) {
      errors.name = 'El nombre es obligatorio';
    } else if (formData.name.length > 100) {
      errors.name = 'El nombre debe tener 100 caracteres o menos';
    }

    if (!formData.email.trim()) {
      errors.email = 'El correo electrónico es obligatorio';
    } else if (!emailRegex.test(formData.email)) {
      errors.email = 'El correo electrónico no es válido';
    }

    if (!formData.subject.trim()) {
      errors.subject = 'El asunto es obligatorio';
    } else if (formData.subject.length > 150) {
      errors.subject = 'El asunto debe tener 150 caracteres o menos';
    }

    if (!formData.message.trim()) {
      errors.message = 'El mensaje es obligatorio';
    } else if (formData.message.length > 1000) {
      errors.message = 'El mensaje debe tener 1000 caracteres o menos';
    }

    if (formData.phone && formData.phone.length > 20) {
      errors.phone = 'El teléfono debe tener 20 caracteres o menos';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear field error on change
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!validate()) {
      return;
    }

    setLoading(true);

    try {
      const apiUrl =
        import.meta.env.VITE_CONTACT_API_URL ||
        'http://localhost:8080';

      const response = await fetch(`${apiUrl}/submit-inquiry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSuccess(true);
        setFormData({
          name: '',
          email: '',
          phone: '',
          subject: '',
          message: '',
          honeypot: '',
        });
      } else {
        setError(result.error || 'Hubo un error al procesar tu solicitud. Por favor intenta de nuevo.');
      }
    } catch (err) {
      console.error('Network or server error during submit:', err);
      setError('Error de conexión. Por favor verifica tu red e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="w-full py-24 px-margin-mobile md:px-margin-desktop bg-[#0B0B0C]" id="contacto">
      <div className="max-w-3xl mx-auto flex flex-col items-center">
        {/* Safe Line / Contact Info */}
        <div id="linea-segura" className="flex flex-col items-center text-center gap-8 mb-16">
          <span className="material-symbols-outlined text-mafia-gold text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            phone_in_talk
          </span>
          <div>
            <Typography variant="h2" className="font-spec-hero text-mafia-gold text-2xl md:text-3xl mb-2">
              Línea segura
            </Typography>
            <Typography variant="body-md" className="text-on-surface-variant">
              Para reporte y soporte directo:
            </Typography>
          </div>
          <a
            className="font-hero text-4xl md:text-5xl hover:text-primary transition-colors duration-300 tracking-wider text-white font-bold"
            href="tel:5592449939"
          >
            55 9244 9939
          </a>
          <Typography variant="label-sm" className="text-on-surface-variant uppercase font-mono">
            Ofic: +52 1 55 7421 5566
          </Typography>
        </div>

        <div className="w-full divider-cinematic mb-16"></div>

        {/* Contact Form Container */}
        <div className="w-full bg-mafia-gradient border border-mafia-bronze rounded-lg p-8 md:p-12 relative">
          <Typography variant="h2" className="font-spec-hero text-mafia-gold text-xl md:text-2xl mb-8 text-center">
            Únete a la familia
          </Typography>

          {success && (
            <div className="mb-8 p-4 bg-[#1e2020] border border-mafia-gold text-primary rounded-[4px] flex items-center gap-3">
              <span className="material-symbols-outlined text-mafia-gold">check_circle</span>
              <Typography variant="body-md" className="text-mafia-gold font-semibold">
                ¡Solicitud enviada con éxito! Nos pondremos en contacto contigo a la brevedad.
              </Typography>
            </div>
          )}

          {error && (
            <div className="mb-8 p-4 bg-[#231315] border border-red-950 text-red-400 rounded-[4px] flex items-center gap-3">
              <span className="material-symbols-outlined text-red-500">error</span>
              <Typography variant="body-md" className="text-red-400 font-semibold">
                {error}
              </Typography>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-6 w-full text-left">
            {/* Honeypot field (hidden for spam prevention) */}
            <div className="absolute opacity-0 pointer-events-none w-0 h-0 overflow-hidden">
              <label htmlFor="honeypot">Leave this blank</label>
              <input
                id="honeypot"
                type="text"
                name="honeypot"
                value={formData.honeypot}
                onChange={handleChange}
                autoComplete="off"
              />
            </div>

            {/* Row: Name and Email */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="font-sans font-bold text-xs uppercase tracking-wider text-on-surface-variant" htmlFor="name">
                  Nombre Completo *
                </label>
                <input
                  id="name"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="ej. Don Corleone"
                  className="bg-[#0B0B0C] border border-mafia-bronze text-white rounded-[4px] px-4 py-3 focus:outline-none focus:border-mafia-gold focus:ring-1 focus:ring-mafia-gold placeholder-neutral-700 transition-all font-sans text-sm"
                />
                {fieldErrors.name && (
                  <span className="text-xs text-red-400 font-medium">{fieldErrors.name}</span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-sans font-bold text-xs uppercase tracking-wider text-on-surface-variant" htmlFor="email">
                  Correo Electrónico *
                </label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="ej. vito@corleone.com"
                  className="bg-[#0B0B0C] border border-mafia-bronze text-white rounded-[4px] px-4 py-3 focus:outline-none focus:border-mafia-gold focus:ring-1 focus:ring-mafia-gold placeholder-neutral-700 transition-all font-sans text-sm"
                />
                {fieldErrors.email && (
                  <span className="text-xs text-red-400 font-medium">{fieldErrors.email}</span>
                )}
              </div>
            </div>

            {/* Row: Phone and Subject */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="font-sans font-bold text-xs uppercase tracking-wider text-on-surface-variant" htmlFor="phone">
                  Teléfono de Contacto
                </label>
                <input
                  id="phone"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="ej. +52 55 9244 9939"
                  className="bg-[#0B0B0C] border border-mafia-bronze text-white rounded-[4px] px-4 py-3 focus:outline-none focus:border-mafia-gold focus:ring-1 focus:ring-mafia-gold placeholder-neutral-700 transition-all font-sans text-sm"
                />
                {fieldErrors.phone && (
                  <span className="text-xs text-red-400 font-medium">{fieldErrors.phone}</span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-sans font-bold text-xs uppercase tracking-wider text-on-surface-variant" htmlFor="subject">
                  Asunto *
                </label>
                <input
                  id="subject"
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  placeholder="ej. Solicitud de Franquicia"
                  className="bg-[#0B0B0C] border border-mafia-bronze text-white rounded-[4px] px-4 py-3 focus:outline-none focus:border-mafia-gold focus:ring-1 focus:ring-mafia-gold placeholder-neutral-700 transition-all font-sans text-sm"
                />
                {fieldErrors.subject && (
                  <span className="text-xs text-red-400 font-medium">{fieldErrors.subject}</span>
                )}
              </div>
            </div>

            {/* Row: Message */}
            <div className="flex flex-col gap-2">
              <label className="font-sans font-bold text-xs uppercase tracking-wider text-on-surface-variant" htmlFor="message">
                Mensaje o Comentarios *
              </label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                placeholder="Escribe tu mensaje aquí..."
                rows={5}
                className="bg-[#0B0B0C] border border-mafia-bronze text-white rounded-[4px] px-4 py-3 focus:outline-none focus:border-mafia-gold focus:ring-1 focus:ring-mafia-gold placeholder-neutral-700 transition-all font-sans text-sm resize-none"
              />
              {fieldErrors.message && (
                <span className="text-xs text-red-400 font-medium">{fieldErrors.message}</span>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="mt-4 w-full md:w-auto md:self-end px-12"
            >
              {loading ? 'Procesando...' : 'Enviar Mensaje'}
            </Button>
          </form>
        </div>
      </div>

      {/* Floating WhatsApp Button */}
      <a
        href="https://wa.me/525592449939"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 w-16 h-16 rounded-full border border-primary-container bg-[#121214] flex items-center justify-center text-primary-container hover:bg-primary-container hover:text-on-primary-container transition-all duration-300 shadow-glow-gold z-40 active:scale-95"
        aria-label="Contact via WhatsApp"
      >
        <span className="material-symbols-outlined text-3xl animate-pulse" style={{ fontVariationSettings: "'FILL' 1" }}>
          chat
        </span>
      </a>
    </section>
  );
};
