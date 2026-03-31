import React, { useState } from 'react';

// 1. Definición de los Íconos SVG (Limpios y profesionales)
const Iconos = {
  Dashboard: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <line x1="3" y1="9" x2="21" y2="9"></line>
      <line x1="9" y1="21" x2="9" y2="9"></line>
    </svg>
  ),
  Ventas: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1"></circle>
      <circle cx="20" cy="21" r="1"></circle>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
    </svg>
  ),
  Productos: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
      <line x1="12" y1="22.08" x2="12" y2="12"></line>
    </svg>
  ),
  Inventario: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13"></rect>
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
      <circle cx="5.5" cy="18.5" r="2.5"></circle>
      <circle cx="18.5" cy="18.5" r="2.5"></circle>
    </svg>
  ),
  Perdidas: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline>
      <polyline points="17 18 23 18 23 12"></polyline>
    </svg>
  )
};

// 2. Datos del Manual
interface Seccion {
  id: string;
  titulo: string;
  descripcion: string;
  icono: React.ReactNode;
  detalles: string[];
}

const datosManual: Seccion[] = [
  {
    id: 'dashboard',
    titulo: 'Panel de Control Principal',
    descripcion: 'Métricas, gráficas y resumen general del negocio.',
    icono: <Iconos.Dashboard />,
    detalles: [
      'Visualiza el total de productos activos en tu catálogo.',
      'Revisa las ventas acumuladas de la semana en tiempo real.',
      'Analiza la gráfica de tendencias para identificar los días con mayores ingresos.'
    ]
  },
  {
    id: 'ventas',
    titulo: 'Punto de Venta y Cobro',
    descripcion: 'Cómo procesar las compras de tus clientes de forma rápida.',
    icono: <Iconos.Ventas />,
    detalles: [
      'Utiliza la barra superior para buscar productos por código o nombre.',
      'Selecciona los artículos para agregarlos a la "Orden Actual".',
      'Ajusta las cantidades utilizando los controles en el panel lateral.',
      'Verifica el total y presiona el botón de cobro para finalizar la transacción.'
    ]
  },
  {
    id: 'productos',
    titulo: 'Gestión del Catálogo',
    descripcion: 'Administración de categorías, precios y nuevos artículos.',
    icono: <Iconos.Productos />,
    detalles: [
      'Crea categorías para mantener el inventario organizado.',
      'Registra nuevos productos asignando precios de compra y venta.',
      'Modifica o da de baja artículos directamente desde la tabla principal.'
    ]
  },
  {
    id: 'inventario',
    titulo: 'Entradas y Proveedores',
    descripcion: 'Registro de compras y abastecimiento de mercancía.',
    icono: <Iconos.Inventario />,
    detalles: [
      'Selecciona "Nueva Entrada" en el módulo de pedidos.',
      'Asigna la compra a un proveedor registrado.',
      'Ingresa las cantidades recibidas para que el stock se actualice automáticamente.'
    ]
  },
  {
    id: 'perdidas',
    titulo: 'Control de Mermas',
    descripcion: 'Registro de productos dañados o caducados.',
    icono: <Iconos.Perdidas />,
    detalles: [
      'Ingresa al módulo de pérdidas para reportar artículos no vendibles.',
      'Especifica la cantidad y el motivo para mantener la exactitud del inventario.',
      'Gestiona las devoluciones a los proveedores indicando si el producto regresa a stock o se desecha.'
    ]
  }
];

// 3. Componente Principal
export function GuiaUsuario(): React.JSX.Element {
  const [seccionAbierta, setSeccionAbierta] = useState<string | null>(datosManual[0].id);

  const toggleSeccion = (id: string) => {
    setSeccionAbierta(seccionAbierta === id ? null : id);
  };

  return (
    <div className="manual-wrapper">
      <style>{`
        .manual-wrapper {
          max-width: 800px;
          margin: 0 auto;
          padding: 40px 20px;
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          background-color: transparent;
        }

        .manual-header {
          text-align: center;
          margin-bottom: 40px;
        }

        .manual-header h1 {
          font-size: 2.5rem;
          font-weight: 700;
          color: #111827;
          margin: 0 0 10px 0;
          letter-spacing: -0.025em;
        }

        .manual-header p {
          font-size: 1.125rem;
          color: #6b7280;
          margin: 0;
        }

        .acordeon-container {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .acordeon-item {
          background-color: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          overflow: hidden;
          transition: all 0.3s ease;
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        }

        .acordeon-item.activo {
          border-color: #3b82f6;
          box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.1), 0 2px 4px -1px rgba(59, 130, 246, 0.06);
        }

        .acordeon-header {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          background: transparent;
          border: none;
          cursor: pointer;
          text-align: left;
          text-decoration: none;
          outline: none;
        }

        .acordeon-header:hover {
          background-color: #f9fafb;
        }

        .acordeon-titulo-grupo {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .icono-contenedor {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          border-radius: 10px;
          background-color: #eff6ff;
          color: #2563eb;
        }

        .textos-header h3 {
          margin: 0 0 4px 0;
          font-size: 1.125rem;
          font-weight: 600;
          color: #1f2937;
        }

        .textos-header p {
          margin: 0;
          font-size: 0.875rem;
          color: #6b7280;
        }

        .icono-flecha {
          color: #9ca3af;
          transition: transform 0.3s ease;
        }

        .acordeon-item.activo .icono-flecha {
          transform: rotate(180deg);
          color: #3b82f6;
        }

        .acordeon-contenido {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.4s ease-in-out;
          background-color: #ffffff;
        }

        .acordeon-item.activo .acordeon-contenido {
          max-height: 500px;
        }

        .contenido-interno {
          padding: 0 24px 24px 88px;
        }

        .lista-detalles {
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .lista-detalles li {
          position: relative;
          padding-left: 20px;
          margin-bottom: 12px;
          color: #4b5563;
          line-height: 1.5;
          font-size: 0.95rem;
        }

        .lista-detalles li::before {
          content: "";
          position: absolute;
          left: 0;
          top: 8px;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: #3b82f6;
        }

        .lista-detalles li:last-child {
          margin-bottom: 0;
        }
      `}</style>

      <div className="manual-header">
        <h1>Bienvenido a la guía de usuario</h1>
        <p>Aprende a utilizar las herramientas de tu sistema</p>
      </div>

      <div className="acordeon-container">
        {datosManual.map((seccion) => (
          <div 
            key={seccion.id} 
            className={`acordeon-item ${seccionAbierta === seccion.id ? 'activo' : ''}`}
          >
            <button 
              className="acordeon-header" 
              onClick={() => toggleSeccion(seccion.id)}
              aria-expanded={seccionAbierta === seccion.id}
            >
              <div className="acordeon-titulo-grupo">
                <div className="icono-contenedor">
                  {seccion.icono}
                </div>
                <div className="textos-header">
                  <h3>{seccion.titulo}</h3>
                  <p>{seccion.descripcion}</p>
                </div>
              </div>
              <div className="icono-flecha">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
            </button>
            
            <div className="acordeon-contenido">
              <div className="contenido-interno">
                <ul className="lista-detalles">
                  {seccion.detalles.map((detalle, index) => (
                    <li key={index}>{detalle}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}