import React, { useState } from 'react';
import { Heading } from '../components/atoms/Heading';

export const HelpPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'concepts' | 'procedures' | 'faq'>('concepts');

  return (
    <div className="w-full lg:h-full min-h-full bg-obsidian p-2 lg:p-6 font-sans overflow-y-auto lg:overflow-hidden flex flex-col">
      {/* Top Header */}
      <div className="border-b border-aged-bronze/30 pb-3 mb-6">
        <Heading level={2} className="!border-none !pb-0 text-champagne-gold font-light">
          Manual de Procedimientos y FAQ
        </Heading>
        <p className="text-xs text-text-secondary mt-1">
          Guía oficial para la administración de Catálogo, Recetas e Inventario en el sistema POS-ERP.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:h-[calc(100vh-220px)] overflow-hidden">
        {/* Left Side Navigation */}
        <div className="w-full lg:w-64 bg-onyx-surface border border-aged-bronze/40 rounded-lg p-5 flex flex-col gap-2 shadow-xl">
          <span className="text-xs text-text-secondary uppercase tracking-widest font-semibold mb-4">
            Secciones del Manual
          </span>
          <button
            onClick={() => setActiveSection('concepts')}
            className={`w-full text-left p-3 rounded text-xs transition-all duration-200 border ${
              activeSection === 'concepts'
                ? 'bg-charcoal-surface border-champagne-gold/30 text-champagne-gold font-medium'
                : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-charcoal-surface/30'
            }`}
          >
            📌 1. Conceptos Clave
          </button>
          <button
            onClick={() => setActiveSection('procedures')}
            className={`w-full text-left p-3 rounded text-xs transition-all duration-200 border ${
              activeSection === 'procedures'
                ? 'bg-charcoal-surface border-champagne-gold/30 text-champagne-gold font-medium'
                : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-charcoal-surface/30'
            }`}
          >
            🛠️ 2. Guías Paso a Paso
          </button>
          <button
            onClick={() => setActiveSection('faq')}
            className={`w-full text-left p-3 rounded text-xs transition-all duration-200 border ${
              activeSection === 'faq'
                ? 'bg-charcoal-surface border-champagne-gold/30 text-champagne-gold font-medium'
                : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-charcoal-surface/30'
            }`}
          >
            ❓ 3. Preguntas Frecuentes
          </button>
        </div>

        {/* Right Side Content Pane */}
        <div className="flex-1 bg-onyx-surface border border-aged-bronze/40 rounded-lg p-6 overflow-y-auto shadow-xl font-sans text-sm text-text-primary">
          {activeSection === 'concepts' && (
            <div className="flex flex-col gap-6 animate-fade-in">
              <h3 className="text-lg text-champagne-gold font-light border-b border-aged-bronze/20 pb-2">
                Conceptos Clave del Sistema
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Para operar el catálogo de manera correcta, debes comprender la diferencia entre los roles principales de un artículo. Esto evita duplicados y mantiene limpia la pantalla de venta del cajero.
              </p>

              <div className="overflow-x-auto border border-aged-bronze/25 rounded-md mt-2">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-charcoal-surface border-b border-aged-bronze/30 text-text-secondary uppercase text-[10px] tracking-wider">
                      <th className="p-3 font-semibold">Rol</th>
                      <th className="p-3 font-semibold text-center">¿Para Venta?</th>
                      <th className="p-3 font-semibold text-center">¿Es Insumo?</th>
                      <th className="p-3 font-semibold">¿Dónde Aparece?</th>
                      <th className="p-3 font-semibold">Ejemplo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-aged-bronze/10 text-text-primary">
                    <tr className="hover:bg-charcoal-surface/10 transition-colors">
                      <td className="p-3 font-semibold text-champagne-gold">Producto Terminado</td>
                      <td className="p-3 text-center text-success-green">SÍ</td>
                      <td className="p-3 text-center text-error-red">NO</td>
                      <td className="p-3">Menú del cajero en caja (POS) y lista de recetas.</td>
                      <td className="p-3">Sándwich de Jamón, Paste de Piña, Café Americano</td>
                    </tr>
                    <tr className="hover:bg-charcoal-surface/10 transition-colors">
                      <td className="p-3 font-semibold text-text-secondary">Insumo / Materia Prima</td>
                      <td className="p-3 text-center text-error-red">NO</td>
                      <td className="p-3 text-center text-success-green">SÍ</td>
                      <td className="p-3">Menú de ingredientes en recetas (BOM).</td>
                      <td className="p-3">Pan de caja, Jamón, Harina, Café en grano</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSection === 'procedures' && (
            <div className="flex flex-col gap-8 animate-fade-in">
              <h3 className="text-lg text-champagne-gold font-light border-b border-aged-bronze/20 pb-2">
                Guías y Procedimientos Operativos
              </h3>

              {/* Proc 1 */}
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-semibold text-champagne-gold">
                  Procedimiento 1: Crear un nuevo producto y su receta
                </h4>
                <ol className="list-decimal pl-5 text-xs text-text-secondary flex flex-col gap-1.5 leading-relaxed">
                  <li>Ve a la pestaña <strong>Inventario y Catálogo</strong> y haz clic en <strong>Nuevo Producto</strong>.</li>
                  <li>Registra el producto (ej. <em>Sándwich de Pavo</em>), marcando <strong>Para Venta = SÍ</strong> y <strong>Es Insumo = NO</strong>.</li>
                  <li>Ve a la pestaña <strong>Producción (Recetas)</strong> y haz clic sobre el producto en la lista izquierda.</li>
                  <li>En el formulario de la derecha, agrega cada ingrediente componente (ej. <em>Pan de caja</em>: 2 piezas, <em>Pavo</em>: 0.040 kg) y haz clic en <strong>Añadir</strong>.</li>
                  <li>Al terminar, haz clic en el botón superior <strong>Guardar Receta</strong>.</li>
                </ol>
              </div>

              {/* Proc 2 */}
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-semibold text-champagne-gold">
                  Procedimiento 2: Registrar entrada de insumos (Compras)
                </h4>
                <ol className="list-decimal pl-5 text-xs text-text-secondary flex flex-col gap-1.5 leading-relaxed">
                  <li>Ve a la sección <strong>Inventario y Catálogo</strong> y abre la pestaña <strong>Entradas de Inventario</strong>.</li>
                  <li>Haz clic en <strong>Registrar Entrada</strong>.</li>
                  <li>Selecciona el Proveedor, la Bodega de destino, ingresa fecha y notas.</li>
                  <li>Busca y agrega tus insumos comprados con la cantidad y el costo unitario de compra.</li>
                  <li>Guarda la entrada para actualizar el stock real al instante.</li>
                </ol>
              </div>

              {/* Proc 3 */}
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-semibold text-champagne-gold">
                  Procedimiento 3: Hornear o pre-fabricar en lotes (ej. Pastes)
                </h4>
                <ol className="list-decimal pl-5 text-xs text-text-secondary flex flex-col gap-1.5 leading-relaxed">
                  <li>Ve a la sección <strong>Producción (Recetas)</strong> y haz clic en <strong>Ensamble de Productos</strong>.</li>
                  <li>Selecciona la bodega, el artículo terminado (ej. <em>Paste de Piña</em>) y la cantidad a hornear (ej. <em>10</em>).</li>
                  <li>Haz clic en <strong>Procesar Ensamble</strong>.</li>
                  <li>El sistema validará el stock de tus ingredientes, descontará las porciones de materia prima y sumará los 10 pastes terminados listos para venta.</li>
                </ol>
              </div>
            </div>
          )}

          {activeSection === 'faq' && (
            <div className="flex flex-col gap-6 animate-fade-in">
              <h3 className="text-lg text-champagne-gold font-light border-b border-aged-bronze/20 pb-2">
                Preguntas Frecuentes (FAQ)
              </h3>

              <div className="flex flex-col gap-4">
                <div className="bg-charcoal-surface/30 p-4 rounded-md border border-aged-bronze/20">
                  <h4 className="text-sm font-medium text-champagne-gold mb-1">
                    ¿Cómo descuenta inventario el sistema al vender en la caja (POS)?
                  </h4>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    El sistema utiliza un algoritmo <strong>híbrido inteligente</strong>: si el producto vendido tiene stock disponible (porque registraste su ensamble previo), descuenta el stock terminado. Si no hay stock del producto (ej. un sándwich preparado al momento), el sistema lee su receta y descuenta los insumos individuales (pan, jamón) automáticamente al procesar el pago.
                  </p>
                </div>

                <div className="bg-charcoal-surface/30 p-4 rounded-md border border-aged-bronze/20">
                  <h4 className="text-sm font-medium text-champagne-gold mb-1">
                    ¿Por qué mi insumo (ej. Harina, Jamón) no aparece en la columna de recetas?
                  </h4>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Porque está marcado como <strong>Es Insumo = SÍ</strong>. El panel de recetas sirve para armar la composición de productos terminados, por lo que solo muestra productos de venta. Los ingredientes sueltos aparecen en el menú desplegable para ser agregados a las recetas.
                  </p>
                </div>

                <div className="bg-charcoal-surface/30 p-4 rounded-md border border-aged-bronze/20">
                  <h4 className="text-sm font-medium text-champagne-gold mb-1">
                    ¿Qué sucede si un ensamble o una venta no tiene suficiente stock de insumos?
                  </h4>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    En ensamble manual, el sistema te bloqueará el procesamiento y te indicará detalladamente cuál ingrediente falta. En ventas desde la caja (POS), para no detener la operación comercial del local, se permite registrar la venta y el stock del insumo pasará a ser negativo temporalmente hasta que se registre su compra.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
