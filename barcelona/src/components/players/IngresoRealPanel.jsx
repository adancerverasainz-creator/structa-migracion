import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GraduationCap, FileDown, ChevronDown, ChevronUp, TrendingUp, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { formatCurrency } from '../lib/formatCurrency';
import { getSeasonAdjustment, getPauseAdjustment, becaPct, becaMotivoLabel, cuotaNeta } from '@/lib/financeEngine';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Clave 'mes año' de un texto de mes de pago (misma regla que el motor de deuda). */
function normMonthKey(m) {
  if (!m) return null;
  const lower = String(m).toLowerCase();
  const name = MESES.find(n => lower.includes(n));
  const yr = (lower.match(/(20\d{2})/) || [])[1];
  return name && yr ? `${name} ${yr}` : null;
}

function clasificar(pct, efectiva, completa) {
  if (pct >= 100 || efectiva <= 0) return { tipo: 'Beca 100%', orden: 0 };
  if (pct > 0) return { tipo: 'Beca parcial', orden: 1 };
  if (completa > 0 && efectiva < completa) return { tipo: 'Precio reducido sin beca', orden: 2 };
  if (completa > 0 && efectiva > completa) return { tipo: 'Cuota superior', orden: 4 };
  return { tipo: 'Cuota completa', orden: 3 };
}

/**
 * IngresoRealPanel — "¿Cuánto percibimos realmente?"
 * Modelo: cuota completa (Configuración → Precios) × (1 − beca%) = cuota neta del jugador (monthly_fee).
 * Clasifica a los activos por beca declarada y motivo, detecta cuotas fuera de política
 * y compara lo devengado contra lo cobrado por mensualidades en los últimos meses.
 */
export default function IngresoRealPanel({ players = [], playerPauses = [], payments = [] }) {
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
    const pausasDe = (pid) => playerPauses.filter(pp => pp.player_id === pid);
    const filas = activos.map(p => {
      const efectiva = Number(p.monthly_fee) || 0;
      const pct = Math.round(becaPct(p));
      const { tipo, orden } = clasificar(pct, efectiva, cuotaCompleta);
      const becado = Math.max(0, cuotaCompleta - efectiva);
      const esperada = cuotaNeta(cuotaCompleta, pct);
      const fueraPolitica = pct > 0 && efectiva !== esperada;
      const motivo = pct > 0 ? becaMotivoLabel(p.scholarship_reason) : '';
      const pausa = getPauseAdjustment(mesIdx, anio, pausasDe(p.id));
      const mesActual = efectiva * season.factor * pausa.factor;
      return {
        id: p.id, nombre: p.full_name, categoria: p.category || '-', pct, motivo, sinMotivo: pct > 0 && !p.scholarship_reason,
        cuotaRegistrada: efectiva, efectiva, esperada, fueraPolitica, tipo, orden, becado,
        pausa: pausa.active ? (pausa.factor === 0 ? 'Pausa (mes completo)' : 'Pausa (medio mes)') : '',
        mesActual,
      };
    }).sort((a, b) => a.orden - b.orden || b.pct - a.pct || a.nombre.localeCompare(b.nombre));

    const grupos = {};
    for (const f of filas) {
      const g = grupos[f.tipo] || (grupos[f.tipo] = { tipo: f.tipo, orden: f.orden, n: 0, ingreso: 0, becado: 0, subgrupos: {} });
      g.n += 1; g.ingreso += f.efectiva; g.becado += f.becado;
      const sk = f.pct > 0 ? `${f.pct}%` : formatCurrency(f.efectiva);
      const s = g.subgrupos[sk] || (g.subgrupos[sk] = { etiqueta: sk, n: 0, ingreso: 0, efectiva: f.efectiva, pct: f.pct });
      s.n += 1; s.ingreso += f.efectiva;
    }
    const lista = Object.values(grupos).sort((a, b) => a.orden - b.orden);

    // Becas por motivo (solo quienes tienen beca declarada)
    const porMotivo = {};
    for (const f of filas.filter(x => x.pct > 0)) {
      const m = porMotivo[f.motivo] || (porMotivo[f.motivo] = { motivo: f.motivo, n: 0, becado: 0, ingreso: 0 });
      m.n += 1; m.becado += f.becado; m.ingreso += f.efectiva;
    }
    const motivos = Object.values(porMotivo).sort((a, b) => b.becado - a.becado);

    const teorico = activos.length * cuotaCompleta;
    const real = filas.reduce((s, f) => s + f.efectiva, 0);
    const mesActual = filas.reduce((s, f) => s + f.mesActual, 0);
    const becadoTotal = filas.reduce((s, f) => s + f.becado, 0);
    const pagan = filas.filter(f => f.efectiva > 0).length;
    const fueraPolitica = filas.filter(f => f.fueraPolitica);
    const sinMotivo = filas.filter(f => f.sinMotivo);
    const reducidoSinBeca = filas.filter(f => f.tipo === 'Precio reducido sin beca');

    // Devengado vs cobrado por mensualidades: mes en curso y los 3 anteriores
    const reversedIds = new Set(payments.filter(x => x.reversal_of).map(x => x.reversal_of));
    const cobradoPorMes = new Map();
    for (const pay of payments) {
      if (pay.reversal_of || reversedIds.has(pay.id)) continue;
      if (pay.payment_type && pay.payment_type !== 'mensualidad') continue;
      const k = normMonthKey(pay.month);
      if (!k) continue;
      cobradoPorMes.set(k, (cobradoPorMes.get(k) || 0) + (Number(pay.amount) || 0));
    }
    const meses = [];
    for (let back = 3; back >= 0; back--) {
      const d = new Date(anio, mesIdx - back, 1);
      const mi = d.getMonth(); const yy = d.getFullYear();
      const sAdj = getSeasonAdjustment(mi, yy, seasonCalendar);
      let devengado = 0;
      const mesInicio = new Date(yy, mi, 1);
      for (const p of players) {
        const join = p.join_date ? new Date(String(p.join_date).slice(0, 10) + 'T00:00:00') : null;
        if (join && (join.getFullYear() > yy || (join.getFullYear() === yy && join.getMonth() > mi))) continue; // aún no ingresaba
        if (p.status !== 'activo') {
          // Baja/inactivo: devengó ese mes solo si su baja fue después de iniciado el mes
          const baja = p.baja_date ? new Date(String(p.baja_date).slice(0, 10) + 'T00:00:00') : null;
          if (!baja || baja < mesInicio) continue;
        }
        const pausa = getPauseAdjustment(mi, yy, pausasDe(p.id));
        devengado += (Number(p.monthly_fee) || 0) * sAdj.factor * pausa.factor;
      }
      const key = `${MESES[mi]} ${yy}`;
      const cobrado = cobradoPorMes.get(key) || 0;
      meses.push({ key, label: `${MESES[mi].slice(0, 3)} ${yy}`, devengado, cobrado, pctCobrado: devengado > 0 ? cobrado / devengado : 0, enCurso: back === 0, ajuste: sAdj.label || (sAdj.factor !== 1 ? `factor ${sAdj.factor}` : '') });
    }

    return { filas, lista, motivos, teorico, real, mesActual, becadoTotal, pagan, fueraPolitica, sinMotivo, reducidoSinBeca, meses };
  }, [activos, players, cuotaCompleta, playerPauses, payments, mesIdx, anio, season.factor, seasonCalendar]);

  const pct = (v, base) => (base > 0 ? `${Math.round((v / base) * 1000) / 10}%` : '—');
  const mesLabel = `${MESES[mesIdx]} ${anio}`;
  const fechaStr = hoy.toLocaleDateString('es-MX');

  const colorTipo = {
    'Beca 100%': 'bg-purple-100 text-purple-700',
    'Beca parcial': 'bg-orange-100 text-orange-700',
    'Precio reducido sin beca': 'bg-amber-100 text-amber-800',
    'Cuota completa': 'bg-green-100 text-green-700',
    'Cuota superior': 'bg-blue-100 text-blue-700',
  };

  const exportXLSX = () => {
    const { filas, lista, motivos, teorico, real, mesActual, becadoTotal, pagan, fueraPolitica, meses } = analisis;
    const resumen = [
      ['Barcelona Inter Academy — Ingreso real por mensualidades'],
      [`Generado: ${fechaStr}  ·  Cuota completa de referencia: ${formatCurrency(cuotaCompleta)}  ·  Solo jugadores activos`],
      [],
      ['Tipo', 'Jugadores', '% de activos', 'Ingreso mensual', 'Monto becado'],
      ...lista.map(g => [g.tipo, g.n, pct(g.n, activos.length), g.ingreso, g.becado]),
      ['TOTAL', activos.length, '100%', real, becadoTotal],
      [],
      ['Ingreso teórico (activos × cuota completa)', teorico],
      ['Ingreso real esperado (suma de cuotas netas)', real],
      ['Becas otorgadas al mes', becadoTotal],
      ['% del ingreso teórico que realmente se percibe', pct(real, teorico)],
      ['Jugadores que pagan algo', pagan],
      ['Jugadores con beca 100%', activos.length - pagan],
      [`Ingreso esperado ${mesLabel} (con pausas y calendario de temporada)`, mesActual],
      ['Cuotas fuera de política de becas', fueraPolitica.length],
      [],
      ['Becas por motivo'],
      ['Motivo', 'Jugadores', 'Monto becado / mes', 'Ingreso que sí aportan'],
      ...motivos.map(m => [m.motivo, m.n, m.becado, m.ingreso]),
      [],
      ['Devengado vs cobrado (mensualidades)'],
      ['Mes', 'Devengado', 'Cobrado', '% cobranza', 'Ajuste calendario'],
      ...meses.map(m => [m.key + (m.enCurso ? ' (en curso)' : ''), m.devengado, m.cobrado, pct(m.cobrado, m.devengado), m.ajuste || '-']),
      [],
      ['Desglose'],
      ['Tipo', 'Subgrupo', 'Jugadores', 'Cuota neta', 'Ingreso mensual'],
      ...lista.flatMap(g => Object.values(g.subgrupos).sort((a, b) => b.efectiva - a.efectiva).map(s => [g.tipo, s.etiqueta, s.n, s.efectiva, s.ingreso])),
    ];
    const detalle = [
      ['Jugador', 'Categoría', 'Tipo', 'Beca %', 'Motivo', 'Cuota neta registrada', 'Cuota según política', 'Fuera de política', 'Monto becado', `Cuota ${mesLabel}`, 'Pausa'],
      ...filas.map(f => [f.nombre, f.categoria, f.tipo, f.pct, f.motivo || '-', f.cuotaRegistrada, f.pct > 0 ? f.esperada : '-', f.fueraPolitica ? 'SÍ' : '', f.becado, f.mesActual, f.pausa || '-']),
    ];
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet(resumen);
    ws1['!cols'] = [{ wch: 48 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    const ws2 = XLSX.utils.aoa_to_sheet(detalle);
    ws2['!cols'] = [{ wch: 36 }, { wch: 10 }, { wch: 22 }, { wch: 8 }, { wch: 26 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Resumen');
    XLSX.utils.book_append_sheet(wb, ws2, 'Detalle por jugador');
    XLSX.writeFile(wb, `ingreso_real_becas_${anio}-${String(mesIdx + 1).padStart(2, '0')}.xlsx`);
  };

  const exportPDF = () => {
    const { filas, lista, motivos, teorico, real, mesActual, becadoTotal, pagan, fueraPolitica, meses } = analisis;
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
    const titulo = (t) => { y += 6; doc.setFontSize(11); doc.setTextColor(40, 40, 40); doc.text(t, 14, y); y += 4; };

    tabla(['Tipo', 'Jugadores', '% activos', 'Ingreso mensual', 'Monto becado'], [56, 26, 26, 38, 36],
      [...lista.map(g => [g.tipo, g.n, pct(g.n, activos.length), formatCurrency(g.ingreso), formatCurrency(g.becado)]),
        ['TOTAL', activos.length, '100%', formatCurrency(real), formatCurrency(becadoTotal)]]);

    y += 6;
    doc.setFontSize(10); doc.setTextColor(40, 40, 40);
    [
      `Ingreso teórico (activos × cuota completa): ${formatCurrency(teorico)}`,
      `Ingreso real esperado por mes: ${formatCurrency(real)}  (${pct(real, teorico)} del teórico)`,
      `Becas otorgadas al mes: ${formatCurrency(becadoTotal)}`,
      `Pagan cuota: ${pagan} jugadores   ·   Beca 100%: ${activos.length - pagan} jugadores   ·   Fuera de política: ${fueraPolitica.length}`,
      `Ingreso esperado ${mesLabel} (con pausas y calendario): ${formatCurrency(mesActual)}`,
    ].forEach(l => { doc.text(l, 14, y); y += 6; });

    titulo('Becas por motivo');
    tabla(['Motivo', 'Jugadores', 'Monto becado / mes', 'Ingreso que sí aportan'], [70, 30, 42, 40],
      motivos.map(m => [m.motivo, m.n, formatCurrency(m.becado), formatCurrency(m.ingreso)]));

    titulo('Devengado vs cobrado (mensualidades)');
    tabla(['Mes', 'Devengado', 'Cobrado', '% cobranza', 'Calendario'], [46, 36, 36, 30, 34],
      meses.map(m => [m.key + (m.enCurso ? ' (en curso)' : ''), formatCurrency(m.devengado), formatCurrency(m.cobrado), pct(m.cobrado, m.devengado), m.ajuste || '-']));

    titulo('Desglose por subgrupo');
    tabla(['Tipo', 'Subgrupo', 'Jugadores', 'Cuota neta', 'Ingreso mensual'], [56, 30, 26, 34, 36],
      lista.flatMap(g => Object.values(g.subgrupos).sort((a, b) => b.efectiva - a.efectiva).map(s => [g.tipo, s.etiqueta, s.n, formatCurrency(s.efectiva), formatCurrency(s.ingreso)])));

    doc.addPage(); y = 20;
    doc.setFontSize(11); doc.text('Detalle por jugador (activos)', 14, y); y += 4;
    tabla(['Jugador', 'Cat.', 'Beca', 'Motivo', 'Cuota', 'Política', 'Becado'], [56, 16, 14, 40, 18, 20, 18],
      filas.map(f => [f.nombre, f.categoria, f.pct > 0 ? `${f.pct}%` : '-', f.motivo || '-', formatCurrency(f.cuotaRegistrada), f.fueraPolitica ? `≠ ${formatCurrency(f.esperada)}` : 'ok', formatCurrency(f.becado)]));

    doc.save(`ingreso_real_becas_${anio}-${String(mesIdx + 1).padStart(2, '0')}.pdf`);
  };

  const { lista, motivos, teorico, real, mesActual, becadoTotal, pagan, fueraPolitica, sinMotivo, reducidoSinBeca, meses } = analisis;

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
              <SelectTrigger className="w-52 h-9 text-sm"><SelectValue placeholder="Cuota completa" /></SelectTrigger>
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

          {(fueraPolitica.length > 0 || sinMotivo.length > 0 || reducidoSinBeca.length > 0) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-1">
              <p className="font-medium flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Revisión de política de becas</p>
              {reducidoSinBeca.length > 0 && <p>{reducidoSinBeca.length} jugador(es) pagan menos de la cuota completa sin beca declarada: {reducidoSinBeca.slice(0, 6).map(f => `${f.nombre} (${formatCurrency(f.efectiva)})`).join(', ')}{reducidoSinBeca.length > 6 ? '…' : ''}. Edita al jugador y declara el % y motivo.</p>}
              {sinMotivo.length > 0 && <p>{sinMotivo.length} beca(s) sin motivo clasificado: {sinMotivo.slice(0, 6).map(f => f.nombre).join(', ')}{sinMotivo.length > 6 ? '…' : ''}.</p>}
              {fueraPolitica.length > 0 && <p>{fueraPolitica.length} cuota(s) que no corresponden a su % de beca: {fueraPolitica.slice(0, 6).map(f => `${f.nombre} (${formatCurrency(f.efectiva)} vs ${formatCurrency(f.esperada)})`).join(', ')}{fueraPolitica.length > 6 ? '…' : ''}.</p>}
            </div>
          )}

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
                        <span key={s.etiqueta} className="inline-block mr-2">{s.n} × {s.pct > 0 && s.pct < 100 ? `${s.etiqueta} beca (${formatCurrency(s.efectiva)})` : s.pct >= 100 ? '100%' : s.etiqueta}</span>
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

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-100 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">Becas por motivo</p>
              {motivos.length === 0 ? <p className="text-xs text-gray-400">Sin becas declaradas.</p> : (
                <table className="w-full text-sm">
                  <tbody>
                    {motivos.map(m => (
                      <tr key={m.motivo} className="border-b last:border-0">
                        <td className="py-1.5 pr-2">{m.motivo}</td>
                        <td className="py-1.5 pr-2 text-right text-gray-600">{m.n}</td>
                        <td className="py-1.5 text-right text-purple-700 font-medium">{formatCurrency(m.becado)}<span className="text-xs text-gray-400"> /mes</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="rounded-lg border border-gray-100 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">Devengado vs cobrado (mensualidades)</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 text-left">
                    <th className="font-normal pb-1">Mes</th><th className="font-normal pb-1 text-right">Devengado</th><th className="font-normal pb-1 text-right">Cobrado</th><th className="font-normal pb-1 text-right">Cobranza</th>
                  </tr>
                </thead>
                <tbody>
                  {meses.map(m => (
                    <tr key={m.key} className={`border-b last:border-0 ${m.enCurso ? 'bg-blue-50/60' : ''}`}>
                      <td className="py-1.5 pr-2 capitalize">{m.label}{m.enCurso ? <span className="text-xs text-blue-600"> · en curso</span> : ''}{m.ajuste ? <span className="text-xs text-gray-400"> · {m.ajuste}</span> : ''}</td>
                      <td className="py-1.5 pr-2 text-right text-gray-600">{formatCurrency(m.devengado)}</td>
                      <td className="py-1.5 pr-2 text-right font-medium text-green-700">{formatCurrency(m.cobrado)}</td>
                      <td className={`py-1.5 text-right font-medium ${m.enCurso ? 'text-blue-600' : m.pctCobrado >= 0.9 ? 'text-green-700' : m.pctCobrado >= 0.7 ? 'text-amber-600' : 'text-red-600'}`}>{pct(m.cobrado, m.devengado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[11px] text-gray-400 mt-1">Devengado = cuotas netas de quienes estaban activos ese mes (ya ingresados y aún no dados de baja), con pausas y calendario. Cobrado = pagos de mensualidad aplicados a ese mes (sin recargos ni reversos).</p>
            </div>
          </div>

          <p className="text-xs text-gray-400">
            La cuota neta es la que el motor de deuda exige (cuota completa × (1 − beca%), redondeada a decena). El ingreso real esperado no incluye recargos, inscripciones, torneos ni uniformes; el detalle por jugador está en la descarga.
          </p>
        </CardContent>
      )}
    </Card>
  );
}
