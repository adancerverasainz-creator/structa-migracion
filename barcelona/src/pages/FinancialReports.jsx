import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, LineChart, Line, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import {
  BarChart2, TrendingUp, TrendingDown, DollarSign, Calendar,
  ChevronDown, ChevronRight, Users, Trophy, Sun, FileText, Layers
} from 'lucide-react';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '../components/lib/formatCurrency';

// ─── helpers ──────────────────────────────────────────────────────────────────
function parseLocalDate(d) {
  if (!d) return null;
  if (d instanceof Date) return d;
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split('-').map(Number);
    return new Date(y, m - 1, day);
  }
  return new Date(d);
}

function getDateField(r) {
  return r.payment_date || r.expense_date || r.register_date || r.created_date;
}

function inRange(r, start, end) {
  const d = parseLocalDate(getDateField(r));
  if (!d || isNaN(d)) return false;
  return d >= start && d <= end;
}

function getEffectiveAmount(r) {
  if (r.tournament_id !== undefined && r.paid_amount !== undefined) return r.paid_amount ?? 0;
  return r.amount || 0;
}

function getConceptLabel(r, players = [], tournaments = [], teams = []) {
  if (r.concept && r.concept.trim()) return r.concept.trim();
  if (r.player_name) {
    const label = r.payment_type === 'semana' ? `Semana ${r.week_number}` : 'Uniformes';
    return `Summer Camp ${label} — ${r.player_name}`;
  }
  if (r.player_id && !r.tournament_id) {
    const player = players.find(p => p.id === r.player_id);
    const name = player?.full_name || 'Jugador';
    const types = { mensualidad: 'Mensualidad', inscripcion: 'Inscripción', reinscripcion: 'Reinscripción', uniformes: 'Uniformes' };
    const type = types[r.payment_type] || 'Pago';
    return `${type} ${r.month || ''} — ${name}`.trim();
  }
  if (r.tournament_id) {
    const t = tournaments.find(t => t.id === r.tournament_id);
    const tname = t?.name || 'Torneo';
    if (r.external_name) return `${tname} — ${r.external_name} (Ext)`;
    const player = players.find(p => p.id === r.player_id);
    return `${tname} — ${player?.full_name || 'Jugador'}`;
  }
  if (r.team_id) {
    const team = teams.find(t => t.id === r.team_id);
    const tipo = r.payment_type === 'inscripcion' ? 'Inscripción Liga' : 'Arbitraje Liga';
    return `${tipo} — ${team?.name || 'Equipo'}${r.week_number ? ` Sem. ${r.week_number}` : ''}`;
  }
  if (r.cash_amount !== undefined) return `Corte de caja${r.source ? ' — ' + r.source : ''}`;
  return r.notes?.trim() || 'Sin concepto';
}

// ─── mini-components ──────────────────────────────────────────────────────────
function KPI({ title, value, sub, color, icon: Icon }) {
  const colors = {
    green: 'border-green-300 text-green-700 bg-green-50',
    red:   'border-red-300 text-red-700 bg-red-50',
    blue:  'border-blue-300 text-blue-700 bg-blue-50',
    indigo:'border-indigo-300 text-indigo-700 bg-indigo-50',
  };
  const cls = colors[color] || colors.blue;
  return (
    <Card className={`border-2 ${cls.split(' ')[0]}`}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${cls.split(' ')[1]}`}>{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
          </div>
          <div className={`p-3 rounded-xl ${cls.split(' ')[2]}`}>
            <Icon className={`w-6 h-6 ${cls.split(' ')[1]}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function IncomeSourceRow({ label, amount, count, color, icon: Icon, items, players, tournaments, teams, expanded, onToggle }) {
  return (
    <div className={`rounded-lg border ${color.border} overflow-hidden`}>
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-4 py-3 ${color.bg} hover:opacity-90 transition-opacity`}
      >
        <div className="flex items-center gap-3">
          <Icon className={`w-4 h-4 ${color.text}`} />
          <span className={`font-semibold text-sm ${color.text}`}>{label}</span>
          <Badge variant="outline" className={`text-xs ${color.text} ${color.border}`}>{count} registros</Badge>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-lg font-bold ${color.text}`}>{formatCurrency(amount)}</span>
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </div>
      </button>
      {expanded && items.length > 0 && (
        <div className="border-t divide-y divide-gray-100 max-h-72 overflow-y-auto">
          {items.map((r, i) => (
            <div key={r.id || i} className="flex items-center justify-between px-4 py-2 bg-white hover:bg-gray-50 text-sm gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate">{getConceptLabel(r, players, tournaments, teams)}</p>
                <p className="text-xs text-gray-400">
                  {r.payment_method && <span className="capitalize">{r.payment_method}</span>}
                  {r.bank_name && ` · ${r.bank_name}`}
                  {getDateField(r) && ` · ${format(parseLocalDate(getDateField(r)), "d MMM yyyy", { locale: es })}`}
                </p>
              </div>
              <span className="font-semibold text-green-600 shrink-0">{formatCurrency(getEffectiveAmount(r))}</span>
            </div>
          ))}
        </div>
      )}
      {expanded && items.length === 0 && (
        <p className="text-center py-4 text-sm text-gray-400 bg-white">Sin registros en este período</p>
      )}
    </div>
  );
}

function ExpenseCategoryRow({ category, amount, items, catLabel, expanded, onToggle }) {
  return (
    <div className="rounded-lg border border-red-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-red-50 hover:bg-red-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm text-red-700">{catLabel}</span>
          <Badge variant="outline" className="text-xs text-red-600 border-red-200">{items.length}</Badge>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-red-600">{formatCurrency(amount)}</span>
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </div>
      </button>
      {expanded && (
        <div className="border-t divide-y divide-gray-100 max-h-64 overflow-y-auto">
          {items.map((e, i) => (
            <div key={e.id || i} className="flex items-center justify-between px-4 py-2 bg-white text-sm gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate">{e.concept}</p>
                <p className="text-xs text-gray-400">
                  <span className="capitalize">{e.payment_method}</span>
                  {e.account && ` · ${e.account}`}
                  {e.expense_date && ` · ${format(parseLocalDate(e.expense_date), "d MMM yyyy", { locale: es })}`}
                </p>
              </div>
              <span className="font-semibold text-red-600 shrink-0">{formatCurrency(e.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MethodBreakdown({ payments, expenses, players, tournaments, teams }) {
  const methods = ['efectivo', 'tarjeta', 'transferencia'];
  const [expanded, setExpanded] = React.useState({});
  const toggle = (k) => setExpanded(p => ({ ...p, [k]: !p[k] }));

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Desglose por Método de Pago</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-2">
          {methods.map(m => {
            const incR = payments.filter(p => p.payment_method === m);
            const expR = expenses.filter(e => e.payment_method === m);
            const inc = incR.reduce((s, p) => s + getEffectiveAmount(p), 0);
            const exp = expR.reduce((s, e) => s + (e.amount || 0), 0);
            const isOpen = expanded[m];
            return (
              <div key={m} className="rounded border border-gray-200 overflow-hidden">
                <button className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors" onClick={() => toggle(m)}>
                  <div className="flex items-center gap-2">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    <span className="capitalize font-medium text-sm">{m}</span>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span className="text-green-600">+{formatCurrency(inc)}</span>
                    <span className="text-red-600">-{formatCurrency(exp)}</span>
                    <span className={`font-bold ${inc - exp >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(inc - exp)}</span>
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t divide-y divide-gray-100">
                    {incR.length > 0 && (
                      <div className="bg-green-50 px-4 py-2">
                        <p className="text-xs font-semibold text-green-700 mb-1 uppercase tracking-wide">Ingresos ({incR.length})</p>
                        <div className="space-y-1">
                          {incR.map((r, i) => (
                            <div key={i} className="flex justify-between text-xs text-gray-700 gap-2">
                              <span className="truncate max-w-[55%]">{getConceptLabel(r, players, tournaments, teams)}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                {m === 'transferencia' && r.bank_name && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-300 text-blue-700 bg-blue-50">{r.bank_name}</Badge>
                                )}
                                <span className="text-green-700 font-medium">+{formatCurrency(getEffectiveAmount(r))}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {expR.length > 0 && (
                      <div className="bg-red-50 px-4 py-2">
                        <p className="text-xs font-semibold text-red-700 mb-1 uppercase tracking-wide">Egresos ({expR.length})</p>
                        <div className="space-y-1">
                          {expR.map((r, i) => (
                            <div key={i} className="flex justify-between text-xs text-gray-700 gap-2">
                              <span className="truncate max-w-[55%]">{r.concept || '—'}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                {m === 'transferencia' && (r.account || r.bank_name) && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-300 text-blue-700 bg-blue-50">{r.account || r.bank_name}</Badge>
                                )}
                                <span className="text-red-700 font-medium">-{formatCurrency(r.amount)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

const EXPENSE_LABELS = {
  nomina:'Nómina', bono_torneo:'Bono Torneo', viaticos:'Viáticos', hospedaje:'Hospedaje',
  transporte:'Transporte', equipamiento:'Equipamiento', mantenimiento:'Mantenimiento',
  arbitros:'Árbitros', intereses:'Intereses', retorno_inversion:'Retorno de Inv.',
  copa:'Copa', torneo:'Torneo', liga:'Liga', otros:'Otros',
};

const PIE_COLORS = ['#22c55e','#6366f1','#f59e0b','#06b6d4','#f97316','#a855f7'];

// ─── main page ────────────────────────────────────────────────────────────────
export default function FinancialReports() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [expandedIncome, setExpandedIncome] = useState({});
  const [expandedExpense, setExpandedExpense] = useState({});

  const { data: payments = [] }           = useQuery({ queryKey: ['payments'],           queryFn: () => base44.entities.Payment.list(null, 10000) });
  const { data: generalPayments = [] }    = useQuery({ queryKey: ['generalPayments'],     queryFn: () => base44.entities.GeneralPayment.list(null, 10000) });
  const { data: tournamentPayments = [] } = useQuery({ queryKey: ['tournamentPayments'],  queryFn: () => base44.entities.TournamentPayment.list(null, 10000) });
  const { data: leaguePayments = [] }     = useQuery({ queryKey: ['leaguePayments'],      queryFn: () => base44.entities.LeaguePayment.list(null, 10000) });
  const { data: summerCampPayments = [] } = useQuery({ queryKey: ['summerCampPayments'],  queryFn: () => base44.entities.SummerCampPayment.list(null, 10000) });
  const { data: expenses = [] }           = useQuery({ queryKey: ['expenses'],            queryFn: () => base44.entities.Expense.list(null, 10000) });
  const { data: players = [] }            = useQuery({ queryKey: ['players'],             queryFn: () => base44.entities.Player.list(null, 10000) });
  const { data: tournaments = [] }        = useQuery({ queryKey: ['tournaments'],          queryFn: () => base44.entities.Tournament.list(null, 1000) });
  const { data: teams = [] }              = useQuery({ queryKey: ['teams'],                queryFn: () => base44.entities.Team.list(null, 1000) });

  const now = selectedDate;
  const campPagados = summerCampPayments.filter(p => p.status === 'pagado');

  // All income sources array
  const allPayments = [...payments, ...generalPayments, ...tournamentPayments, ...leaguePayments, ...campPagados];
  const allExpenses = [...expenses];

  // ── Period helpers ──
  const dayStart   = startOfDay(now);   const dayEnd   = endOfDay(now);
  const weekStart  = startOfWeek(now, { weekStartsOn: 1 }); const weekEnd  = endOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now); const monthEnd = endOfMonth(now);
  const prevWeekStart  = startOfWeek(subWeeks(now,1), { weekStartsOn: 1 }); const prevWeekEnd  = endOfWeek(subWeeks(now,1), { weekStartsOn: 1 });
  const prevMonthStart = startOfMonth(subMonths(now,1)); const prevMonthEnd = endOfMonth(subMonths(now,1));

  const calcInc = (arr, s, e) => arr.filter(p => inRange(p,s,e)).reduce((t,p) => t + getEffectiveAmount(p), 0);
  const calcExp = (arr, s, e) => arr.filter(r => inRange(r,s,e)).reduce((t,r) => t + (r.amount||0), 0);

  const dayInc   = calcInc(allPayments, dayStart, dayEnd);
  const dayExp   = calcExp(allExpenses, dayStart, dayEnd);
  const weekInc  = calcInc(allPayments, weekStart, weekEnd);
  const weekExp  = calcExp(allExpenses, weekStart, weekEnd);
  const monthInc = calcInc(allPayments, monthStart, monthEnd);
  const monthExp = calcExp(allExpenses, monthStart, monthEnd);
  const prevWeekInc  = calcInc(allPayments, prevWeekStart, prevWeekEnd);
  const prevWeekExp  = calcExp(allExpenses, prevWeekStart, prevWeekEnd);
  const prevMonthInc = calcInc(allPayments, prevMonthStart, prevMonthEnd);
  const prevMonthExp = calcExp(allExpenses, prevMonthStart, prevMonthEnd);

  // ── Charts ──
  const weeklyChart = Array.from({ length: 4 }, (_, i) => {
    const ws = startOfWeek(subWeeks(now, 3-i), { weekStartsOn: 1 });
    const we = endOfWeek(subWeeks(now, 3-i), { weekStartsOn: 1 });
    return { semana: `Sem ${format(ws,'d MMM',{locale:es})}`, Ingresos: calcInc(allPayments,ws,we), Egresos: calcExp(allExpenses,ws,we) };
  });

  const monthlyChart = Array.from({ length: 6 }, (_, i) => {
    const ms = startOfMonth(subMonths(now, 5-i));
    const me = endOfMonth(subMonths(now, 5-i));
    const inc = calcInc(allPayments, ms, me);
    const exp = calcExp(allExpenses, ms, me);
    return { mes: format(ms,'MMM yy',{locale:es}), Ingresos: inc, Egresos: exp, Utilidad: inc - exp };
  });

  // ── Ingresos por fuente (mes actual) ──
  const incomeSources = [
    {
      key: 'cuotas', label: 'Cuotas Mensuales', icon: Users,
      color: { border: 'border-green-200', bg: 'bg-green-50', text: 'text-green-700' },
      items: payments.filter(p => inRange(p, monthStart, monthEnd)),
    },
    {
      key: 'torneos', label: 'Torneos', icon: Trophy,
      color: { border: 'border-purple-200', bg: 'bg-purple-50', text: 'text-purple-700' },
      items: tournamentPayments.filter(p => inRange(p, monthStart, monthEnd)),
    },
    {
      key: 'liga', label: 'Liga Fut 7', icon: BarChart2,
      color: { border: 'border-blue-200', bg: 'bg-blue-50', text: 'text-blue-700' },
      items: leaguePayments.filter(p => inRange(p, monthStart, monthEnd)),
    },
    {
      key: 'summercamp', label: 'Summer Camp', icon: Sun,
      color: { border: 'border-yellow-200', bg: 'bg-yellow-50', text: 'text-yellow-700' },
      items: campPagados.filter(p => inRange(p, monthStart, monthEnd)),
    },
    {
      key: 'generales', label: 'Pagos Generales', icon: FileText,
      color: { border: 'border-orange-200', bg: 'bg-orange-50', text: 'text-orange-700' },
      items: generalPayments.filter(p => inRange(p, monthStart, monthEnd)),
    },
  ];

  const totalMonthIncome = incomeSources.reduce((s, src) => s + src.items.reduce((t,p) => t + getEffectiveAmount(p), 0), 0);

  const pieData = incomeSources
    .map(src => ({ name: src.label, value: src.items.reduce((t,p) => t + getEffectiveAmount(p), 0) }))
    .filter(d => d.value > 0);

  // ── Egresos por categoría (mes actual) ──
  const expensesMonth = expenses.filter(e => inRange(e, monthStart, monthEnd));
  const expByCategory = expensesMonth.reduce((acc, e) => {
    const c = e.category || 'otros';
    if (!acc[c]) acc[c] = [];
    acc[c].push(e);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-indigo-50 flex-shrink-0">
              <BarChart2 className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <nav className="flex items-center gap-1 mb-0.5">
                <span className="text-xs font-medium text-gray-400">BIA</span>
                <span className="text-gray-300 text-xs">/</span>
                <span className="text-xs font-medium text-gray-500">Reportes Financieros</span>
              </nav>
              <h1 className="text-xl font-bold text-gray-900">Reportes Financieros Globales</h1>
              <p className="text-sm text-gray-500 mt-0.5">Todos los módulos integrados · Tiempo real</p>
            </div>
          </div>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                <Calendar className="w-4 h-4" />
                {format(selectedDate, "d 'de' MMMM 'de' yyyy", { locale: es })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <CalendarPicker mode="single" selected={selectedDate} onSelect={d => { if (d) { setSelectedDate(d); setCalendarOpen(false); } }} locale={es} initialFocus />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Tabs defaultValue="ingresos" className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-11">
          <TabsTrigger value="ingresos" className="flex items-center gap-1.5 text-xs">
            <TrendingUp className="w-3.5 h-3.5" /> Ingresos
          </TabsTrigger>
          <TabsTrigger value="egresos" className="flex items-center gap-1.5 text-xs">
            <TrendingDown className="w-3.5 h-3.5" /> Egresos
          </TabsTrigger>
          <TabsTrigger value="daily" className="flex items-center gap-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5" /> Diario
          </TabsTrigger>
          <TabsTrigger value="weekly" className="flex items-center gap-1.5 text-xs">
            <Layers className="w-3.5 h-3.5" /> Semanal
          </TabsTrigger>
          <TabsTrigger value="monthly" className="flex items-center gap-1.5 text-xs">
            <DollarSign className="w-3.5 h-3.5" /> Mensual
          </TabsTrigger>
        </TabsList>

        {/* ── INGRESOS ERP ── */}
        <TabsContent value="ingresos" className="mt-6 space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-700 font-medium flex justify-between items-center">
            <span>Ingresos de {format(now, "MMMM 'de' yyyy", { locale: es })}</span>
            <span className="font-bold text-lg">{formatCurrency(totalMonthIncome)}</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Fuentes */}
            <div className="lg:col-span-2 space-y-3">
              {incomeSources.map(src => (
                <IncomeSourceRow
                  key={src.key}
                  label={src.label}
                  amount={src.items.reduce((t,p) => t + getEffectiveAmount(p), 0)}
                  count={src.items.length}
                  color={src.color}
                  icon={src.icon}
                  items={src.items}
                  players={players}
                  tournaments={tournaments}
                  teams={teams}
                  expanded={!!expandedIncome[src.key]}
                  onToggle={() => setExpandedIncome(p => ({ ...p, [src.key]: !p[src.key] }))}
                />
              ))}
            </div>

            {/* Pie chart */}
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-sm text-gray-600">Distribución de Ingresos</CardTitle></CardHeader>
                <CardContent className="pt-0">
                  {pieData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${(percent*100).toFixed(0)}%`} labelLine={false}>
                            {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={v => formatCurrency(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1.5 mt-2">
                        {pieData.map((d, i) => (
                          <div key={d.name} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                              <span className="text-gray-600">{d.name}</span>
                            </div>
                            <span className="font-semibold text-gray-800">{formatCurrency(d.value)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-center py-8 text-sm text-gray-400">Sin ingresos este mes</p>
                  )}
                </CardContent>
              </Card>

              {/* Por método */}
              <Card>
                <CardHeader><CardTitle className="text-sm text-gray-600">Por Método de Pago</CardTitle></CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {['efectivo','tarjeta','transferencia'].map(m => {
                    const val = incomeSources.flatMap(s => s.items).filter(p => p.payment_method === m).reduce((t,p) => t + getEffectiveAmount(p), 0);
                    return (
                      <div key={m} className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
                        <span className="text-sm capitalize text-gray-600">{m}</span>
                        <span className="font-semibold text-green-600">{formatCurrency(val)}</span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ── EGRESOS ERP ── */}
        <TabsContent value="egresos" className="mt-6 space-y-6">
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700 font-medium flex justify-between items-center">
            <span>Egresos de {format(now, "MMMM 'de' yyyy", { locale: es })}</span>
            <span className="font-bold text-lg">{formatCurrency(expensesMonth.reduce((s,e) => s+(e.amount||0), 0))}</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-3">
              {Object.keys(expByCategory).length === 0 ? (
                <p className="text-center py-12 text-gray-400">Sin egresos en este mes</p>
              ) : (
                Object.entries(expByCategory)
                  .sort(([,a],[,b]) => b.reduce((s,e)=>s+(e.amount||0),0) - a.reduce((s,e)=>s+(e.amount||0),0))
                  .map(([cat, items]) => (
                    <ExpenseCategoryRow
                      key={cat}
                      category={cat}
                      catLabel={EXPENSE_LABELS[cat] || cat}
                      amount={items.reduce((s,e) => s+(e.amount||0), 0)}
                      items={items}
                      expanded={!!expandedExpense[cat]}
                      onToggle={() => setExpandedExpense(p => ({ ...p, [cat]: !p[cat] }))}
                    />
                  ))
              )}
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-sm text-gray-600">Distribución de Egresos</CardTitle></CardHeader>
                <CardContent className="pt-0">
                  {expensesMonth.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={Object.entries(expByCategory).map(([cat, items]) => ({ name: EXPENSE_LABELS[cat]||cat, value: items.reduce((s,e)=>s+(e.amount||0),0) }))}
                            cx="50%" cy="50%" outerRadius={80} dataKey="value"
                            label={({ percent }) => `${(percent*100).toFixed(0)}%`} labelLine={false}
                          >
                            {Object.keys(expByCategory).map((_,i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={v => formatCurrency(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1.5 mt-2">
                        {Object.entries(expByCategory).map(([cat, items], i) => (
                          <div key={cat} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                              <span className="text-gray-600">{EXPENSE_LABELS[cat]||cat}</span>
                            </div>
                            <span className="font-semibold text-gray-800">{formatCurrency(items.reduce((s,e)=>s+(e.amount||0),0))}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-center py-8 text-sm text-gray-400">Sin egresos este mes</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm text-gray-600">Por Método de Pago</CardTitle></CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {['efectivo','tarjeta','transferencia'].map(m => {
                    const val = expensesMonth.filter(e => e.payment_method === m).reduce((t,e) => t+(e.amount||0), 0);
                    return (
                      <div key={m} className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
                        <span className="text-sm capitalize text-gray-600">{m}</span>
                        <span className="font-semibold text-red-600">{formatCurrency(val)}</span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ── DIARIO ── */}
        <TabsContent value="daily" className="mt-6 space-y-6">
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 text-sm text-indigo-700 font-medium">
            {format(now, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KPI title="Ingresos del Día"  value={formatCurrency(dayInc)}          color="green"  icon={TrendingUp} />
            <KPI title="Egresos del Día"   value={formatCurrency(dayExp)}          color="red"    icon={TrendingDown} />
            <KPI title="Utilidad del Día"  value={formatCurrency(dayInc - dayExp)} color={dayInc-dayExp>=0?'blue':'red'} icon={DollarSign}
              sub={dayInc-dayExp>=0?'Positivo':'Negativo'} />
          </div>
          <MethodBreakdown payments={allPayments.filter(p=>inRange(p,dayStart,dayEnd))} expenses={allExpenses.filter(e=>inRange(e,dayStart,dayEnd))} players={players} tournaments={tournaments} teams={teams} />
        </TabsContent>

        {/* ── SEMANAL ── */}
        <TabsContent value="weekly" className="mt-6 space-y-6">
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 text-sm text-indigo-700 font-medium">
            Semana: {format(weekStart,'d MMM',{locale:es})} – {format(weekEnd,'d MMM yyyy',{locale:es})}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KPI title="Ingresos Semana"  value={formatCurrency(weekInc)}  sub={`Sem. anterior: ${formatCurrency(prevWeekInc)}`}  color="green" icon={TrendingUp} />
            <KPI title="Egresos Semana"   value={formatCurrency(weekExp)}  sub={`Sem. anterior: ${formatCurrency(prevWeekExp)}`}  color="red"   icon={TrendingDown} />
            <KPI title="Utilidad Semanal" value={formatCurrency(weekInc-weekExp)} sub={`Anterior: ${formatCurrency(prevWeekInc-prevWeekExp)}`} color={weekInc-weekExp>=0?'blue':'red'} icon={DollarSign} />
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Ingresos vs Egresos — Últimas 4 Semanas</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={weeklyChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="semana" />
                  <YAxis tickFormatter={v=>`$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v=>formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="Ingresos" fill="#22c55e" />
                  <Bar dataKey="Egresos"  fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <MethodBreakdown payments={allPayments.filter(p=>inRange(p,weekStart,weekEnd))} expenses={allExpenses.filter(e=>inRange(e,weekStart,weekEnd))} players={players} tournaments={tournaments} teams={teams} />
        </TabsContent>

        {/* ── MENSUAL ── */}
        <TabsContent value="monthly" className="mt-6 space-y-6">
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 text-sm text-indigo-700 font-medium">
            {format(now, "MMMM 'de' yyyy", { locale: es })}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KPI title="Ingresos del Mes"  value={formatCurrency(monthInc)} sub={`Mes anterior: ${formatCurrency(prevMonthInc)}`} color="green" icon={TrendingUp} />
            <KPI title="Egresos del Mes"   value={formatCurrency(monthExp)} sub={`Mes anterior: ${formatCurrency(prevMonthExp)}`} color="red"   icon={TrendingDown} />
            <KPI title="Utilidad Mensual"  value={formatCurrency(monthInc-monthExp)} sub={`Anterior: ${formatCurrency(prevMonthInc-prevMonthExp)}`} color={monthInc-monthExp>=0?'blue':'red'} icon={DollarSign} />
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Tendencia de los Últimos 6 Meses</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={monthlyChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis tickFormatter={v=>`$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v=>formatCurrency(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="Ingresos" stroke="#22c55e" strokeWidth={2} dot={{ r:4 }} />
                  <Line type="monotone" dataKey="Egresos"  stroke="#ef4444" strokeWidth={2} dot={{ r:4 }} />
                  <Line type="monotone" dataKey="Utilidad" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 5" dot={{ r:4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <MethodBreakdown payments={allPayments.filter(p=>inRange(p,monthStart,monthEnd))} expenses={allExpenses.filter(e=>inRange(e,monthStart,monthEnd))} players={players} tournaments={tournaments} teams={teams} />
        </TabsContent>
      </Tabs>
    </div>
  );
}