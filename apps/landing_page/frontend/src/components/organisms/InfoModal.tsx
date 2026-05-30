import React, { useEffect } from 'react';
import { Typography } from '../atoms/Typography';
import { Button } from '../atoms/Button';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'privacy' | 'terms' | null;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose, type }) => {
  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !type) return null;

  const isPrivacy = type === 'privacy';
  const title = isPrivacy ? 'Aviso de Privacidad' : 'Términos y Condiciones';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop overlay */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      ></div>

      {/* Modal box */}
      <div className="relative bg-mafia-gradient border border-mafia-bronze rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl z-10 overflow-hidden transform scale-100 transition-all duration-300 animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-mafia-bronze">
          <Typography variant="h2" className="text-lg md:text-xl font-spec-hero text-mafia-gold font-bold">
            {title}
          </Typography>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-mafia-gold transition-colors duration-200 focus:outline-none flex items-center justify-center cursor-pointer"
            aria-label="Close modal"
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
        </div>

        {/* Modal Content Scrollable Area */}
        <div className="p-6 overflow-y-auto flex-grow flex flex-col gap-6 text-left max-h-[60vh] scrollbar">
          {isPrivacy ? (
            <>
              <div>
                <Typography variant="label-sm" className="text-mafia-gold mb-1">
                  1. RESPONSABLE DE LOS DATOS PERSONALES
                </Typography>
                <Typography variant="body-md" className="text-sm">
                  Grupo Cacharelo, S.A. de C.V. (en adelante, "Grupo Cacharelo"), con domicilio para oír y recibir notificaciones en Ciudad de México, es el responsable del tratamiento y resguardo de sus datos personales, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.
                </Typography>
              </div>

              <div>
                <Typography variant="label-sm" className="text-mafia-gold mb-1">
                  2. DATOS RECOLECTADOS
                </Typography>
                <Typography variant="body-md" className="text-sm">
                  Los datos que recabamos de manera directa a través de nuestro formulario de contacto en el portal web incluyen: Nombre Completo, Dirección de Correo Electrónico, Teléfono de Contacto (opcional), Asunto de la solicitud y el Mensaje que nos proporciona.
                </Typography>
              </div>

              <div>
                <Typography variant="label-sm" className="text-mafia-gold mb-1">
                  3. FINALIDAD DEL TRATAMIENTO
                </Typography>
                <Typography variant="body-md" className="text-sm mb-2">
                  Sus datos personales serán utilizados única y exclusivamente para los siguientes fines legítimos:
                </Typography>
                <ul className="list-disc list-inside text-sm text-[#e5e5e5] flex flex-col gap-2 pl-2">
                  <li>Atender, evaluar y responder a solicitudes de Franquicias o alianzas comerciales.</li>
                  <li>Canalizar de forma confidencial los reportes de soporte técnico o incidencias enviados a nuestra Línea Segura.</li>
                  <li>Establecer comunicación directa de seguimiento comercial o institucional con usted.</li>
                </ul>
              </div>

              <div>
                <Typography variant="label-sm" className="text-mafia-gold mb-1">
                  4. SEGURIDAD Y TRANSFERENCIA
                </Typography>
                <Typography variant="body-md" className="text-sm">
                  Grupo Cacharelo implementa medidas de seguridad técnicas y organizativas rigurosas para proteger sus datos contra daño, pérdida, alteración o acceso no autorizado. Nosotros NO transferimos, vendemos ni comercializamos sus datos personales a terceros sin su consentimiento expreso.
                </Typography>
              </div>

              <div>
                <Typography variant="label-sm" className="text-mafia-gold mb-1">
                  5. DERECHOS ARCO
                </Typography>
                <Typography variant="body-md" className="text-sm">
                  Usted tiene derecho a Acceder, Rectificar, Cancelar u Oponerse al tratamiento de sus datos (Derechos ARCO). Para ejercer estos derechos, puede enviar una solicitud por escrito detallando su requerimiento al correo electrónico oficial: <span className="text-mafia-gold font-mono">privacidad@grupo-cacharelo.com</span>.
                </Typography>
              </div>
            </>
          ) : (
            <>
              <div>
                <Typography variant="label-sm" className="text-mafia-gold mb-1">
                  1. CONDICIONES GENERALES
                </Typography>
                <Typography variant="body-md" className="text-sm">
                  El acceso y uso de este portal web de Grupo Cacharelo atribuye la condición de visitante e implica la aceptación total y sin reservas de los presentes términos. El sitio tiene un carácter estrictamente informativo sobre la identidad corporativa y las marcas operadas por el grupo.
                </Typography>
              </div>

              <div>
                <Typography variant="label-sm" className="text-mafia-gold mb-1">
                  2. PROPIEDAD INTELECTUAL
                </Typography>
                <Typography variant="body-md" className="text-sm">
                  Todos los contenidos de este sitio, incluyendo de forma enunciativa pero no limitativa los textos, marcas comerciales (Pastes y Empanadas, Las Hamburguesas, El Sabor de Antaño - Xastipam, La Excelencia), logotipos, gráficos, interfaces y código de programación son propiedad exclusiva de Grupo Cacharelo y están protegidos por las leyes internacionales de propiedad intelectual. Queda estrictamente prohibida su copia, distribución o reproducción sin autorización escrita.
                </Typography>
              </div>

              <div>
                <Typography variant="label-sm" className="text-mafia-gold mb-1">
                  3. USO DE LA LÍNEA SEGURA y CANALES DE CONTACTO
                </Typography>
                <Typography variant="body-md" className="text-sm">
                  La Línea Segura y el formulario de contacto están destinados a canalizar consultas y reportes legítimos de clientes, franquiciados o personal. Se prohíbe el uso de estos canales para enviar mensajes ofensivos, spam, información falsa o ataques cibernéticos. Grupo Cacharelo se reserva el derecho de proceder legalmente ante uso malintencionado.
                </Typography>
              </div>

              <div>
                <Typography variant="label-sm" className="text-mafia-gold mb-1">
                  4. LÍMITES DE RESPONSABILIDAD
                </Typography>
                <Typography variant="body-md" className="text-sm">
                  Grupo Cacharelo realiza esfuerzos razonables para mantener la información del portal actualizada, sin embargo, no asume responsabilidad por errores, interrupciones en el servicio web, o caídas temporales del sistema causadas por terceros o fallas en las redes de comunicación.
                </Typography>
              </div>

              <div>
                <Typography variant="label-sm" className="text-mafia-gold mb-1">
                  5. LEGISLACIÓN APLICABLE
                </Typography>
                <Typography variant="body-md" className="text-sm">
                  Estas condiciones se rigen por las leyes de los Estados Unidos Mexicanos. Para cualquier controversia relacionada con el uso del portal, las partes acuerdan someterse a la jurisdicción de los tribunales competentes de la Ciudad de México.
                </Typography>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-mafia-bronze flex justify-end">
          <Button variant="secondary" onClick={onClose} className="px-6 py-2">
            Entendido
          </Button>
        </div>
      </div>
    </div>
  );
};
