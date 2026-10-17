import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Undo2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '../lib/formatCurrency';

/**
 * Control por excepción de reversos (RPC reversos_detectados): cada reverso se
 * compara con lo que se recapturó después para el mismo jugador/concepto.
 *   - recaptura por el mismo monto  → verde (corrección normal)
 *   - recaptura por MENOS           → rojo (diferencia negativa)
 *   - sin recaptura                 → ámbar (el jugador quedó debiendo: revisar)
 * El admin lo ve al confirmar los cortes; no requiere aprobar nada.
 */
const DIAS = 14;

export default function ReversosRecientes() {
  const desde = format(new Date(Date.now() - DIAS * 86400000), 'yyyy-MM-dd');
  const { data: rows = [] } = useQuery({
    queryKey: ['reversosDetectados', desde],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('reversos_detectados', { p_desde: desde });
      if (error) throw new Error(error.message);
      return data || [];
    },
  });

  if (rows.length === 0) return null;

  const estado = (r) => {
    if (!r.recaptura_id) return { tono: 'amber', texto: 'Sin recaptura', Icon: AlertTriangle };
    const d = Number(r.diferencia) || 0;
    if (d < 0) return { tono: 'red', texto: `Recapturado por menos (${formatCurrency(d)})`, Icon: AlertTriangle };
    if (d > 0) return { tono: 'blue', texto: `Recapturado por más (+${formatCurrency(d)})`, Icon: CheckCircle2 };
    return { tono: 'green', texto: 'Recapturado por el mismo monto', Icon: CheckCircle2 };
  };
  const tonos = {
    amber: 'border-amber-300 bg-amber-50 text-amber-800',
    red: 'border-red-300 bg-red-50 text-red-800',
    blue: 'border-blue-300 bg-blue-50 text-blue-800',
    green: 'border-green-300 bg-green-50 text-green-800',
  };
  const alertas = rows.filter(r => !r.recaptura_id || Number(r.diferencia) < 0).length;

  return (
    <Card className={`border-2 ${alertas > 0 ? 'border-red-300' : 'border-gray-200'}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Undo2 className="w-5 h-5 text-amber-700" /> Reversos de cobros — últimos {DIAS} días
          </span>
          {alertas > 0
            ? <Badge className="bg-red-600 text-white">{alertas} por revisar</Badge>
            : <Badge className="bg-green-100 text-green-700">Todo cuadra</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-gray-500">
          Un cobro con vale impreso no se edita: se reversa y se captura de nuevo. Aquí se compara cada reverso con su
          recaptura. Si un reverso queda sin recaptura, el jugador aparece como deudor de ese mes y conserva su vale original (QR = REVERSADO).
        </p>
        {rows.map((r) => {
          const e = estado(r);
          return (
            <div key={r.reverso_id} className={`rounded-lg border p-3 text-sm ${tonos[e.tono]}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {r.jugador !== '—' ? r.jugador : r.concepto} <span className="font-normal text-gray-600">— {r.concepto}</span>
                  </p>
                  <p className="text-xs text-gray-600">
                    Vale {r.original_folio ? `V-${String(r.original_folio).padStart(6, '0')}` : '—'} del {r.original_fecha ? format(new Date(r.original_fecha + 'T00:00:00'), 'dd/MM/yyyy') : '—'}
                    {' · '}{r.metodo}{' · '}reversado {r.hora ? format(new Date(r.hora), 'dd/MM/yyyy HH:mm') : ''} por {r.usuario || '—'}
                  </p>
                  <p className="text-xs text-gray-700 mt-1">Motivo: <i>{r.motivo || '—'}</i></p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-gray-900">{formatCurrency(r.monto_original)}</p>
                  {r.recaptura_id && (
                    <p className="text-xs text-gray-600">
                      Recaptura {r.recaptura_folio ? `V-${String(r.recaptura_folio).padStart(6, '0')}` : ''}: {formatCurrency(r.recaptura_monto)}
                    </p>
                  )}
                </div>
              </div>
              <p className="flex items-center gap-1 text-xs font-semibold mt-2"><e.Icon className="w-3.5 h-3.5" /> {e.texto}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
