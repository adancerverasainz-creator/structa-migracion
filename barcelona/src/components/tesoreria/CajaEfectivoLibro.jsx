import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowUpCircle, ArrowDownCircle, Banknote, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '../lib/formatCurrency';

/**
 * Libro de la Caja Efectivo (operativa): todo cobro en efectivo entra aquí y
 * todo gasto en efectivo sale de aquí. Los movimientos se administran en sus
 * módulos de origen (Pagos/Egresos); este libro es de consulta + Corte de Caja.
 */
export default function CajaEfectivoLibro({ payments, expenses, cortes = [], onCorte }) {
  const ingresos = payments.filter(p =>
    p.payment_method === 'efectivo' && (p.bank_name || '') !== 'Fondos' &&
    (!p.status || p.status === 'pagado' || p.status === 'abono'));
  const egresos = expenses.filter(e => e.payment_method === 'efectivo');

  const movimientos = [
    ...ingresos.map(p => ({
      id: p.id, type: 'ingreso',
      amount: p.paid_amount ?? p.amount ?? 0,
      date: (p.payment_date || '').slice(0, 10),
      description: `Cobro en efectivo${p.month ? ` (${p.month})` : p.concept ? ` — ${p.concept}` : ''}`,
      origen: 'Pagos',
    })),
    ...egresos.map(e => ({
      id: e.id, type: 'egreso',
      amount: e.amount || 0,
      date: e.expense_date,
      description: e.concept,
      origen: e.source_module === 'tesoreria' ? 'Corte' : e.source_module === 'cxp' ? 'CxP' : 'Egresos',
      esCorte: e.source_module === 'tesoreria' && e.is_transfer,
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  {
    let acumulado = 0;
    [...movimientos].reverse().forEach(m => {
      acumulado += (m.type === 'ingreso' ? 1 : -1) * (m.amount || 0);
      m.balanceAfter = acumulado;
    });
  }

  const totalIn = ingresos.reduce((s, p) => s + (p.paid_amount ?? p.amount ?? 0), 0);
  const totalOut = egresos.reduce((s, e) => s + (e.amount || 0), 0);
  const saldo = totalIn - totalOut;
  const visibles = movimientos.slice(0, 100);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          Caja operativa: aquí entra todo cobro en efectivo del día a día. Los movimientos se
          corrigen en su módulo de origen; desde aquí se hace el <b>Corte de Caja</b> para
          entregar el efectivo en custodia.
        </p>
        <Button onClick={onCorte} className="bg-green-700 hover:bg-green-800 flex-shrink-0">
          <Banknote className="w-4 h-4 mr-2" /> Corte de Caja
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-2 border-green-200"><CardContent className="pt-6">
          <p className="text-sm text-gray-600 mb-1">Ingresos en efectivo</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalIn)}</p>
        </CardContent></Card>
        <Card className="border-2 border-red-200"><CardContent className="pt-6">
          <p className="text-sm text-gray-600 mb-1">Salidas en efectivo</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totalOut)}</p>
        </CardContent></Card>
        <Card className="border-2 border-blue-200"><CardContent className="pt-6">
          <p className="text-sm text-gray-600 mb-1">Saldo en caja</p>
          <p className="text-2xl font-bold text-blue-700">{formatCurrency(saldo)}</p>
        </CardContent></Card>
      </div>

      {cortes.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Últimos cortes de caja</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {cortes.map(c => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 border rounded-lg p-3 text-sm">
                <div>
                  <p className="font-semibold text-gray-900">
                    {formatCurrency(c.monto_entregado)} entregados a {c.recibe}
                  </p>
                  <p className="text-xs text-gray-500">
                    {format(new Date(c.created_at), 'dd/MM/yyyy HH:mm')} — entrega: {c.entrega}
                    {c.notas ? ` — ${c.notas}` : ''}
                  </p>
                </div>
                <Badge className={Number(c.diferencia) === 0 ? 'bg-green-100 text-green-700' : Number(c.diferencia) > 0 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'}>
                  {Number(c.diferencia) === 0 ? 'Caja cuadrada' : Number(c.diferencia) > 0 ? `Sobrante ${formatCurrency(c.diferencia)}` : `Faltante ${formatCurrency(Math.abs(c.diferencia))}`}
                </Badge>
              </div>
            ))}
            <p className="text-xs text-gray-400">Las actas de corte son inmutables y quedan en Auditoría.</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" /> Libro de Caja Efectivo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {visibles.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Sin movimientos en efectivo.</p>
          ) : (
            <div className="space-y-2">
              {visibles.map(m => (
                <div key={`${m.type}-${m.id}`} className="flex items-center justify-between gap-3 border rounded-lg p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {m.type === 'ingreso'
                      ? <ArrowUpCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                      : <ArrowDownCircle className={`w-5 h-5 flex-shrink-0 ${m.esCorte ? 'text-blue-600' : 'text-red-600'}`} />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{m.description}</p>
                      <p className="text-xs text-gray-500">{m.date && format(new Date(m.date + 'T00:00:00'), 'dd/MM/yyyy')}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`font-bold ${m.type === 'ingreso' ? 'text-green-600' : m.esCorte ? 'text-blue-700' : 'text-red-600'}`}>
                      {m.type === 'ingreso' ? '+' : '-'}{formatCurrency(m.amount)}
                    </p>
                    <p className="text-xs text-gray-400">Saldo: {formatCurrency(m.balanceAfter)}</p>
                  </div>
                  <Badge className="bg-gray-100 text-gray-600 flex-shrink-0">{m.esCorte ? '→ Fondos' : `Origen: ${m.origen}`}</Badge>
                </div>
              ))}
              {movimientos.length > 100 && (
                <p className="text-xs text-gray-400 text-center pt-2">Mostrando los 100 movimientos más recientes de {movimientos.length}.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
