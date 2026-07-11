import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Calendar, Shirt, User, Pencil, Trash2, CheckCircle } from 'lucide-react';
import { formatCurrency } from '../lib/formatCurrency';
import { format } from 'date-fns';

const WEEK_PRICE = 1200;
const UNIFORM_PRICE = 950;

const STATUS_STYLES = {
  pendiente: 'bg-amber-100 text-amber-700 border-amber-200',
  parcial: 'bg-blue-100 text-blue-700 border-blue-200',
};

export default function SummerCampDebtors({ payments, players, onEdit, onDelete }) {
  // Solo los que NO están completamente pagados
  const debtors = payments.filter(p => p.status === 'pendiente' || p.status === 'parcial');

  const getPlayerName = (p) => {
    if (p.player_name) return p.player_name;
    return players.find(pl => pl.id === p.player_id)?.full_name || '—';
  };

  const getPendingAmount = (p) => {
    const base = p.base_amount || (p.payment_type === 'semana' ? WEEK_PRICE : UNIFORM_PRICE);
    if (p.status === 'pendiente') return base - (p.discount || 0);
    // parcial: lo que pagó vs lo que debía
    return Math.max(0, base - (p.discount || 0) - (p.amount || 0));
  };

  const totalPendiente = debtors.reduce((s, p) => s + getPendingAmount(p), 0);

  if (debtors.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <AlertCircle className="w-10 h-10 mx-auto mb-3 text-gray-300" />
        <p className="text-lg font-medium">Sin deudores</p>
        <p className="text-sm mt-1">Todos los pagos están al corriente</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
        <div>
          <p className="font-semibold text-red-700">{debtors.length} pagos pendientes / parciales</p>
          <p className="text-sm text-red-500">Total por cobrar: <span className="font-bold">{formatCurrency(totalPendiente)}</span></p>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Jugador</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Concepto</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Total</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Pagado</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600 text-red-600">Pendiente</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Estado</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Fecha</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {debtors.map(p => {
              const total = (p.base_amount || (p.payment_type === 'semana' ? WEEK_PRICE : UNIFORM_PRICE)) - (p.discount || 0);
              const pagado = p.status === 'pendiente' ? 0 : (p.amount || 0);
              const pendiente = getPendingAmount(p);
              return (
                <tr key={p.id} className="hover:bg-red-50/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900">{getPlayerName(p)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {p.payment_type === 'semana' ? (
                      <div className="flex items-center gap-1.5 text-sky-700">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Semana {p.week_number}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-orange-600">
                        <Shirt className="w-3.5 h-3.5" />
                        <span>Uniformes</span>
                      </div>
                    )}
                    {p.notes && <p className="text-xs text-gray-400 mt-0.5">{p.notes}</p>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(total)}</td>
                  <td className="px-4 py-3 text-right text-green-600 font-medium">
                    {pagado > 0 ? formatCurrency(pagado) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-red-600">{formatCurrency(pendiente)}</td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs border ${STATUS_STYLES[p.status]}`}>{p.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {p.payment_date ? (() => { const [y,m,d] = p.payment_date.slice(0,10).split('-'); return format(new Date(y,m-1,d), 'dd/MM/yyyy'); })() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {onEdit && (
                        <Button size="sm" onClick={() => onEdit(p)} className="h-7 px-2.5 gap-1 text-xs bg-sky-600 hover:bg-sky-700 text-white">
                          <CheckCircle className="w-3 h-3" /> Marcar Pagado
                        </Button>
                      )}
                      {onDelete && (
                        <Button size="sm" variant="outline" onClick={() => onDelete(p)} className="h-7 px-2 gap-1 text-xs text-red-600 border-red-200 hover:bg-red-50">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}