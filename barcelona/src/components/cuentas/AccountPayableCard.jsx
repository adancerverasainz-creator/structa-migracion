import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DollarSign, Calendar, Edit, Trash2, Plus, ChevronDown, ChevronUp, Building2 } from 'lucide-react';
import { format, parseISO, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '../lib/formatCurrency';

const CATEGORY_LABELS = {
  nomina: 'Nómina', proveedor: 'Proveedor', arbitros: 'Árbitros',
  renta: 'Renta', equipamiento: 'Equipamiento', torneo: 'Torneo',
  viaticos: 'Viáticos', hospedaje: 'Hospedaje', transporte: 'Transporte',
  intereses: 'Intereses', otros: 'Otros',
};

const STATUS_CONFIG = {
  pendiente: { label: 'Pendiente', className: 'bg-red-100 text-red-700 border-red-300' },
  parcial: { label: 'Parcial', className: 'bg-amber-100 text-amber-700 border-amber-300' },
  pagado: { label: 'Pagado', className: 'bg-green-100 text-green-700 border-green-300' },
};

export default function AccountPayableCard({ account, payments, onEdit, onDelete, onAbono, isAdmin }) {
  const [expanded, setExpanded] = React.useState(false);

  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const pending = (account.total_amount || 0) - totalPaid;
  const progress = account.total_amount > 0 ? Math.min((totalPaid / account.total_amount) * 100, 100) : 0;
  const isOverdue = account.due_date && account.status !== 'pagado' && isPast(parseISO(account.due_date));
  const statusCfg = STATUS_CONFIG[account.status] || STATUS_CONFIG.pendiente;

  return (
    <Card className={`border-2 transition-all hover:shadow-lg ${isOverdue ? 'border-red-300' : account.status === 'pagado' ? 'border-green-200' : 'border-indigo-200'}`}>
      <CardContent className="pt-4 pb-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Info principal */}
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="text-base font-bold text-gray-900">{account.concept}</h3>
              <Badge className={`border text-xs ${statusCfg.className}`}>{statusCfg.label}</Badge>
              {account.category && <Badge variant="outline" className="text-xs">{CATEGORY_LABELS[account.category] || account.category}</Badge>}
              {isOverdue && <Badge className="bg-red-600 text-white text-xs">Vencida</Badge>}
            </div>
            {account.supplier && (
              <p className="text-sm text-gray-500 flex items-center gap-1 mb-2">
                <Building2 className="w-3.5 h-3.5" /> {account.supplier}
              </p>
            )}
            {/* Barra de progreso */}
            <div className="mb-2">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Pagado: {formatCurrency(totalPaid)}</span>
                <span>Total: {formatCurrency(account.total_amount)}</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${progress >= 100 ? 'bg-green-500' : progress > 0 ? 'bg-amber-500' : 'bg-red-400'}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            {account.due_date && (
              <p className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                <Calendar className="w-3.5 h-3.5" />
                Vence: {format(parseISO(account.due_date), "d 'de' MMMM yyyy", { locale: es })}
                {isOverdue && ' ⚠️ Vencida'}
              </p>
            )}
          </div>

          {/* Montos y acciones */}
          <div className="flex flex-col items-end justify-between gap-2 min-w-[150px]">
            <div className="text-right">
              <p className="text-xs text-gray-500">Pendiente</p>
              <p className={`text-2xl font-bold ${pending <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(Math.max(pending, 0))}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
              {account.status !== 'pagado' && (
                <Button size="sm" className="bg-green-600 hover:bg-green-700 h-8 text-xs" onClick={() => onAbono(account)}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Abonar
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onEdit(account)}>
                <Edit className="w-3.5 h-3.5" />
              </Button>
              {isAdmin && (
                <Button size="sm" variant="outline" className="h-8 text-xs border-red-300 text-red-600 hover:bg-red-50" onClick={() => onDelete(account)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Historial de abonos */}
        {payments.length > 0 && (
          <div className="mt-3 border-t pt-3">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 font-medium"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {payments.length} abono{payments.length !== 1 ? 's' : ''} registrado{payments.length !== 1 ? 's' : ''}
            </button>
            {expanded && (
              <div className="mt-2 space-y-2">
                {payments.map(p => (
                  <div key={p.id} className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">{format(parseISO(p.payment_date), "d MMM yyyy", { locale: es })}</span>
                      <span className="text-gray-400 mx-2">•</span>
                      <span className="text-gray-500">{p.payment_method}{p.bank_name && ` - ${p.bank_name}`}</span>
                      {p.reference_number && <span className="text-gray-400 ml-2 text-xs">Ref: {p.reference_number}</span>}
                      {p.notes && <p className="text-xs text-gray-400 mt-0.5">{p.notes}</p>}
                    </div>
                    <span className="font-bold text-green-600">{formatCurrency(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}