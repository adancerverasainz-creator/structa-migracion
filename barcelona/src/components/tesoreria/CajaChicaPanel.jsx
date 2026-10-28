import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/base44Client';
import { confirmar } from '@/components/ui/confirmar';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowUpCircle, ArrowDownCircle, Wallet, PiggyBank, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '../lib/formatCurrency';

/**
 * Caja chica (fondo de quien cobra): de aquí salen los gastos en efectivo del día a día.
 * Entra por: corte de cobranza pasado a caja chica, reposición desde Fondos (admin),
 * sobrante de arqueo. Sale por: gastos/abonos CxP con cuenta "Caja chica", faltante de arqueo.
 * El fondo fijo es la referencia de cuánto debería tener (Configuración → caja_chica.fondo_fijo).
 */
export default function CajaChicaPanel({ expenses = [], saldoServidor = null, fondoFijo = 0, isAdmin = false, onArqueo }) {
  const queryClient = useQueryClient();
  const [showReponer, setShowReponer] = useState(false);
  const [monto, setMonto] = useState('');
  const [notas, setNotas] = useState('');

  const ingresos = expenses.filter((e) => e.is_transfer && e.transfer_to === 'Caja chica');
  const egresos = expenses.filter((e) => e.account === 'Caja chica');
  const movimientos = [
    ...ingresos.map((e) => ({
      id: e.id, type: 'ingreso', amount: Number(e.amount) || 0, date: e.expense_date,
      description: e.concept,
      origen: e.source_module === 'corte' ? 'Corte' : e.source_module === 'arqueo' ? 'Arqueo' : e.account === 'Fondos' ? 'Fondos' : 'Tesorería',
    })),
    ...egresos.map((e) => ({
      id: e.id, type: 'egreso', amount: Number(e.amount) || 0, date: e.expense_date,
      description: e.concept,
      origen: e.source_module === 'cxp' ? 'CxP' : e.source_module === 'arqueo' ? 'Arqueo' : e.is_transfer ? 'Traspaso' : 'Egresos',
      reverso: Number(e.amount) < 0 || !!e.reversal_of,
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date) || 0);
  {
    let acc = 0;
    [...movimientos].reverse().forEach((m) => { acc += (m.type === 'ingreso' ? 1 : -1) * m.amount; m.balanceAfter = acc; });
  }
  const totalIn = saldoServidor ? Number(saldoServidor.ingresos) : ingresos.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const totalOut = saldoServidor ? Number(saldoServidor.egresos) : egresos.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const saldo = saldoServidor ? Number(saldoServidor.saldo) : totalIn - totalOut;
  const porReponer = Math.max(0, (Number(fondoFijo) || 0) - saldo);

  const reponer = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('reponer_caja_chica_desde_fondos', {
        p_monto: Number(monto), p_notas: notas || null, p_op_key: (crypto.randomUUID ? crypto.randomUUID() : null),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      ['saldosPorCuenta', 'allExpensesForFondos', 'expenses'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      toast.success('Reposición registrada: salió de Fondos y entró a Caja chica');
      setShowReponer(false); setMonto(''); setNotas('');
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          Caja chica: el fondo con el que se pagan los gastos en efectivo sin esperar al CEO. Entra desde los cortes de
          cobranza ("Pasar a Caja chica") o por reposición desde Fondos; sale con cada gasto o abono CxP pagado desde esta caja.
        </p>
        <div className="flex gap-2 flex-shrink-0">
          {onArqueo && (
            <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => onArqueo('Caja chica')}>
              <DollarSign className="w-4 h-4 mr-1" /> Arqueo
            </Button>
          )}
          {isAdmin && (
            <Button className="bg-green-700 hover:bg-green-800" onClick={() => { setMonto(porReponer > 0 ? String(porReponer) : ''); setShowReponer(true); }}>
              <PiggyBank className="w-4 h-4 mr-2" /> Reponer desde Fondos
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-2 border-blue-200"><CardContent className="pt-6">
          <p className="text-sm text-gray-600 mb-1">Saldo en Caja chica</p>
          <p className={`text-2xl font-bold ${saldo >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{formatCurrency(saldo)}</p>
        </CardContent></Card>
        <Card className="border-2 border-gray-200"><CardContent className="pt-6">
          <p className="text-sm text-gray-600 mb-1">Fondo fijo de referencia</p>
          <p className="text-2xl font-bold text-gray-800">{formatCurrency(Number(fondoFijo) || 0)}</p>
          {porReponer > 0
            ? <p className="text-xs text-amber-700 mt-1">Por reponer: {formatCurrency(porReponer)}</p>
            : <p className="text-xs text-green-700 mt-1">Fondo completo</p>}
        </CardContent></Card>
        <Card className="border-2 border-green-200"><CardContent className="pt-6">
          <p className="text-sm text-gray-600 mb-1">Entradas</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalIn)}</p>
        </CardContent></Card>
        <Card className="border-2 border-red-200"><CardContent className="pt-6">
          <p className="text-sm text-gray-600 mb-1">Gastos pagados</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totalOut)}</p>
        </CardContent></Card>
      </div>

      {showReponer && (
        <Card className="border-2 border-green-300">
          <CardHeader><CardTitle className="text-base">Reponer Caja chica desde Fondos</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Monto en efectivo que entregas *</Label>
                <Input type="number" min="0.01" step="0.01" value={monto} onWheel={(e) => e.target.blur()} onChange={(e) => setMonto(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Notas</Label>
                <Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Opcional" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowReponer(false)}>Cancelar</Button>
              <Button className="bg-green-700 hover:bg-green-800" disabled={!(Number(monto) > 0) || reponer.isPending}
                onClick={async () => {
                  const ok = await confirmar(`Confirma que entregas ${formatCurrency(Number(monto))} de Fondos a la Caja chica.`, { titulo: 'Reponer Caja chica', confirmLabel: 'Sí, registrar' });
                  if (ok) reponer.mutate();
                }}>
                Registrar reposición
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Wallet className="w-5 h-5" /> Libro de Caja chica</CardTitle>
        </CardHeader>
        <CardContent>
          {movimientos.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Sin movimientos todavía.</p>
          ) : (
            <div className="space-y-2">
              {movimientos.slice(0, 100).map((m) => (
                <div key={`${m.type}-${m.id}`} className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg ${m.type === 'ingreso' ? 'bg-green-100' : 'bg-red-100'}`}>
                      {m.type === 'ingreso' ? <ArrowUpCircle className="w-5 h-5 text-green-600" /> : <ArrowDownCircle className="w-5 h-5 text-red-600" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{m.description}</p>
                      <p className="text-xs text-gray-500">
                        {m.date ? format(new Date(m.date + 'T00:00:00'), "d 'de' MMMM, yyyy", { locale: es }) : '—'}
                        <Badge variant="outline" className="ml-2 text-[10px]">{m.origen}</Badge>
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-lg font-bold ${m.type === 'ingreso' ? 'text-green-600' : 'text-red-600'}`}>
                      {(m.type === 'ingreso' ? 1 : -1) * m.amount >= 0 ? '+' : '-'}{formatCurrency(Math.abs(m.amount))}
                    </span>
                    <p className="text-xs text-gray-500">Saldo: {formatCurrency(m.balanceAfter ?? 0)}</p>
                  </div>
                </div>
              ))}
              <p className="text-xs text-gray-400">Los gastos se capturan en Egresos / Cuentas por Pagar eligiendo "Caja chica" como caja de origen; aquí son de consulta.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
