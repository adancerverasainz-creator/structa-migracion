import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/base44Client';
import { usePerms } from '@/lib/usePerms';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Lock, Unlock, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Cierre de periodo (lock date). Motor en BD: trigger aaa_trg_bloqueo_periodo en
 * las 8 tablas de dinero; ningún movimiento con fecha <= cierre se crea, edita
 * ni borra — por nadie. Cerrar/reabrir: RPC cerrar_periodo / reabrir_periodo
 * (solo admin, con bitácora en Auditoría).
 */
const fmt = (d) => (d ? format(new Date(d + 'T00:00:00'), "d 'de' MMMM yyyy", { locale: es }) : null);
const finMesAnterior = () => {
  const hoy = new Date();
  const d = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
  return format(d, 'yyyy-MM-dd');
};

export default function CierrePeriodo() {
  const { isAdmin } = usePerms('fondos');
  const queryClient = useQueryClient();
  const [fecha, setFecha] = useState(finMesAnterior());
  const [motivo, setMotivo] = useState('');
  const [reabrir, setReabrir] = useState(false);
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [motivoReapertura, setMotivoReapertura] = useState('');

  const { data: cierre = null } = useQuery({
    queryKey: ['fechaCierre'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fecha_cierre_actual');
      if (error) throw new Error(error.message);
      return data || null;
    },
  });

  const { data: historial = [] } = useQuery({
    queryKey: ['periodosCerrados'],
    queryFn: async () => {
      const { data, error } = await supabase.from('periodos_cerrados').select('*').order('realizado_at', { ascending: false }).limit(8);
      if (error) throw new Error(error.message);
      return data || [];
    },
  });

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['fechaCierre'] });
    queryClient.invalidateQueries({ queryKey: ['periodosCerrados'] });
  };

  const cerrar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('cerrar_periodo', { p_fecha: fecha, p_motivo: motivo || null });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success(`Periodo cerrado al ${fmt(fecha)}`); setMotivo(''); refrescar(); },
    onError: (err) => toast.error(err?.message || 'No se pudo cerrar el periodo'),
  });

  const reapertura = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('reabrir_periodo', { p_nueva_fecha: nuevaFecha || null, p_motivo: motivoReapertura });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success('Periodo reabierto (quedó en bitácora)'); setReabrir(false); setMotivoReapertura(''); setNuevaFecha(''); refrescar(); },
    onError: (err) => toast.error(err?.message || 'No se pudo reabrir'),
  });

  return (
    <Card className="border-2 border-slate-300">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="w-5 h-5 text-slate-700" /> Cierre de periodo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`rounded-lg border p-3 text-sm ${cierre ? 'bg-slate-50 border-slate-300' : 'bg-amber-50 border-amber-300'}`}>
          {cierre ? (
            <p className="flex items-center gap-2 text-slate-800">
              <Lock className="w-4 h-4" />
              <span>Periodo cerrado hasta el <b>{fmt(cierre)}</b>. Ningún cobro, egreso, abono o corte con esa fecha o anterior
              puede crearse, editarse ni borrarse (aplica también a administradores). Las correcciones se registran como reverso o ajuste con fecha de hoy.</span>
            </p>
          ) : (
            <p className="flex items-center gap-2 text-amber-800">
              <Unlock className="w-4 h-4" /> No hay periodo cerrado: los saldos históricos pueden moverse.
            </p>
          )}
        </div>

        {isAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="space-y-1">
              <Label>Cerrar hasta (inclusive)</Label>
              <Input type="date" value={fecha} min={cierre || undefined} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Nota (opcional)</Label>
              <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. Mes conciliado contra conteo físico y estados de cuenta" />
            </div>
            <div className="md:col-span-3 flex flex-wrap gap-2 justify-end">
              {cierre && (
                <Button type="button" variant="outline" onClick={() => setReabrir(!reabrir)}>
                  <Unlock className="w-4 h-4 mr-2" /> Reabrir
                </Button>
              )}
              <Button type="button" className="bg-slate-800 hover:bg-slate-900" disabled={!fecha || cerrar.isPending}
                onClick={() => cerrar.mutate()}>
                <Lock className="w-4 h-4 mr-2" /> {cerrar.isPending ? 'Cerrando…' : 'Cerrar periodo'}
              </Button>
            </div>
          </div>
        )}

        {isAdmin && reabrir && cierre && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 space-y-3">
            <p className="text-sm text-red-800">
              Reabrir retrocede el candado y permite mover saldos ya conciliados. Queda registrado en Auditoría con tu usuario y motivo.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Nuevo cierre (vacío = sin cierre)</Label>
                <Input type="date" value={nuevaFecha} max={cierre} onChange={(e) => setNuevaFecha(e.target.value)} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Motivo (obligatorio)</Label>
                <Textarea rows={2} value={motivoReapertura} onChange={(e) => setMotivoReapertura(e.target.value)} placeholder="Por qué se reabre y qué se va a corregir" />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="button" variant="destructive" disabled={motivoReapertura.trim().length < 10 || reapertura.isPending}
                onClick={() => reapertura.mutate()}>
                {reapertura.isPending ? 'Reabriendo…' : 'Confirmar reapertura'}
              </Button>
            </div>
          </div>
        )}

        {historial.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-500 uppercase">Bitácora</p>
            {historial.map((h) => (
              <div key={h.id} className="flex flex-wrap justify-between gap-2 text-xs text-gray-600 border rounded px-2 py-1">
                <span>
                  <b className={h.accion === 'cierre' ? 'text-slate-800' : 'text-red-700'}>{h.accion === 'cierre' ? 'Cierre' : 'Reapertura'}</b>
                  {' → '}{h.fecha_cierre ? fmt(h.fecha_cierre) : 'sin cierre'} — {h.motivo}
                </span>
                <span className="text-gray-400">{format(new Date(h.realizado_at), 'dd/MM/yyyy HH:mm')} · {h.realizado_por}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
