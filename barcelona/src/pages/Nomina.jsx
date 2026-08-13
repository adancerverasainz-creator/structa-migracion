import React, { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/base44Client';
import { usePerms } from '@/lib/usePerms';
import { confirmar } from '@/components/ui/confirmar';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Users, Wallet, Plus, Pencil, Trash2, CheckCircle2, Undo2, Banknote,
  Printer, ChevronDown, ChevronRight, X, AlertCircle, Clock,
} from 'lucide-react';
import { formatCurrency } from '@/components/lib/formatCurrency';

// ─── Constantes ──────────────────────────────────────────────────────────────
const FRECUENCIAS = [
  { value: 'semanal', label: 'Semanal' },
  { value: 'quincenal', label: 'Quincenal' },
  { value: 'mensual', label: 'Mensual' },
];
const ESQUEMAS = [
  { value: 'fijo', label: 'Sueldo fijo' },
  { value: 'por_sesion', label: 'Por sesión' },
  { value: 'mixto', label: 'Mixto (fijo + sesiones)' },
];
// Fuentes de efectivo fijas; los bancos se cargan del catálogo de Tesorería
// (bank_accounts) — un banco nuevo aparece aquí automáticamente.
const FUENTES_EFECTIVO = [
  { value: 'fondos', label: 'Efectivo — Caja Fondos' },
  { value: 'efectivo', label: 'Efectivo — Caja del día' },
];
const construirFuentes = (bancos) => [
  ...FUENTES_EFECTIVO,
  ...(bancos || []).map(b => ({ value: b.name, label: `Transferencia ${b.name}` })),
];

// ─── Calendario de nómina (los usuarios NO teclean fechas) ──────────────────
const _iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const _finDeMes = (y, m) => new Date(y, m + 1, 0);
function opcionesPeriodo(tipo) {
  const hoy = new Date();
  const y = hoy.getFullYear(), m = hoy.getMonth(), d = hoy.getDate();
  const out = [];
  const push = (ini, fin, etiqueta) => out.push({ period_start: _iso(ini), period_end: _iso(fin), etiqueta });
  if (tipo === 'semanal') {
    const lunes = new Date(hoy); lunes.setDate(d - ((hoy.getDay() + 6) % 7));
    for (const off of [-7, 0, 7]) {
      const ini = new Date(lunes); ini.setDate(lunes.getDate() + off);
      const fin = new Date(ini); fin.setDate(ini.getDate() + 6);
      push(ini, fin, `Semana del ${fmtFecha(_iso(ini))} al ${fmtFecha(_iso(fin))}${off === 0 ? ' (actual)' : off < 0 ? ' (anterior)' : ' (siguiente)'}`);
    }
  } else if (tipo === 'mensual') {
    for (const off of [-1, 0, 1]) {
      const ini = new Date(y, m + off, 1);
      push(ini, _finDeMes(ini.getFullYear(), ini.getMonth()),
        `${ini.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}${off === 0 ? ' (actual)' : off < 0 ? ' (anterior)' : ' (siguiente)'}`);
    }
  } else { // quincenal y mixta usan el calendario quincenal: 1–15 y 16–fin de mes
    const qs = [];
    for (const off of [-1, 0, 1]) {
      const base = new Date(y, m + off, 1);
      const by = base.getFullYear(), bm = base.getMonth();
      qs.push([new Date(by, bm, 1), new Date(by, bm, 15)]);
      qs.push([new Date(by, bm, 16), _finDeMes(by, bm)]);
    }
    const actualIdx = qs.findIndex(([i, f]) => hoy >= i && hoy <= new Date(f.getFullYear(), f.getMonth(), f.getDate(), 23, 59));
    qs.forEach(([ini, fin], i) => {
      const q = ini.getDate() === 1 ? '1ª quincena' : '2ª quincena';
      const mes = ini.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
      push(ini, fin, `${q} de ${mes}${i === actualIdx ? ' (actual)' : ''}`);
    });
  }
  return out;
}
const indicePeriodoActual = (ops) => {
  const i = ops.findIndex(o => o.etiqueta.includes('(actual)'));
  return i >= 0 ? i : 0;
};
const STATUS_STYLE = {
  borrador: 'bg-gray-100 text-gray-700 border-gray-300',
  aprobada: 'bg-blue-50 text-blue-700 border-blue-300',
  pagada: 'bg-green-50 text-green-700 border-green-300',
  cancelada: 'bg-red-50 text-red-500 border-red-200',
};
const fmtFecha = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
let FUENTES_CACHE = FUENTES_EFECTIVO; // la página principal lo refresca con los bancos del catálogo
const labelFuente = (v) => FUENTES_CACHE.find(f => f.value === v)?.label || (v ? `Transferencia ${v}` : v);

// ─── Recibo imprimible ───────────────────────────────────────────────────────
function imprimirRecibo(period, items, colabById) {
  const rows = items.map(it => {
    const c = colabById[it.collaborator_id] || {};
    const extras = Array.isArray(it.extras) ? it.extras : [];
    const deds = Array.isArray(it.deductions) ? it.deductions : [];
    const lineas = [];
    if ((it.base_amount || 0) > 0) lineas.push(['Sueldo base del período', it.base_amount]);
    if ((it.sessions_count || 0) > 0) lineas.push([`Sesiones (${it.sessions_count} × ${formatCurrency(it.session_rate)})`, it.sessions_count * it.session_rate]);
    extras.forEach(e => lineas.push([e.concepto || 'Adicional', e.monto]));
    const lineasD = deds.map(d => [d.concepto || 'Deducción', d.monto]);
    return `
      <div class="recibo">
        <div class="rhead">
          <div><img src="https://swtrrldixeeecsmfseah.supabase.co/storage/v1/object/public/assets/logo-bia-transparente.png" class="logo"/></div>
          <div class="rtitle">
            <h2>Recibo de Nómina</h2>
            <p>Barcelona Inter Academy — Structa ERP</p>
            <p>Período: ${fmtFecha(period.period_start)} al ${fmtFecha(period.period_end)}</p>
          </div>
        </div>
        <table class="rinfo"><tr>
          <td><b>Colaborador:</b> ${c.name || ''}</td>
          <td><b>Puesto:</b> ${c.role_title || '—'}</td>
          <td><b>Pago:</b> ${labelFuente(it.pay_source)}</td>
        </tr></table>
        <table class="rtab">
          <tr><th>Percepciones</th><th class="num">Importe</th></tr>
          ${lineas.map(([t, m]) => `<tr><td>${t}</td><td class="num">${formatCurrency(m || 0)}</td></tr>`).join('')}
          <tr class="sub"><td>Total percepciones</td><td class="num">${formatCurrency(it.total_percepciones || 0)}</td></tr>
          ${lineasD.length ? `<tr><th>Deducciones</th><th class="num"></th></tr>` : ''}
          ${lineasD.map(([t, m]) => `<tr><td>${t}</td><td class="num">−${formatCurrency(m || 0)}</td></tr>`).join('')}
          <tr class="tot"><td>NETO A PAGAR</td><td class="num">${formatCurrency(it.net_amount || 0)}</td></tr>
        </table>
        <div class="firmas">
          <div><div class="linea"></div>Recibí conforme<br/><b>${c.name || ''}</b></div>
          <div><div class="linea"></div>Autorizó<br/><b>${period.paid_by || period.approved_by || ''}</b></div>
        </div>
        ${period.status === 'pagada' ? `<p class="pagado">PAGADA — ${fmtFecha(period.paid_date)} · Folio ${(period.id || '').slice(0, 8).toUpperCase()}</p>` : '<p class="pagado borr">DOCUMENTO PRELIMINAR — NÓMINA NO PAGADA</p>'}
      </div>`;
  }).join('');
  const w = window.open('', '_blank');
  if (!w) { toast.error('Permite las ventanas emergentes para imprimir el recibo'); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Recibos de Nómina</title><style>
    body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e;margin:0;padding:24px;}
    .recibo{page-break-after:always;border:1px solid #cbd5e1;border-radius:10px;padding:24px;max-width:720px;margin:0 auto 24px;}
    .rhead{display:flex;gap:16px;align-items:center;border-bottom:3px solid #004d98;padding-bottom:12px;margin-bottom:12px;}
    .logo{width:56px;height:56px;object-fit:contain;}
    .rtitle h2{margin:0;color:#004d98;} .rtitle p{margin:2px 0;font-size:12px;color:#475569;}
    .rinfo{width:100%;font-size:13px;margin-bottom:10px;} .rinfo td{padding:2px 8px 2px 0;}
    .rtab{width:100%;border-collapse:collapse;font-size:13px;}
    .rtab th{text-align:left;background:#f1f5f9;padding:6px 8px;border-bottom:1px solid #cbd5e1;}
    .rtab td{padding:5px 8px;border-bottom:1px solid #e2e8f0;} .num{text-align:right;white-space:nowrap;}
    .sub td{font-weight:600;background:#f8fafc;}
    .tot td{font-weight:800;font-size:15px;background:#004d98;color:#fff;}
    .firmas{display:flex;gap:48px;justify-content:space-around;margin-top:56px;text-align:center;font-size:12px;}
    .firmas .linea{border-top:1px solid #334155;width:200px;margin:0 auto 6px;}
    .pagado{text-align:center;margin-top:18px;font-size:11px;letter-spacing:2px;color:#16a34a;font-weight:700;}
    .pagado.borr{color:#d97706;}
    @media print {.recibo{border:none;margin:0 auto;}}
  </style></head><body>${rows}<script>window.onload=()=>window.print()</` + `script></body></html>`);
  w.document.close();
}

// ─── Formulario de colaborador ───────────────────────────────────────────────
function ColaboradorForm({ colaborador, fuentes, onClose, onSaved }) {
  const [f, setF] = useState(colaborador ? { ...colaborador } : {
    name: '', role_title: '', phone: '', email: '',
    pay_frequency: 'quincenal', pay_scheme: 'fijo',
    base_salary: '', session_rate: '', pay_source: 'fondos',
    bank_reference: '', start_date: '', notes: '', active: true,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const guardar = async (e) => {
    e.preventDefault();
    if (!f.name?.trim()) return toast.error('El nombre es obligatorio');
    setSaving(true);
    const payload = {
      name: f.name.trim(), role_title: f.role_title || null, phone: f.phone || null, email: f.email || null,
      pay_frequency: f.pay_frequency, pay_scheme: f.pay_scheme,
      base_salary: parseFloat(f.base_salary) || 0, session_rate: parseFloat(f.session_rate) || 0,
      pay_source: f.pay_source, bank_reference: f.bank_reference || null,
      start_date: f.start_date || null, notes: f.notes || null, active: f.active !== false,
    };
    const q = colaborador
      ? supabase.from('collaborators').update(payload).eq('id', colaborador.id)
      : supabase.from('collaborators').insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(colaborador ? 'Colaborador actualizado' : 'Colaborador registrado');
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <Card className="w-full max-w-xl my-auto shadow-2xl border-0">
        <div className="bg-gradient-to-r from-[#1a1a2e] to-[#004d98] text-white rounded-t-xl px-6 py-4 flex justify-between items-center">
          <h3 className="font-bold text-lg">{colaborador ? 'Editar colaborador' : 'Nuevo colaborador'}</h3>
          <button type="button" onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={guardar}>
          <CardContent className="pt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1"><Label>Nombre completo *</Label>
                <Input value={f.name} onChange={e => set('name', e.target.value)} required /></div>
              <div className="space-y-1"><Label>Puesto</Label>
                <Input placeholder="Entrenador, auxiliar..." value={f.role_title || ''} onChange={e => set('role_title', e.target.value)} /></div>
              <div className="space-y-1"><Label>Teléfono</Label>
                <Input value={f.phone || ''} onChange={e => set('phone', e.target.value)} /></div>
              <div className="space-y-1"><Label>Periodicidad *</Label>
                <Select value={f.pay_frequency} onValueChange={v => set('pay_frequency', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FRECUENCIAS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-1"><Label>Esquema de pago *</Label>
                <Select value={f.pay_scheme} onValueChange={v => set('pay_scheme', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ESQUEMAS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select></div>
              {f.pay_scheme !== 'por_sesion' && (
                <div className="space-y-1"><Label>Sueldo base por período</Label>
                  <Input type="number" step="0.01" min="0" value={f.base_salary ?? ''} onChange={e => set('base_salary', e.target.value)} /></div>)}
              {f.pay_scheme !== 'fijo' && (
                <div className="space-y-1"><Label>Tarifa por sesión</Label>
                  <Input type="number" step="0.01" min="0" value={f.session_rate ?? ''} onChange={e => set('session_rate', e.target.value)} /></div>)}
              <div className="space-y-1"><Label>Fuente de pago habitual</Label>
                <Select value={f.pay_source} onValueChange={v => set('pay_source', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{fuentes.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-1"><Label>CLABE / cuenta (referencia)</Label>
                <Input value={f.bank_reference || ''} onChange={e => set('bank_reference', e.target.value)} /></div>
              <div className="space-y-1"><Label>Fecha de ingreso</Label>
                <Input type="date" value={f.start_date || ''} onChange={e => set('start_date', e.target.value)} /></div>
            </div>
            <div className="space-y-1"><Label>Notas</Label>
              <Textarea rows={2} value={f.notes || ''} onChange={e => set('notes', e.target.value)} /></div>
            {colaborador && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={f.active !== false} onChange={e => set('active', e.target.checked)} />
                Colaborador activo (desmarcar = baja; conserva su historial)
              </label>)}
          </CardContent>
          <div className="px-6 pb-5 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="bg-[#004d98] hover:bg-[#003d78]">{saving ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

// ─── Editor de recibo (fila de nómina) ───────────────────────────────────────
function ReciboEditor({ item, colaborador, fuentes, editable, onSave, onDelete }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    base_amount: item.base_amount ?? 0, sessions_count: item.sessions_count ?? 0,
    session_rate: item.session_rate ?? 0,
    extras: Array.isArray(item.extras) ? item.extras : [],
    deductions: Array.isArray(item.deductions) ? item.deductions : [],
    pay_source: item.pay_source || 'fondos', notes: item.notes || '',
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const totalP = (parseFloat(f.base_amount) || 0) + (parseFloat(f.sessions_count) || 0) * (parseFloat(f.session_rate) || 0)
    + f.extras.reduce((s, e) => s + (parseFloat(e.monto) || 0), 0);
  const totalD = f.deductions.reduce((s, d) => s + (parseFloat(d.monto) || 0), 0);
  const neto = totalP - totalD;

  const lineaJson = (arr) => arr.filter(x => (x.concepto || '').trim() || parseFloat(x.monto)).map(x => ({ concepto: (x.concepto || '').trim(), monto: parseFloat(x.monto) || 0 }));
  const guardar = () => onSave(item.id, {
    base_amount: parseFloat(f.base_amount) || 0, sessions_count: parseFloat(f.sessions_count) || 0,
    session_rate: parseFloat(f.session_rate) || 0, extras: lineaJson(f.extras),
    deductions: lineaJson(f.deductions), pay_source: f.pay_source, notes: f.notes || null,
  }, () => setOpen(false));

  const editLinea = (key, i, campo, v) => set(key, f[key].map((x, j) => j === i ? { ...x, [campo]: v } : x));
  const addLinea = (key) => set(key, [...f[key], { concepto: '', monto: '' }]);
  const rmLinea = (key, i) => set(key, f[key].filter((_, j) => j !== i));

  return (
    <div className="border rounded-lg bg-white">
      <div className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50" onClick={() => setOpen(o => !o)}>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-800 truncate">{colaborador?.name || '—'}</p>
          <p className="text-xs text-gray-500">{colaborador?.role_title || ''} · {labelFuente(item.pay_source)}</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-[#004d98]">{formatCurrency(item.net_amount || 0)}</p>
          {(item.total_deducciones || 0) > 0 && <p className="text-[10px] text-red-500">−{formatCurrency(item.total_deducciones)} deducciones</p>}
        </div>
        {editable && onDelete && (
          <button type="button" className="text-red-400 hover:text-red-600 p-1" onClick={(e) => { e.stopPropagation(); onDelete(item.id, colaborador?.name); }}>
            <Trash2 className="w-4 h-4" /></button>)}
      </div>
      {open && (
        <div className="border-t px-4 py-3 space-y-3 bg-gray-50/60">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1"><Label className="text-xs">Sueldo base</Label>
              <Input type="number" step="0.01" min="0" disabled={!editable} value={f.base_amount} onChange={e => set('base_amount', e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Sesiones</Label>
              <Input type="number" step="1" min="0" disabled={!editable} value={f.sessions_count} onChange={e => set('sessions_count', e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Tarifa por sesión</Label>
              <Input type="number" step="0.01" min="0" disabled={!editable} value={f.session_rate} onChange={e => set('session_rate', e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Fuente de pago</Label>
              <Select value={f.pay_source} onValueChange={v => set('pay_source', v)} disabled={!editable}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{fuentes.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select></div>
          </div>
          {[['extras', 'Adicionales (torneos, copas, bonos)', 'text-green-700'], ['deductions', 'Deducciones (préstamos, faltas)', 'text-red-600']].map(([key, titulo, color]) => (
            <div key={key} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className={`text-xs ${color}`}>{titulo}</Label>
                {editable && <Button type="button" size="sm" variant="ghost" className="h-6 text-xs" onClick={() => addLinea(key)}><Plus className="w-3 h-3 mr-1" />Agregar</Button>}
              </div>
              {f[key].map((l, i) => (
                <div key={i} className="flex gap-2">
                  <Input className="flex-1 h-8 text-sm" placeholder="Concepto (p. ej. Copa Cancún)" disabled={!editable} value={l.concepto} onChange={e => editLinea(key, i, 'concepto', e.target.value)} />
                  <Input className="w-28 h-8 text-sm" type="number" step="0.01" placeholder="$" disabled={!editable} value={l.monto} onChange={e => editLinea(key, i, 'monto', e.target.value)} />
                  {editable && <button type="button" className="text-gray-400 hover:text-red-500" onClick={() => rmLinea(key, i)}><X className="w-4 h-4" /></button>}
                </div>))}
            </div>))}
          <div className="flex items-center justify-between bg-white border rounded-lg px-3 py-2 text-sm">
            <span className="text-gray-600">Percepciones {formatCurrency(totalP)} − Deducciones {formatCurrency(totalD)}</span>
            <span className={`font-bold ${neto < 0 ? 'text-red-600' : 'text-[#004d98]'}`}>Neto: {formatCurrency(neto)}</span>
          </div>
          {editable && (
            <div className="flex justify-end">
              <Button type="button" size="sm" onClick={guardar} disabled={neto < 0} className="bg-[#004d98] hover:bg-[#003d78]">Guardar recibo</Button>
            </div>)}
        </div>)}
    </div>
  );
}

// ─── Detalle de un período ───────────────────────────────────────────────────
function PeriodoDetail({ period, colaboradores, colabById, fuentes, isAdmin, canUpdate, onClose }) {
  const queryClient = useQueryClient();
  const [addingId, setAddingId] = useState('');
  const pagarOpKeyRef = useRef(null);
  const editable = period.status === 'borrador';

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['payrollItems', period.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('payroll_items').select('*').eq('period_id', period.id).order('created_at');
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['payrollItems', period.id] });
    queryClient.invalidateQueries({ queryKey: ['payrollPeriods'] });
  };

  const agregarColaborador = async (cid) => {
    const c = colabById[cid];
    if (!c) return;
    const { error } = await supabase.from('payroll_items').insert({
      period_id: period.id, collaborator_id: cid,
      base_amount: c.pay_scheme === 'por_sesion' ? 0 : (c.base_salary || 0),
      sessions_count: 0, session_rate: c.pay_scheme === 'fijo' ? 0 : (c.session_rate || 0),
      pay_source: c.pay_source || 'fondos',
    });
    if (error) return toast.error(error.message.includes('duplicate') ? `${c.name} ya está en esta nómina` : error.message);
    setAddingId('');
    invalidar();
  };

  const agregarTodos = async () => {
    const enNomina = new Set(items.map(i => i.collaborator_id));
    const faltan = colaboradores.filter(c => c.active && !enNomina.has(c.id));
    if (!faltan.length) return toast.info('Todos los colaboradores activos ya están en la nómina');
    for (const c of faltan) await agregarColaborador(c.id);
    toast.success(`${faltan.length} colaborador(es) agregados`);
  };

  const guardarItem = async (id, payload, done) => {
    const { error } = await supabase.from('payroll_items').update(payload).eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Recibo guardado');
    invalidar(); done?.();
  };

  const quitarItem = (id, nombre) => {
    confirmar(`¿Quitar a ${nombre || 'este colaborador'} de la nómina?`).then(async ok => {
      if (!ok) return;
      const { error } = await supabase.from('payroll_items').delete().eq('id', id);
      if (error) return toast.error(error.message);
      invalidar();
    });
  };

  const rpc = async (fn, params, msgOk) => {
    const { error, data } = await supabase.rpc(fn, params);
    if (error) return toast.error(error.message);
    toast.success(typeof msgOk === 'function' ? msgOk(data) : msgOk);
    invalidar();
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    queryClient.invalidateQueries({ queryKey: ['saldosPorCuenta'] });
  };

  const aprobar = () => {
    if (!items.length) return toast.error('Agrega al menos un colaborador');
    confirmar(`¿Aprobar la nómina del ${fmtFecha(period.period_start)} al ${fmtFecha(period.period_end)}? Los recibos quedarán bloqueados.`)
      .then(ok => ok && rpc('aprobar_nomina', { p_period_id: period.id }, 'Nómina aprobada'));
  };
  const reabrir = () => confirmar('¿Reabrir la nómina a borrador para hacer cambios?')
    .then(ok => ok && rpc('reabrir_nomina', { p_period_id: period.id }, 'Nómina reabierta'));
  const pagar = () => {
    const total = items.reduce((s, i) => s + (i.net_amount || 0), 0);
    confirmar(`¿PAGAR la nómina por ${formatCurrency(total)} (${items.length} recibo(s))? Se generarán los egresos y el acta será inmutable.`)
      .then(ok => {
        if (!ok) return;
        if (!pagarOpKeyRef.current) pagarOpKeyRef.current = globalThis.crypto?.randomUUID ? crypto.randomUUID() : null;
        rpc('pagar_nomina', { p_period_id: period.id, p_fecha: null, p_op_key: pagarOpKeyRef.current },
          (n) => `Nómina pagada: ${n} egreso(s) generados`);
      });
  };

  const totalNomina = items.reduce((s, i) => s + (i.net_amount || 0), 0);
  const disponibles = colaboradores.filter(c => c.active && !items.some(i => i.collaborator_id === c.id));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <Card className="w-full max-w-3xl my-auto shadow-2xl border-0 max-h-[92vh] flex flex-col">
        <div className="bg-gradient-to-r from-[#1a1a2e] to-[#004d98] text-white rounded-t-xl px-6 py-4 flex justify-between items-center shrink-0">
          <div>
            <h3 className="font-bold text-lg">Nómina {fmtFecha(period.period_start)} — {fmtFecha(period.period_end)}</h3>
            <p className="text-white/70 text-sm capitalize">{period.frequency} · <span className="uppercase font-semibold">{period.status}</span>{period.paid_date ? ` · pagada el ${fmtFecha(period.paid_date)}` : ''}</p>
          </div>
          <button type="button" onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <CardContent className="pt-5 space-y-3 overflow-y-auto">
          {editable && (
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-52 space-y-1">
                <Label className="text-xs">Agregar colaborador</Label>
                <Select value={addingId} onValueChange={agregarColaborador}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {disponibles.length === 0
                      ? <div className="px-3 py-2 text-sm text-gray-400">Sin colaboradores disponibles</div>
                      : disponibles.map(c => <SelectItem key={c.id} value={c.id}>{c.name} — {c.role_title || c.pay_frequency}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={agregarTodos}>
                <Users className="w-4 h-4 mr-1" />Todos los activos</Button>
            </div>)}
          {isLoading ? <p className="text-center text-gray-400 py-6">Cargando...</p>
            : items.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">Agrega colaboradores para armar la nómina</p>
            ) : (
              <div className="space-y-2">
                {items.map(it => (
                  <ReciboEditor key={it.id + (it.updated_at || '')} item={it} colaborador={colabById[it.collaborator_id]} fuentes={fuentes}
                    editable={editable} onSave={guardarItem} onDelete={editable ? quitarItem : null} />))}
              </div>)}
          <div className="flex items-center justify-between bg-[#004d98]/5 border border-[#004d98]/20 rounded-lg px-4 py-3">
            <span className="font-semibold text-gray-700">Total de la nómina ({items.length} recibos)</span>
            <span className="text-xl font-extrabold text-[#004d98]">{formatCurrency(totalNomina)}</span>
          </div>
        </CardContent>
        <div className="px-6 pb-5 pt-2 flex flex-wrap justify-end gap-2 shrink-0 border-t">
          <Button type="button" variant="outline" size="sm" onClick={() => imprimirRecibo(period, items, colabById)} disabled={!items.length}>
            <Printer className="w-4 h-4 mr-1" />Recibos</Button>
          {period.status === 'borrador' && (canUpdate || isAdmin) && (
            <Button type="button" size="sm" onClick={aprobar} className="bg-blue-600 hover:bg-blue-700">
              <CheckCircle2 className="w-4 h-4 mr-1" />Aprobar</Button>)}
          {period.status === 'aprobada' && (canUpdate || isAdmin) && (<>
            <Button type="button" size="sm" variant="outline" onClick={reabrir}><Undo2 className="w-4 h-4 mr-1" />Reabrir</Button>
            <Button type="button" size="sm" onClick={pagar} className="bg-green-600 hover:bg-green-700">
              <Banknote className="w-4 h-4 mr-1" />Pagar nómina</Button></>)}
        </div>
      </Card>
    </div>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────
export default function Nomina() {
  const { canCreate, canUpdate, canDelete, isAdmin, role } = usePerms('nomina');
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('nominas');
  const [showColabForm, setShowColabForm] = useState(false);
  const [editingColab, setEditingColab] = useState(null);
  const [detallePeriodo, setDetallePeriodo] = useState(null);
  const [showNuevoPeriodo, setShowNuevoPeriodo] = useState(false);
  // Calendario de nómina: el usuario elige tipo y período; las fechas las calcula el sistema
  const [tipoPeriodo, setTipoPeriodo] = useState('quincenal');
  const [opcionIdx, setOpcionIdx] = useState(null);

  const acceso = isAdmin || canCreate || canUpdate;

  // Bancos desde el catálogo de Tesorería — la lista de fuentes de pago se arma sola
  const { data: bancos = [] } = useQuery({
    enabled: acceso,
    queryKey: ['bankAccountsNomina'],
    queryFn: async () => {
      const { data, error } = await supabase.from('bank_accounts').select('name, active, sort_order').eq('active', true).order('sort_order');
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const fuentes = useMemo(() => construirFuentes(bancos), [bancos]);
  FUENTES_CACHE = fuentes;

  const { data: colaboradores = [] } = useQuery({
    enabled: acceso,
    queryKey: ['collaborators'],
    queryFn: async () => {
      const { data, error } = await supabase.from('collaborators').select('*').order('name');
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const colabById = useMemo(() => Object.fromEntries(colaboradores.map(c => [c.id, c])), [colaboradores]);

  const { data: periodos = [], isLoading: loadingPeriodos } = useQuery({
    enabled: acceso,
    queryKey: ['payrollPeriods'],
    queryFn: async () => {
      const { data, error } = await supabase.from('payroll_periods').select('*').order('period_start', { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
  });

  if (role && !acceso) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-3">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-xl font-bold text-gray-800">Módulo restringido</h2>
        <p className="text-gray-500 text-sm">La nómina es información confidencial. Pide acceso a un administrador desde el módulo Permisos.</p>
      </div>);
  }

  const opciones = useMemo(() => opcionesPeriodo(tipoPeriodo), [tipoPeriodo]);
  const idxSel = opcionIdx ?? indicePeriodoActual(opciones);
  const periodoElegido = opciones[idxSel];

  const crearPeriodo = async (e) => {
    e.preventDefault();
    if (!periodoElegido) return;
    const { data, error } = await supabase.from('payroll_periods').insert({
      period_start: periodoElegido.period_start,
      period_end: periodoElegido.period_end,
      frequency: tipoPeriodo,
    }).select().single();
    if (error) return toast.error(/duplicate|ux_payroll_periods/i.test(error.message)
      ? 'Ese período ya tiene una nómina creada — ábrela desde la lista.'
      : error.message);
    toast.success('Nómina creada en borrador');
    setShowNuevoPeriodo(false);
    setOpcionIdx(null);
    queryClient.invalidateQueries({ queryKey: ['payrollPeriods'] });
    setDetallePeriodo(data);
  };

  const eliminarPeriodo = (p) => {
    confirmar(`¿Eliminar la nómina en borrador del ${fmtFecha(p.period_start)}? Se pierden sus recibos capturados.`).then(async ok => {
      if (!ok) return;
      const { error } = await supabase.from('payroll_periods').delete().eq('id', p.id);
      if (error) return toast.error(error.message);
      queryClient.invalidateQueries({ queryKey: ['payrollPeriods'] });
    });
  };

  const bajaColaborador = (c) => {
    confirmar(`¿Dar de baja a ${c.name}? Conserva todo su historial de nóminas.`).then(async ok => {
      if (!ok) return;
      const { error } = await supabase.from('collaborators').update({ active: false, end_date: new Date().toISOString().split('T')[0] }).eq('id', c.id);
      if (error) return toast.error(error.message);
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
    });
  };

  const activos = colaboradores.filter(c => c.active);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Wallet className="w-8 h-8 text-[#004d98]" />Nómina
          </h1>
          <p className="text-gray-500 mt-1">Colaboradores, períodos de pago y recibos</p>
        </div>
        <div className="flex gap-2">
          {tab === 'colaboradores'
            ? <Button onClick={() => { setEditingColab(null); setShowColabForm(true); }} className="bg-[#004d98] hover:bg-[#003d78]"><Plus className="w-4 h-4 mr-2" />Nuevo Colaborador</Button>
            : <Button onClick={() => setShowNuevoPeriodo(true)} className="bg-[#004d98] hover:bg-[#003d78]"><Plus className="w-4 h-4 mr-2" />Nueva Nómina</Button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {[['nominas', 'Nóminas', Banknote], ['colaboradores', `Colaboradores (${activos.length})`, Users]].map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-semibold flex items-center gap-2 border-b-2 -mb-px transition-colors ${tab === key ? 'border-[#004d98] text-[#004d98]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <Icon className="w-4 h-4" />{label}
          </button>))}
      </div>

      {tab === 'nominas' && (
        loadingPeriodos ? <p className="text-center py-10 text-gray-400">Cargando...</p>
          : periodos.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <Banknote className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-600">Sin nóminas registradas</h3>
              <p className="text-gray-400 text-sm mt-1">Crea la primera con el botón "Nueva Nómina"</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {periodos.map(p => (
                <Card key={p.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setDetallePeriodo(p)}>
                  <CardContent className="py-3.5 flex items-center gap-4">
                    <div className={`px-2.5 py-1 rounded-full border text-xs font-bold uppercase ${STATUS_STYLE[p.status] || ''}`}>{p.status}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800">{fmtFecha(p.period_start)} — {fmtFecha(p.period_end)}</p>
                      <p className="text-xs text-gray-500 capitalize">{p.frequency}{p.paid_date ? ` · pagada ${fmtFecha(p.paid_date)} por ${p.paid_by}` : p.approved_at ? ` · aprobada por ${p.approved_by}` : ''}</p>
                    </div>
                    {p.status === 'borrador' && canDelete && (
                      <button type="button" className="text-red-400 hover:text-red-600 p-1.5" onClick={(e) => { e.stopPropagation(); eliminarPeriodo(p); }}>
                        <Trash2 className="w-4 h-4" /></button>)}
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </CardContent>
                </Card>))}
            </div>))}

      {tab === 'colaboradores' && (
        colaboradores.length === 0 ? (
          <Card><CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-600">Sin colaboradores</h3>
            <p className="text-gray-400 text-sm mt-1">Registra a tu equipo con el botón "Nuevo Colaborador"</p>
          </CardContent></Card>
        ) : (
          <Card><CardContent className="pt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500 border-b">
                <th className="pb-2 pr-3">Colaborador</th><th className="pb-2 pr-3">Puesto</th>
                <th className="pb-2 pr-3">Periodicidad</th><th className="pb-2 pr-3">Esquema</th>
                <th className="pb-2 pr-3 text-right">Base</th><th className="pb-2 pr-3 text-right">Por sesión</th>
                <th className="pb-2 pr-3">Fuente de pago</th><th className="pb-2"></th>
              </tr></thead>
              <tbody>
                {colaboradores.map(c => (
                  <tr key={c.id} className={`border-b last:border-0 ${!c.active ? 'opacity-45' : ''}`}>
                    <td className="py-2.5 pr-3 font-semibold text-gray-800">{c.name}{!c.active && <span className="ml-2 text-[10px] text-red-500 font-normal">BAJA</span>}</td>
                    <td className="py-2.5 pr-3 text-gray-600">{c.role_title || '—'}</td>
                    <td className="py-2.5 pr-3 capitalize">{c.pay_frequency}</td>
                    <td className="py-2.5 pr-3">{ESQUEMAS.find(e => e.value === c.pay_scheme)?.label || c.pay_scheme}</td>
                    <td className="py-2.5 pr-3 text-right">{c.pay_scheme === 'por_sesion' ? '—' : formatCurrency(c.base_salary || 0)}</td>
                    <td className="py-2.5 pr-3 text-right">{c.pay_scheme === 'fijo' ? '—' : formatCurrency(c.session_rate || 0)}</td>
                    <td className="py-2.5 pr-3 text-xs text-gray-600">{labelFuente(c.pay_source)}</td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      <button type="button" className="text-gray-400 hover:text-[#004d98] p-1" onClick={() => { setEditingColab(c); setShowColabForm(true); }}><Pencil className="w-4 h-4" /></button>
                      {c.active && <button type="button" className="text-gray-400 hover:text-red-500 p-1" onClick={() => bajaColaborador(c)}><Clock className="w-4 h-4" /></button>}
                    </td>
                  </tr>))}
              </tbody>
            </table>
          </CardContent></Card>))}

      {/* Modales */}
      {showColabForm && (
        <ColaboradorForm colaborador={editingColab} fuentes={fuentes} onClose={() => setShowColabForm(false)}
          onSaved={() => { setShowColabForm(false); queryClient.invalidateQueries({ queryKey: ['collaborators'] }); }} />)}

      {showNuevoPeriodo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl border-0">
            <div className="bg-gradient-to-r from-[#1a1a2e] to-[#004d98] text-white rounded-t-xl px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-lg">Nueva Nómina</h3>
              <button type="button" onClick={() => setShowNuevoPeriodo(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={crearPeriodo}>
              <CardContent className="pt-5 space-y-4">
                <div className="space-y-1"><Label>Tipo de período *</Label>
                  <Select value={tipoPeriodo} onValueChange={v => { setTipoPeriodo(v); setOpcionIdx(null); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{[...FRECUENCIAS, { value: 'mixta', label: 'Mixta (calendario quincenal)' }].map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div className="space-y-1"><Label>Período *</Label>
                  <Select value={String(idxSel)} onValueChange={v => setOpcionIdx(parseInt(v, 10))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{opciones.map((o, i) => <SelectItem key={o.period_start} value={String(i)}>{o.etiqueta}</SelectItem>)}</SelectContent>
                  </Select></div>
                {periodoElegido && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-800">
                    Del <b>{fmtFecha(periodoElegido.period_start)}</b> al <b>{fmtFecha(periodoElegido.period_end)}</b> — fechas calculadas por el sistema.
                  </div>)}
                <p className="text-xs text-gray-500">La nómina nace en <b>borrador</b>: agrega colaboradores, captura sesiones y adicionales, apruébala y páguala. Al pagar se generan los egresos automáticamente. No se permiten dos nóminas del mismo período.</p>
              </CardContent>
              <div className="px-6 pb-5 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowNuevoPeriodo(false)}>Cancelar</Button>
                <Button type="submit" className="bg-[#004d98] hover:bg-[#003d78]">Crear</Button>
              </div>
            </form>
          </Card>
        </div>)}

      {detallePeriodo && (
        <PeriodoDetail
          period={periodos.find(p => p.id === detallePeriodo.id) || detallePeriodo}
          colaboradores={colaboradores} colabById={colabById} fuentes={fuentes}
          isAdmin={isAdmin} canUpdate={canUpdate}
          onClose={() => setDetallePeriodo(null)} />)}
    </div>
  );
}
