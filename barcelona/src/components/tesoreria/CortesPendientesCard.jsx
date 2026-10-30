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

export default function CortesPendientesCard({ isAdmin, cashRegisters = [], bancos = [], compacto = false, saldoCajaChica = null, fondoFijo = null }) {
  const queryClient = useQueryClient();
  const { data: cortes = [], error: errorCortes } = useQuery({
    queryKey: ['cortesPendientesV2'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('cortes_pendientes_v2');
      if (error) throw new Error(error.message);
      return data || [];
    },
  });
  // Ajustes manuales por día (opcionales): { [fecha]: { destino, cajaChica, ajustar } }
  const [sel, setSel] = useState({});
  const getSel = (c) => sel[c.fecha] || { destino: 'Fondos', cajaChica: '', ajustar: false };
  const setDia = (c, patch) => setSel((prev) => ({ ...prev, [c.fecha]: { ...getSel(c), ...patch } }));

  // Hasta no tener saldo de Caja chica y fondo fijo cargados, no se propone ni se permite liquidar
  const listo = saldoCajaChica != null && fondoFijo != null;
  // Déficit de la Caja chica respecto a su fondo fijo: el sistema lo repone PRIMERO con la cobranza
  const deficitCajaChica = listo ? Math.max(0, (Number(fondoFijo) || 0) - (Number(saldoCajaChica) || 0)) : 0;
  // Propuesta por día, independiente: el día que se liquide primero cubre el déficit; al refrescar,
  // los demás se recalculan. Así lo que se muestra es exactamente lo que se registra.
  const propuestaDe = (c) => {
    const pend = Number(c.pendiente) || 0;
    const aCC = Math.round(Math.min(pend, deficitCajaChica) * 100) / 100;
    return { aCC, resto: Math.round((pend - aCC) * 100) / 100 };
  };

  // Liquidación atómica en un paso (RPC liquidar_corte): Caja chica + resto
  const liquidarDia = useMutation({
    mutationFn: async ({ c, destino, aCC }) => {
      const { data, error } = await supabase.rpc('liquidar_corte_v2', {
        p_fecha: c.fecha, p_destino_resto: destino, p_a_caja_chica: aCC,
        p_pendiente_esperado: Number(c.pendiente), // si cambió en el servidor, rechaza y pide recargar
        p_op_key: (crypto.randomUUID ? crypto.randomUUID() : null),
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (d) => {
      invalidar(queryClient);
      const partes = [];
      if (Number(d?.a_caja_chica) > 0) partes.push(`${formatCurrency(Number(d.a_caja_chica))} a Caja chica`);
      if (Number(d?.resto) > 0) partes.push(`${formatCurrency(Number(d.resto))} a ${d.destino_resto === 'Fondos' ? 'Fondos (en tránsito hasta que el CEO confirme)' : d.destino_resto}`);
      toast.success(`Día liquidado: ${partes.join(' y ')}`);
    },
    onError: (e) => toast.error(e.message),
  });

  // Día en curso: solo puede pasar cobranza a Caja chica (el resto se liquida mañana)
  const pasarHoy = useMutation({
    mutationFn: async ({ c, monto }) => {
      const { error } = await supabase.rpc('corte_a_caja_chica', {
        p_fecha: c.fecha, p_monto: monto, p_op_key: (crypto.randomUUID ? crypto.randomUUID() : null),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { invalidar(queryClient); toast.success('Cobranza de hoy pasada a Caja chica'); },
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
  const nombreDestino = (d) => d === 'Fondos' ? 'Fondos (CEO)' : d;

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
        {errorCortes && (
          <p className="text-sm text-red-600">No se pudieron cargar los cortes: {errorCortes.message}</p>
        )}
        {!compacto && (
          <p className="text-xs text-gray-500">
            El sistema reparte cada día de cobranza solo: primero completa tu <b>Caja chica</b> hasta su fondo fijo
            ({formatCurrency(Number(fondoFijo) || 0)}) y el resto lo manda al destino que elijas (<b>Fondos</b>, en tránsito hasta que
            el CEO confirme, o <b>depósito en banco</b>). Tú solo confirmas. Los gastos nunca se pagan de la cobranza.
          </p>
        )}
        {hoy && (() => {
          const disp = Math.max(0, Number(hoy.pendiente) || 0);
          const s = getSel(hoy);
          const sugerido = Math.min(disp, deficitCajaChica);
          const monto = s.cajaChica === '' ? sugerido : Number(s.cajaChica);
          const montoOk = monto > 0 && monto <= disp + 0.005;
          return (
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm space-y-2">
              <div>
                <span className="font-semibold">{FECHA(hoy.fecha)}</span>
                <Badge className="ml-2 bg-blue-600">día en curso</Badge>
                <p className="text-xs text-gray-600 mt-1">
                  Cobros en efectivo <b>{formatCurrency(Number(hoy.cobros))}</b>
                  {Number(hoy.a_caja_chica) > 0 ? ` · ya pasado a Caja chica ${formatCurrency(Number(hoy.a_caja_chica))}` : ''}
                  {' · '}se liquida mañana con el día cerrado.
                </p>
                {disp > 0 && sugerido > 0 && (
                  <p className="text-xs text-amber-800 mt-1">
                    Tu Caja chica está {formatCurrency(deficitCajaChica)} por debajo del fondo fijo: repónla ahora con la cobranza de hoy.
                  </p>
                )}
              </div>
              {disp > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <Input type="number" min="0.01" step="0.01" className="h-8 w-[130px] bg-white" placeholder={String(sugerido || disp)}
                    value={s.cajaChica} onWheel={(e) => e.target.blur()}
                    onChange={(e) => setDia(hoy, { cajaChica: e.target.value })} />
                  <Button size="sm" variant="outline" className="h-8 border-amber-400 text-amber-800 hover:bg-amber-50"
                    disabled={!listo || !montoOk || pasarHoy.isPending}
                    onClick={async () => {
                      const ok = await confirmar(
                        `Confirma que ${formatCurrency(monto)} de la cobranza de hoy pasan a tu Caja chica (quedarán ${formatCurrency(disp - monto)} por liquidar mañana).`,
                        { titulo: 'Pasar a Caja chica', confirmLabel: 'Sí, registrar' }
                      );
                      if (ok) pasarHoy.mutate({ c: hoy, monto });
                    }}>
                    {sugerido > 0 && s.cajaChica === '' ? `Reponer Caja chica ${formatCurrency(monto)}` : `Pasar ${formatCurrency(monto || 0)} a Caja chica`}
                  </Button>
                  {!montoOk && s.cajaChica !== '' && <span className="text-xs text-red-600">Entre $0.01 y {formatCurrency(disp)}</span>}
                </div>
              )}
            </div>
          );
        })()}
        {pendientes.length === 0 && !hoy && !errorCortes && (
          <p className="text-sm text-green-700 font-medium">Sin cortes pendientes de liquidar.</p>
        )}
        {pendientes.map((c) => {
          const pend = Number(c.pendiente);
          const s = getSel(c);
          const prop = propuestaDe(c);
          const aCC = s.ajustar && s.cajaChica !== '' ? Number(s.cajaChica) : prop.aCC;
          const resto = Math.round((pend - aCC) * 100) / 100;
          const valido = aCC >= 0 && aCC <= pend + 0.005;
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
              {/* Propuesta del sistema */}
              <div className="rounded-md bg-white border border-amber-200 p-2 text-sm space-y-1">
                {aCC > 0 && (
                  <p>→ <b>{formatCurrency(aCC)}</b> a <b>Caja chica</b> <span className="text-xs text-gray-500">(repone el fondo a {formatCurrency(Number(fondoFijo) || 0)})</span></p>
                )}
                {resto > 0 && (
                  <p className="flex flex-wrap items-center gap-2">
                    <span>→ <b>{formatCurrency(resto)}</b> a</span>
                    <Select value={s.destino} onValueChange={(v) => setDia(c, { destino: v })}>
                      <SelectTrigger className="h-7 w-[190px] bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Fondos">Fondos (CEO)</SelectItem>
                        {bancos.map((b) => <SelectItem key={b} value={b}>Depósito en {b}</SelectItem>)}
                        <SelectItem value="Caja chica">Caja chica (todo)</SelectItem>
                      </SelectContent>
                    </Select>
                  </p>
                )}
                {s.ajustar && (
                  <p className="flex flex-wrap items-center gap-2 text-xs text-gray-700">
                    A Caja chica:
                    <Input type="number" min="0" step="0.01" className="h-7 w-[120px] bg-white" placeholder={String(prop.aCC)}
                      value={s.cajaChica} onWheel={(e) => e.target.blur()}
                      onChange={(e) => setDia(c, { cajaChica: e.target.value })} />
                    <span>(el resto, {formatCurrency(Math.max(0, resto))}, va al destino elegido)</span>
                    {!valido && <span className="text-red-600">Entre $0 y {formatCurrency(pend)}</span>}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700"
                  disabled={!listo || !valido || liquidarDia.isPending}
                  onClick={async () => {
                    const partes = [];
                    if (aCC > 0) partes.push(`${formatCurrency(aCC)} a tu Caja chica`);
                    if (resto > 0) partes.push(`${formatCurrency(resto)} a ${nombreDestino(s.destino)}`);
                    const ok = await confirmar(
                      `Liquidar la cobranza del ${FECHA(c.fecha)}: ${partes.join(' y ')}. El monto lo calculó el sistema; solo confirma que el efectivo está completo.`,
                      { titulo: 'Liquidar día', confirmLabel: 'Sí, liquidar' }
                    );
                    if (ok) liquidarDia.mutate({ c, destino: s.destino, aCC });
                  }}>
                  Liquidar día — {formatCurrency(pend)}
                </Button>
                <button type="button" className="text-xs text-gray-500 underline" onClick={() => setDia(c, { ajustar: !s.ajustar, cajaChica: '' })}>
                  {s.ajustar ? 'usar propuesta del sistema' : 'ajustar reparto'}
                </button>
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
