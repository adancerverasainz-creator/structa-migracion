import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Trash2, Search, Calendar, Shirt } from 'lucide-react';
import { formatCurrency } from '../lib/formatCurrency';
import { format } from 'date-fns';

const STATUS_STYLES = {
  pagado: 'bg-green-100 text-green-700 border-green-200',
  pendiente: 'bg-amber-100 text-amber-700 border-amber-200',
  parcial: 'bg-blue-100 text-blue-700 border-blue-200',
};

const METHOD_LABELS = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' };

export default function SummerCampList({ payments, players, isLoading, onEdit, onDelete, filterType }) {
  const [search, setSearch] = useState('');

  const getPlayerName = (p) => {
    if (p.player_name) return p.player_name;
    return players.find(pl => pl.id === p.player_id)?.full_name || '—';
  };

  const filtered = payments
    .filter(p => filterType ? p.payment_type === filterType : true)
    .filter(p => {
      const name = getPlayerName(p).toLowerCase();
      return name.includes(search.toLowerCase());
    });

  if (isLoading) return <div className="text-center py-12 text-gray-400">Cargando...</div>;

  return (
    <div className="space-y-4">
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Buscar jugador..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-medium">Sin registros</p>
          <p className="text-sm mt-1">Registra el primer pago con el botón superior</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Jugador</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Concepto</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Base</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Descuento</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Total</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Método</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Fecha</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Estado</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{getPlayerName(p)}</td>
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
                    {p.discount_reason && <p className="text-xs text-gray-400 mt-0.5">Desc: {p.discount_reason}</p>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">{formatCurrency(p.base_amount)}</td>
                  <td className="px-4 py-3 text-right">
                    {p.discount > 0
                      ? <span className="text-red-500 font-medium">-{formatCurrency(p.discount)}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(p.amount)}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {METHOD_LABELS[p.payment_method]}
                    {p.bank_name && <span className="text-xs text-gray-400 ml-1">({p.bank_name})</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {p.payment_date ? (() => { const [y,m,d] = p.payment_date.slice(0,10).split('-'); return format(new Date(y,m-1,d), 'dd/MM/yyyy'); })() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs border ${STATUS_STYLES[p.status] || STATUS_STYLES.pagado}`}>
                      {p.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-blue-600" onClick={() => onEdit(p)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-red-600" onClick={() => onDelete(p)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}