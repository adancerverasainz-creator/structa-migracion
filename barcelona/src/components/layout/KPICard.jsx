import React from 'react';

/**
 * KPICard - Tarjeta de métrica estilo ERP.
 * Props:
 *   title: etiqueta de la métrica
 *   value: valor principal
 *   icon: componente Lucide
 *   iconColor, iconBg
 *   trend: "up" | "down" | null
 *   trendLabel: texto adicional bajo el valor
 *   color: "blue" | "green" | "red" | "orange" | "purple" | "gray"
 *   className: clases adicionales
 */
const colorMap = {
  blue:   { border: 'border-blue-100',   bg: 'bg-blue-50',   value: 'text-blue-700',   iconBg: 'bg-blue-100',   iconColor: 'text-blue-600' },
  green:  { border: 'border-green-100',  bg: 'bg-green-50',  value: 'text-green-700',  iconBg: 'bg-green-100',  iconColor: 'text-green-600' },
  red:    { border: 'border-red-100',    bg: 'bg-red-50',    value: 'text-red-700',    iconBg: 'bg-red-100',    iconColor: 'text-red-600' },
  orange: { border: 'border-orange-100', bg: 'bg-orange-50', value: 'text-orange-700', iconBg: 'bg-orange-100', iconColor: 'text-orange-600' },
  purple: { border: 'border-purple-100', bg: 'bg-purple-50', value: 'text-purple-700', iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
  gray:   { border: 'border-gray-100',   bg: 'bg-gray-50',   value: 'text-gray-700',   iconBg: 'bg-gray-100',   iconColor: 'text-gray-500' },
};

export default function KPICard({ title, value, icon: Icon, iconColor, iconBg, trendLabel, color = 'blue', className = '' }) {
  const c = colorMap[color] || colorMap.blue;
  const finalIconBg = iconBg || c.iconBg;
  const finalIconColor = iconColor || c.iconColor;

  return (
    <div className={`bg-white border ${c.border} rounded-xl p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow ${className}`}>
      {Icon && (
        <div className={`p-2.5 rounded-lg ${finalIconBg} flex-shrink-0 mt-0.5`}>
          <Icon className={`w-5 h-5 ${finalIconColor}`} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">{title}</p>
        <p className={`text-2xl font-bold mt-0.5 ${c.value}`}>{value}</p>
        {trendLabel && (
          <p className="text-xs text-gray-400 mt-1 truncate">{trendLabel}</p>
        )}
      </div>
    </div>
  );
}