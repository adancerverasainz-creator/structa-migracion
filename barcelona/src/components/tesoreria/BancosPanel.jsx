import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowUpCircle, ArrowDownCircle, Landmark } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '../lib/formatCurrency';

/**
 * Bancos (Tesorería): saldos por cuenta desde la RPC saldos_por_cuenta
 * (fuente única) y movimientos por banco. Solo consulta.
 */
export default function BancosPanel({ saldos = [], payments = [], expenses = [] }) {
  const cuentasBanco = saldos.filter(s => !['Efectivo', 'Fondos (caja)'].includes(s.cuenta));
  const [cuentaSel, setCuentaSel] = useState(null);

  const movimientosDe = (cuenta) => {
    const esTarjeta = cuenta === 'Tarjeta';
    const ins = payments.filter(p => esTarjeta
      ? p.payment_method === 'tarjeta'
      : p.payment_method === 'transferencia' && p.bank_name === cuenta)
      .map(p => ({ id: p.id, type: 'ingreso', amount: p.paid_amount ?? p.amount ?? 0, date: (p.payment_date || '').slice(0, 10), description: `Cobro${p.month ? ` (${p.month})` : p.concept ? ` — ${p.concept}` : ''}`, origen: 'Pagos' }));
    const outs = expenses.filter(e => esTarjeta
      ? e.payment_method === 'tarjeta'
      : e.payment_method === 'transferencia' && e.account === cuenta)
      .map(e => ({ id: e.id, type: 'egreso', amount: e.amount || 0, date: e.expense_date, description: e.concept, origen: e.source_module === 'cxp' ? 'CxP' : 'Egresos' }));
    return [...ins, ...outs].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 50);
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Saldos calculados por la fuente única del sistema (misma cifra que Pagos y Dashboard).
        Haz clic en una cuenta para ver sus movimientos recientes.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cuentasBanco.map(c => (
          <Card key={c.cuenta}
            onClick={() => setCuentaSel(cuentaSel === c.cuenta ? null : c.cuenta)}
            className={`cursor-pointer transition-all border-2 ${cuentaSel === c.cuenta ? 'border-blue-400 shadow-md' : 'border-gray-200 hover:border-blue-200'}`}>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-blue-600" /> {c.cuenta}
                </p>
              </div>
              <p className={`text-2xl font-bold ${Number(c.saldo) >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{formatCurrency(c.saldo)}</p>
              <p className="text-xs text-gray-400 mt-1">
                In: {formatCurrency(c.ingresos)} · Out: {formatCurrency(c.egresos)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {cuentaSel && (
        <Card>
          <CardHeader><CardTitle className="text-base">Movimientos recientes — {cuentaSel}</CardTitle></CardHeader>
          <CardContent>
            {movimientosDe(cuentaSel).length === 0 ? (
              <p className="text-center text-gray-500 py-6">Sin movimientos registrados.</p>
            ) : (
              <div className="space-y-2">
                {movimientosDe(cuentaSel).map(m => (
                  <div key={`${m.type}-${m.id}`} className="flex items-center justify-between gap-3 border rounded-lg p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {m.type === 'ingreso'
                        ? <ArrowUpCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                        : <ArrowDownCircle className="w-5 h-5 text-red-600 flex-shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{m.description}</p>
                        <p className="text-xs text-gray-500">{m.date && format(new Date(m.date + 'T00:00:00'), 'dd/MM/yyyy')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <p className={`font-bold ${m.type === 'ingreso' ? 'text-green-600' : 'text-red-600'}`}>
                        {m.type === 'ingreso' ? '+' : '-'}{formatCurrency(m.amount)}
                      </p>
                      <Badge className="bg-gray-100 text-gray-600">{m.origen}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
