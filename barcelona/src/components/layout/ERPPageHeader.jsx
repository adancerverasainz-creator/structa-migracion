import React from 'react';

/**
 * ERPPageHeader - Encabezado profesional estilo ERP para todas las páginas.
 * Props:
 *   icon: componente icono (Lucide)
 *   iconColor: clase de color Tailwind para el icono (ej: "text-blue-600")
 *   iconBg: clase de fondo del icono (ej: "bg-blue-100")
 *   title: título principal
 *   subtitle: subtítulo descriptivo
 *   breadcrumb: array de strings ["Módulo", "Sección"] (opcional)
 *   actions: nodo React con los botones/acciones
 */
export default function ERPPageHeader({ icon: Icon, iconColor = 'text-gray-700', iconBg = 'bg-gray-100', title, subtitle, breadcrumb, actions }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-6">
      <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {Icon && (
            <div className={`p-3 rounded-xl ${iconBg} flex-shrink-0`}>
              <Icon className={`w-6 h-6 ${iconColor}`} />
            </div>
          )}
          <div>
            {breadcrumb && breadcrumb.length > 0 && (
              <nav className="flex items-center gap-1 mb-0.5">
                {breadcrumb.map((crumb, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span className="text-gray-300 text-xs">/</span>}
                    <span className={`text-xs font-medium ${i === breadcrumb.length - 1 ? 'text-gray-500' : 'text-gray-400'}`}>{crumb}</span>
                  </React.Fragment>
                ))}
              </nav>
            )}
            <h1 className="text-xl font-bold text-gray-900 leading-tight">{title}</h1>
            {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}