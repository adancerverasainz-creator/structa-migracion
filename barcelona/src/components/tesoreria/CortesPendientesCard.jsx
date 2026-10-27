import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/base44Client';
import { confirmar } from '@/components/ui/confirmar';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '../lib/formatCurrency';

/**
 * Cortes de cobranza por día (modelo de tres cajas):
 *   neto del día = cobros en efectivo − gastos pagados de la cobranza (histórico; hoy 0)
 *   cada día se liquida hacia uno o varios destinos: Fondos (CEO, queda "en tránsito"
 *   hasta que él confirma), Caja chica (fondo de Carmen) o depósito en banco.
 * El monto lo calcula el servidor; aquí solo se elige destino y, si es parcial, cuánto.
 */
const FECHA = (d) => format(new Date(d + 'T12:00:00'), "dd 'de' MMMM yyyy", { locale: es });
const invalidar = (qc) => ['cortesPendientes', 'cortesPendientesV2', 'cashRegisters', 'saldosPorCuenta', 'allExpensesForFondos', 'expenses']
  .forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

export default function CortesPendientesCard({ isAdmin, cashRegisters = [], bancos = [], compacto = false }) {
  const queryClient = useQueryClient();
  const { data: cortes = [] } = useQuery({
    queryKey: ['cortesPendientesV2'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('cortes_pendientes_v2');
      if (error) throw new Error(error.message);
      return data || [];
    },
  });
  // destino y monto elegidos por día: { [fecha]: { destino, monto } }
  const [sel, setSel] = useState({});
  const getSel = (c) => sel[c.fecha] || { destino: 'Fondos', monto: '' };

  const liquidar = useMutation({
    mutationFn: async ({ c, destino, monto }) => {
      const op = crypto.randomUUID ? crypto.randomUUID() : null;
      const args = { p_fecha: c.fecha, p_monto: monto, p_op_key: op };
      let r;
      if (destino === 'Fondos') r = await supabase.rpc('entregar_corte_monto', args);
      else if (destino === 'Caja chica') r = await supabase.rpc('corte_a_caja_chica', args);
      else r = await supabase.rpc('corte_a_banco', { ...args, p_banco: destino });
      if (r.error) throw new Error(r.error.message);
      return destino;
    },
    onSuccess: (destino) => {
      invalidar(queryClient);
      toast.success(destino === 'Fondos' ? 'Entrega registrada — queda en tránsito hasta que el CEO confirme'
        : destino === 'Caja chica' ? 'Cobranza pasada a Caja chica' : `Depósito en ${destino} registrado`);
    },
    onError: (e) => toast.error(e.message),
  });

  const entregasTransito = (cashRegisters || []).filter((r) => r.corte_fecha && !r.recibido_at);
  const confirmarRecepcion = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.rpc('confirmar_recepcion_corte', { p_cash_id: id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { invalidar(queryClient); toast.success('Recepción confirmada — corte cerrado con doble firma'); },
    onError: (e) => toast.error(`No se confirmó la recepción: ${e.message}`),
  });

  const pendientes = cortes.filter((c) => !c.es_hoy && Number(c.pendiente) > 0.005);
  const porEntregar = pendientes.reduce((s, c) => s + Number(c.pendiente), 0);
  const hoy = cortes.find((c) => c.es_hoy);
  const descuadrados = cortes.filter((c) => !c.es_hoy && Number(c.pendiente) < -0.005);

  return (
    <Card className={`border-2 ${pendientes.length ? 'border-amber-300' : 'border-gray-200'}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><Wallet className="w-5 h-5 text-amber-600" /> Cortes de cobranza por liquidar</span>
          {porEntregar > 0
            ? <Badge className="bg-amber-500 text-white">Efectivo en poder de caja: {formatCurrency(porEntregar)}</Badge>
            : <Badge className="bg-green-100 text-green-700">Al día</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!compacto && (
          <p className="text-xs text-gray-500">
            Cada día de cobranza se liquida completo: a <b>Fondos</b> (queda en tránsito hasta que el CEO confirma),
            a <b>Caja chica</b> (para pagar gastos sin esperar al CEO) o <b>depositado en banco</b>. Puedes repartir un mismo día entre destinos.
          </p>
        )}
        {hoy && (
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm">
            <span className="font-semibold">{FECHA(hoy.fecha)}</span>
            <Badge className="ml-2 bg-blue-600">día en curso</Badge>
            <p className="text-xs text-gray-600 mt-1">
              Cobros en efectivo <b>{formatCurrency(Number(hoy.cobros))}</b> · se liquida mañana con el día cerrado.
            </p>
          </div>
        )}
        {pendientes.length === 0 && !hoy && (
          <p className="text-sm text-green-700 font-medium">Sin cortes pendientes de liquidar.</p>
        )}
        {pendientes.map((c) => {
          const pend = Number(c.pendiente);
          const s = getSel(c);
          const monto = s.monto === '' ? pend : Number(s.monto);
          const montoOk = monto > 0 && monto <= pend + 0.005;
          const liquidado = Number(c.entregado) > 0;
          return (
            <div key={c.fecha} className="p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-2">
              <div className="text-sm">
                <span className="font-semibold">{FECHA(c.fecha)}</span>
                <p className="text-xs text-gray-600 mt-1">
                  Cobros {formatCurrency(Number(c.cobros))}
                  {Number(c.gastos) > 0 ? ` − gastos de cobranza ${formatCurrency(Number(c.gastos))}` : ''} = <b>{formatCurrency(Number(c.neto))}</b>
                  {liquidado && (
                    <> · ya liquidado {formatCurrency(Number(c.entregado))}
                      {Number(c.a_fondos) > 0 ? ` (Fondos ${formatCurrency(Number(c.a_fondos))})` : ''}
                      {Number(c.a_caja_chica) > 0 ? ` (Caja chica ${formatCurrency(Number(c.a_caja_chica))})` : ''}
                      {Number(c.a_banco) > 0 ? ` (banco ${formatCurrency(Number(c.a_banco))})` : ''}
                    </>
                  )}
                  {' · '}<b className="text-amber-800">pendiente {formatCurrency(pend)}</b>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={s.destino} onValueChange={(v) => setSel({ ...sel, [c.fecha]: { ...s, destino: v } })}>
                  <SelectTrigger className="h-8 w-[200px] bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fondos">Entregar a Fondos (CEO)</SelectItem>
                    <SelectItem value="Caja chica">Pasar a Caja chica</SelectItem>
                    {bancos.map((b) => <SelectItem key={b} value={b}>Depositar en {b}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="number" min="0.01" step="0.01" className="h-8 w-[130px] bg-white" placeholder={String(pend)}
                  value={s.monto} onWheel={(e) => e.target.blur()}
                  onChange={(e) => setSel({ ...sel, [c.fecha]: { ...s, monto: e.target.value } })} />
                <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700"
                  disabled={!montoOk || liquidar.isPending}
                  onClick={async () => {
                    const destinoTxt = s.destino === 'Fondos' ? 'Caja Fondos (CEO)' : s.destino === 'Caja chica' ? 'tu Caja chica' : `la cuenta ${s.destino}`;
                    const ok = await confirmar(
                      `Confirma que ${formatCurrency(monto)} de la cobranza del ${FECHA(c.fecha)} van a ${destinoTxt}${monto < pend - 0.005 ? ` (quedarán pendientes ${formatCurrency(pend - monto)})` : ''}.`,
                      { titulo: 'Liquidar corte', confirmLabel: 'Sí, registrar' }
                    );
                    if (ok) liquidar.mutate({ c, destino: s.destino, monto });
                  }}>
                  Registrar {formatCurrency(monto || 0)}
                </Button>
                {!montoOk && s.monto !== '' && <span className="text-xs text-red-600">El monto debe ser entre $0.01 y {formatCurrency(pend)}</span>}
              </div>
            </div>
          );
        })}
        {descuadrados.map((c) => (
          <div key={c.fecha} className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm">
            <span className="font-semibold text-red-700">{FECHA(c.fecha)}</span>
            <Badge variant="outline" className="ml-2 border-red-400 text-red-700">liquidado de más</Badge>
            <p className="text-xs text-red-600 mt-1">
              Se liquidó {formatCurrency(Number(c.entregado))} pero el neto vigente del día es {formatCurrency(Number(c.neto))} (¿hubo un reverso después?). Corrige antes de confirmar la recepción.
            </p>
          </div>
        ))}
        {entregasTransito.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Entregas a Fondos en tránsito — esperando confirmación del CEO</p>
            {entregasTransito.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-indigo-50 border border-indigo-200">
                <div className="text-sm">
                  <span className="font-semibold">{formatCurrency(Number(r.cash_amount) || 0)}</span>
                  <span className="text-gray-600"> · corte del {format(new Date(r.corte_fecha + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                  <p className="text-xs text-gray-600 mt-1">Entregó: {r.created_by || '—'} el {format(new Date(r.register_date + 'T12:00:00'), 'dd/MM/yyyy')}</p>
                </div>
                {isAdmin ? (
                  <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" disabled={confirmarRecepcion.isPending}
                    onClick={async () => {
                      const ok = await confirmar(
                        `Confirma que recibiste ${formatCurrency(Number(r.cash_amount) || 0)} en efectivo (corte del ${format(new Date(r.corte_fecha + 'T12:00:00'), 'dd/MM/yyyy')}). Confirma solo con el dinero contado en mano.`,
                        { titulo: 'Confirmar recepción del corte', confirmLabel: 'Sí, lo recibí completo' }
                      );
                      if (ok) confirmarRecepcion.mutate(r.id);
                    }}>
                    Confirmar recibido
                  </Button>
                ) : (
                  <Badge variant="outline" className="border-indigo-400 text-indigo-700">En tránsito</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
