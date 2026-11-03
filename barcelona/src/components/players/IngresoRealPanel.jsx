import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GraduationCap, FileDown, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { formatCurrency } from '../lib/formatCurrency';
import { getSeasonAdjustment, getPauseAdjustment } from '@/lib/financeEngine';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/**
 * Cuota efectiva que el motor financiero realmente exige al jugador
 * (misma regla que PlayerUnifiedDebt: beca 50% y 100% se aplican sobre monthly_fee).
 */
function cuotaEfectiva(p) {
  const base = Number(p.monthly_fee) || 0;
  if (p.scholarship === '100%') return 0;
  if (p.scholarship === '50%') return base * 0.5;
  return base;
}

function clasificar(efectiva, completa) {
  if (efectiva <= 0) return { tipo: 'Beca 100%', orden: 0 };
  if (completa > 0 && efectiva < completa) return { tipo: 'Beca parcial', orden: 1 };
  if (completa > 0 && efectiva > completa) return { tipo: 'Cuota superior', orden: 3 };
  return { tipo: 'Cuota completa', orden: 2 };
}

/**
 * IngresoRealPanel — "¿Cuánto percibimos realmente?"
 * Clasifica a los jugadores activos por tipo de beca contra la cuota completa del club
 * y calcula el ingreso mensual teórico vs. real esperado por mensualidades.
 */
export default function IngresoRealPanel({ players = [], playerPauses = [] }) {
  const [abierto, setAbierto] = useState(true);
  const [cuotaRef, setCuotaRef] = useState(null); // override local de la cuota completa

  const { data: clubSettings = [] } = useQuery({
    queryKey: ['clubSettings'],
    queryFn: () => base44.entities.ClubSetting.list(),
  });
  const feesConfig = clubSettings.find(cs => cs.key === 'fees')?.value || null;
  const seasonCalendar = clubSettings.find(cs => cs.key === 'season_calendar')?.value || null;

  const activos = useMemo(() => players.filter(p => p.status === 'activo'), [players]);

  // Cuota completa: configurada en Precios → cuota_completa; si no existe, la cuota más frecuente entre activos con cuota > 0.
  const cuotaModa = useMemo(() => {
    const conteo = {};
    for (const p of activos) {
      const f = Number(p.monthly_fee) || 0;
      if (f > 0) conteo[f] = (conteo[f] || 0) + 1;
    }
    const top = Object.entries(conteo).sort((a, b) => b[1] - a[1] || Number(b[0]) - Number(a[0]))[0];
    return top ? Number(top[0]) : 0;
  }, [activos]);
  const cuotaConfig = Number(feesConfig?.cuota_completa) || 0;
  const cuotaCompleta = cuotaRef ?? (cuotaConfig > 0 ? cuotaConfig : cuotaModa);

  const opcionesCuota = useMemo(() => {
    const set = new Set((feesConfig?.mensualidad_montos || []).filter(v => v > 0));
    activos.forEach(p => { const f = Number(p.monthly_fee) || 0; if (f > 0) set.add(f); });
    if (cuotaCompleta > 0) set.add(cuotaCompleta);
    return Array.from(set).sort((a, b) => b - a);
  }, [feesConfig, activos, cuotaCompleta]);

  const hoy = new Date();
  const mesIdx = hoy.getMonth();
  const anio = hoy.getFullYear();
  const season = getSeasonAdjustment(mesIdx, anio, seasonCalendar);

  const analisis = useMemo(() => {
    const filas = activos.map(p => {
      const efectiva = cuotaEfectiva(p);
      const { tipo, orden } = clasificar(efectiva, cuotaCompleta);
      const becado = Math.max(0, cuotaCompleta - efectiva);
      const pctBeca = cuotaCompleta > 0 ? Math.max(0, Math.min(100, Math.round((becado / cuotaCompleta) * 100))) : 0;
      const pausa = getPauseAdjustment(mesIdx, anio, playerPauses.filter(pp => pp.player_id === p.id));
      const mesActual = efectiva * season.factor * pausa.factor;
      return {
        id: p.id, nombre: p.full_name, categoria: p.category || '-', becaCampo: p.scholarship || 'ninguna',
        cuotaRegistrada: Number(p.monthly_fee) || 0, efectiva, tipo, orden, becado, pctBeca,
        pausa: pausa.active ? (pausa.factor === 0 ? 'Pausa (mes completo)' : 'Pausa (medio mes)') : '',
        mesActual,
      };
    }).sort((a, b) => a.orden - b.orden || b.pctBeca - a.pctBeca || a.nombre.localeCompare(b.nombre));

    const grupos = {};
    for (const f of filas) {
      const g = grupos[f.tipo] || (grupos[f.tipo] = { tipo: f.tipo, orden: f.orden, n: 0, ingreso: 0, becado: 0, subgrupos: {} });
      g.n += 1; g.ingreso += f.efectiva; g.becado += f.becado;
      const sk = f.tipo === 'Beca parcial' ? `${f.pctBeca}%` : formatCurrency(f.efectiva);
      const s = g.subgrupos[sk] || (g.subgrupos[sk] = { etiqueta: sk, n: 0, ingreso: 0, efectiva: f.efectiva });
      s.n += 1; s.ingreso += f.efectiva;
    }
    const lista = Object.values(grupos).sort((a, b) => a.orden - b.orden);
    const teorico = activos.length * cuotaCompleta;
    const real = filas.reduce((s, f) => s + f.efectiva, 0);
    const mesActual = filas.reduce((s, f) => s + f.mesActual, 0);
    const becadoTotal = filas.reduce((s, f) => s + f.becado, 0);
    const pagan = filas.filter(f => f.efectiva > 0).length;
    return { filas, lista, teorico, real, mesActual, becadoTotal, pagan };
  }, [activos, cuotaCompleta, playerPauses, mesIdx, anio, season.factor]);

  const pct = (v, base) => (base > 0 ? `${Math.round((v / base) * 1000) / 10}%` : '—');
  const mesLabel = `${MESES[mesIdx]} ${anio}`;
  const fechaStr = hoy.toLocaleDateString('es-MX');

  const colorTipo = {
    'Beca 100%': 'bg-purple-100 text-purple-700',
    'Beca parcial': 'bg-orange-100 text-orange-700',
    'Cuota completa': 'bg-green-100 text-green-700',
    'Cuota superior': 'bg-blue-100 text-blue-700',
  };

  const exportXLSX = () => {
    const { filas, lista, teorico, real, mesActual, becadoTotal, pagan } = analisis;
    const resumen = [
      ['Barcelona Inter Academy — Ingreso real por mensualidades'],
      [`Generado: ${fechaStr}  ·  Cuota completa de referencia: ${formatCurrency(cuotaCompleta)}  ·  Solo jugadores activos`],
      [],
      ['Tipo', 'Jugadores', '% de activos', 'Ingreso mensual', 'Monto becado'],
      ...lista.map(g => [g.tipo, g.n, pct(g.n, activos.length), g.ingreso, g.becado]),
      ['TOTAL', activos.length, '100%', real, becadoTotal],
      [],
      ['Ingreso teórico (activos × cuota completa)', teorico],
      ['Ingreso real esperado (suma de cuotas efectivas)', real],
      ['Becas otorgadas al mes', becadoTotal],
      ['% del ingreso teórico que realmente se percibe', pct(real, teorico)],
      ['Jugadores que pagan algo', pagan],
      ['Jugadores con beca 100%', activos.length - pagan],
      [`Ingreso esperado ${mesLabel} (con pausas y calendario de temporada)`, mesActual],
      [],
      ['Desglose'],
      ['Tipo', 'Subgrupo', 'Jugadores', 'Cuota efectiva', 'Ingreso mensual'],
      ...lista.flatMap(g => Object.values(g.subgrupos).sort((a, b) => b.efectiva - a.efectiva).map(s => [g.tipo, s.etiqueta, s.n, s.efectiva, s.ingreso])),
    ];
    const detalle = [
      ['Jugador', 'Categoría', 'Tipo', 'Beca (campo)', 'Cuota registrada', 'Cuota efectiva', '% beca', 'Monto becado', `Cuota ${mesLabel}`, 'Pausa'],
      ...filas.map(f => [f.nombre, f.categoria, f.tipo, f.becaCampo, f.cuotaRegistrada, f.efectiva, `${f.pctBeca}%`, f.becado, f.mesActual, f.pausa || '-']),
    ];
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet(resumen);
    ws1['!cols'] = [{ wch: 48 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 16 }];
    const ws2 = XLSX.utils.aoa_to_sheet(detalle);
    ws2['!cols'] = [{ wch: 36 }, { wch: 10 }, { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 8 }, { wch: 14 }, { wch: 18 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Resumen');
    XLSX.utils.book_append_sheet(wb, ws2, 'Detalle por jugador');
    XLSX.writeFile(wb, `ingreso_real_becas_${anio}-${String(mesIdx + 1).padStart(2, '0')}.xlsx`);
  };

  const exportPDF = () => {
    const { filas, lista, teorico, real, mesActual, becadoTotal, pagan } = analisis;
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    doc.setFontSize(16); doc.setTextColor(165, 0, 68);
    doc.text('Barcelona Inter Academy', 14, 18);
    doc.setFontSize(12); doc.setTextColor(40, 40, 40);
    doc.text('Ingreso real por mensualidades — becas y cuotas', 14, 27);
    doc.setFontSize(9); doc.setTextColor(120, 120, 120);
    doc.text(`Generado: ${fechaStr}   ·   Cuota completa: ${formatCurrency(cuotaCompleta)}   ·   Jugadores activos: ${activos.length}`, 14, 34);

    let y = 42;
    const tabla = (cols, widths, rows, zebra = true) => {
      doc.setFillColor(165, 0, 68); doc.rect(14, y, pw - 28, 8, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(8);
      let x = 16; cols.forEach((c, i) => { doc.text(c, x, y + 5.5); x += widths[i]; });
      y += 8;
      rows.forEach((row, idx) => {
        if (y > 275) { doc.addPage(); y = 20; }
        if (zebra && idx % 2 === 0) { doc.setFillColor(245, 245, 255); doc.rect(14, y, pw - 28, 7, 'F'); }
        doc.setTextColor(40, 40, 40); x = 16;
        row.forEach((v, i) => { doc.text(doc.splitTextToSize(String(v ?? '-'), widths[i] - 2)[0], x, y + 5); x += widths[i]; });
        y += 7;
      });
    };

    tabla(['Tipo', 'Jugadores', '% activos', 'Ingreso mensual', 'Monto becado'], [50, 28, 28, 40, 36],
      [...lista.map(g => [g.tipo, g.n, pct(g.n, activos.length), formatCurrency(g.ingreso), formatCurrency(g.becado)]),
        ['TOTAL', activos.length, '100%', formatCurrency(real), formatCurrency(becadoTotal)]]);

    y += 6;
    doc.setFontSize(10); doc.setTextColor(40, 40, 40);
    const lineas = [
      `Ingreso teórico (activos × cuota completa): ${formatCurrency(teorico)}`,
      `Ingreso real esperado por mes: ${formatCurrency(real)}  (${pct(real, teorico)} del teórico)`,
      `Becas otorgadas al mes: ${formatCurrency(becadoTotal)}`,
      `Pagan cuota: ${pagan} jugadores   ·   Beca 100%: ${activos.length - pagan} jugadores`,
      `Ingreso esperado ${mesLabel} (con pausas y calendario): ${formatCurrency(mesActual)}`,
    ];
    lineas.forEach(l => { doc.text(l, 14, y); y += 6; });

    y += 4;
    doc.setFontSize(11); doc.text('Desglose por subgrupo', 14, y); y += 4;
    tabla(['Tipo', 'Subgrupo', 'Jugadores', 'Cuota efectiva', 'Ingreso mensual'], [40, 34, 28, 40, 40],
      lista.flatMap(g => Object.values(g.subgrupos).sort((a, b) => b.efectiva - a.efectiva).map(s => [g.tipo, s.etiqueta, s.n, formatCurrency(s.efectiva), formatCurrency(s.ingreso)])));

    doc.addPage(); y = 20;
    doc.setFontSize(11); doc.text('Detalle por jugador (activos)', 14, y); y += 4;
    tabla(['Jugador', 'Cat.', 'Tipo', 'Cuota', 'Efectiva', '% beca', 'Becado'], [62, 18, 30, 20, 20, 16, 16],
      filas.map(f => [f.nombre, f.categoria, f.tipo, formatCurrency(f.cuotaRegistrada), formatCurrency(f.efectiva), `${f.pctBeca}%`, formatCurrency(f.becado)]));

    doc.save(`ingreso_real_becas_${anio}-${String(mesIdx + 1).padStart(2, '0')}.pdf`);
  };

  const { lista, teorico, real, mesActual, becadoTotal, pagan } = analisis;

  return (
    <Card className="border-purple-100">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-50"><GraduationCap className="w-5 h-5 text-purple-600" /></div>
            <div>
              <CardTitle className="text-base">Becas e ingreso real por mensualidades</CardTitle>
              <p className="text-xs text-gray-500">Jugadores activos · cuota completa de referencia {formatCurrency(cuotaCompleta)}{cuotaConfig > 0 ? '' : ' (cuota más frecuente; fíjala en Configuración → Precios)'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(cuotaCompleta)} onValueChange={v => setCuotaRef(Number(v))}>
              <SelectTrigger className="w-40 h-9 text-sm"><SelectValue placeholder="Cuota completa" /></SelectTrigger>
              <SelectContent>
                {opcionesCuota.map(v => <SelectItem key={v} value={String(v)}>Cuota completa {formatCurrency(v)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportXLSX} className="gap-1.5 border-green-300 text-green-700 hover:bg-green-50"><FileDown className="w-4 h-4" /> Excel</Button>
            <Button variant="outline" size="sm" onClick={exportPDF} className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50"><FileDown className="w-4 h-4" /> PDF</Button>
            <Button variant="ghost" size="sm" onClick={() => setAbierto(a => !a)} aria-label={abierto ? 'Contraer' : 'Expandir'}>
              {abierto ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      {abierto && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Ingreso teórico</p>
              <p className="text-xl font-bold text-gray-700">{formatCurrency(teorico)}</p>
              <p className="text-xs text-gray-400">{activos.length} activos × {formatCurrency(cuotaCompleta)}</p>
            </div>
            <div className="rounded-lg border border-green-100 bg-green-50 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Ingreso real esperado</p>
              <p className="text-xl font-bold text-green-700">{formatCurrency(real)}</p>
              <p className="text-xs text-gray-400">{pct(real, teorico)} del teórico · {pagan} pagan cuota</p>
            </div>
            <div className="rounded-lg border border-purple-100 bg-purple-50 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Becas otorgadas / mes</p>
              <p className="text-xl font-bold text-purple-700">{formatCurrency(becadoTotal)}</p>
              <p className="text-xs text-gray-400">{pct(becadoTotal, teorico)} del teórico · {activos.length - pagan} con beca 100%</p>
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> {mesLabel}</p>
              <p className="text-xl font-bold text-blue-700">{formatCurrency(mesActual)}</p>
              <p className="text-xs text-gray-400">{season.factor !== 1 ? `Calendario: ${season.label || `factor ${season.factor}`} · ` : ''}con pausas vigentes</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b">
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Desglose</th>
                  <th className="py-2 pr-3 text-right">Jugadores</th>
                  <th className="py-2 pr-3 text-right">% activos</th>
                  <th className="py-2 pr-3 text-right">Ingreso mensual</th>
                  <th className="py-2 text-right">Monto becado</th>
                </tr>
              </thead>
              <tbody>
                {lista.map(g => (
                  <tr key={g.tipo} className="border-b last:border-0">
                    <td className="py-2 pr-3"><Badge className={colorTipo[g.tipo] || 'bg-gray-100 text-gray-700'}>{g.tipo}</Badge></td>
                    <td className="py-2 pr-3 text-xs text-gray-600">
                      {Object.values(g.subgrupos).sort((a, b) => b.efectiva - a.efectiva).map(s => (
                        <span key={s.etiqueta} className="inline-block mr-2">{s.n} × {g.tipo === 'Beca parcial' ? `${s.etiqueta} beca (${formatCurrency(s.efectiva)})` : s.etiqueta}</span>
                      ))}
                    </td>
                    <td className="py-2 pr-3 text-right font-medium">{g.n}</td>
                    <td className="py-2 pr-3 text-right text-gray-600">{pct(g.n, activos.length)}</td>
                    <td className="py-2 pr-3 text-right font-medium text-green-700">{formatCurrency(g.ingreso)}</td>
                    <td className="py-2 text-right text-purple-700">{g.becado > 0 ? formatCurrency(g.becado) : '—'}</td>
                  </tr>
                ))}
                {lista.length === 0 && (
                  <tr><td colSpan={6} className="py-4 text-center text-gray-400">Sin jugadores activos</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t font-semibold">
                  <td className="py-2 pr-3">Total</td>
                  <td />
                  <td className="py-2 pr-3 text-right">{activos.length}</td>
                  <td className="py-2 pr-3 text-right">100%</td>
                  <td className="py-2 pr-3 text-right text-green-700">{formatCurrency(real)}</td>
                  <td className="py-2 text-right text-purple-700">{formatCurrency(becadoTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-xs text-gray-400">
            La cuota efectiva es la que el motor de deuda realmente exige (cuota registrada, menos beca 50%/100% del campo Beca). El ingreso real esperado no incluye recargos, inscripciones, torneos ni uniformes; el detalle por jugador está en la descarga.
          </p>
        </CardContent>
      )}
    </Card>
  );
}
