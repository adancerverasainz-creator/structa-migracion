import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, DollarSign, Calendar, ChevronDown, ChevronUp, User, BarChart2 } from 'lucide-react';
import ERPPageHeader from '../components/layout/ERPPageHeader';
import KPICard from '../components/layout/KPICard';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '../components/lib/formatCurrency';

export default function Dashboard() {
const [period, setPeriod] = useState('month');
const [expandedCategory, setExpandedCategory] = useState(null);

const { data: payments = [] } = useQuery({
queryKey: ['payments'],
queryFn: () => base44.entities.Payment.list('-payment_date'),
staleTime: 0,
});

const { data: tournamentPayments = [] } = useQuery({
queryKey: ['tournamentPayments'],
queryFn: () => base44.entities.TournamentPayment.list(),
staleTime: 0,
});

const { data: leaguePayments = [] } = useQuery({
queryKey: ['leaguePayments'],
queryFn: () => base44.entities.LeaguePayment.list(),
staleTime: 0,
});

const { data: generalPayments = [] } = useQuery({
queryKey: ['generalPayments'],
queryFn: () => base44.entities.GeneralPayment.list('-payment_date'),
initialData: [],
staleTime: 0,
});

const { data: expenses = [] } = useQuery({
queryKey: ['expenses'],
queryFn: () => base44.entities.Expense.list('-expense_date'),
initialData: [],
staleTime: 0,
});

const { data: cajaPrincipalExpenses = [] } = useQuery({
queryKey: ['cajaPrincipalExpenses'],
queryFn: () => base44.entities.CajaPrincipalExpense.list('-expense_date'),
initialData: [],
staleTime: 0,
});

const { data: players = [] } = useQuery({
queryKey: ['players'],
queryFn: () => base44.entities.Player.list(),
initialData: [],
staleTime: 0,
});

const { data: teams = [] } = useQuery({
queryKey: ['teams'],
queryFn: () => base44.entities.Team.list(),
initialData: [],
staleTime: 0,
});

const { data: summerCampPayments = [] } = useQuery({
queryKey: ['summerCampPayments'],
queryFn: () => base44.entities.SummerCampPayment.list('-payment_date'),
initialData: [],
staleTime: 0,
});

const { data: tournaments = [] } = useQuery({
queryKey: ['tournaments'],
queryFn: () => base44.entities.Tournament.list(),
initialData: [],
staleTime: 0,
});

const now = new Date();
const periodStart = period === 'month' ? startOfMonth(now) : startOfYear(now);
const periodEnd = period === 'month' ? endOfMonth(now) : endOfYear(now);

// FIX: parseLocalDate evita el bug de zona horaria donde new Date("YYYY-MM-DD")
// interpreta la fecha como UTC midnight, desplazando días tempranos del mes fuera del rango.
// Ej: "2026-07-01" con new Date() → June 30 18:00 local (UTC-6) → excluido del mes.
const parseLocalDate = (dateStr) => {
  if (!dateStr) return null;
  const str = String(dateStr);
  const datePart = str.includes('T') ? str.split('T')[0] : str.split(' ')[0];
  const parts = datePart.split('-').map(Number);
  if (parts.length < 3 || parts.some(isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
};

const filterByPeriod = (date) => {
  const d = parseLocalDate(date);
  if (!d) return false;
  return d >= periodStart && d <= periodEnd;
};

// FIX: added p.status === 'pagado' filter — previously included pending payments in monthly totals
const monthlyPayments = payments.filter(p => filterByPeriod(p.payment_date) && p.status === 'pagado');
const mensualidadPayments = monthlyPayments.filter(p => p.payment_type === 'mensualidad');
const inscripcionPayments = monthlyPayments.filter(p => p.payment_type === 'inscripcion' || p.payment_type === 'reinscripcion');
const uniformesPayments = monthlyPayments.filter(p => p.payment_type === 'uniformes');
const totalMonthlyIncome = monthlyPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

// Ingresos de torneos (usar paid_amount que es lo realmente cobrado)
const tournamentPaymentsFiltered = tournamentPayments.filter(p => filterByPeriod(p.payment_date));
const totalTournamentIncome = tournamentPaymentsFiltered.reduce((sum, p) => sum + (p.paid_amount ?? p.amount ?? 0), 0);

// Ingresos de Liga Fut 7
const leaguePaymentsFiltered = leaguePayments.filter(p => filterByPeriod(p.payment_date));
const leagueRegistrations = leaguePaymentsFiltered.filter(p => p.payment_type === 'inscripcion');
const leagueReferees = leaguePaymentsFiltered.filter(p => p.payment_type === 'arbitraje');
const totalLeagueIncome = leaguePaymentsFiltered.reduce((sum, p) => sum + (p.amount || 0), 0);

// Ingresos de Pagos Generales
const generalPaymentsFiltered = generalPayments.filter(p => filterByPeriod(p.payment_date));
const totalGeneralIncome = generalPaymentsFiltered.reduce((sum, p) => sum + (p.amount || 0), 0);

// Summer Camp
const summerCampFiltered = summerCampPayments.filter(p => filterByPeriod(p.payment_date) && p.status === 'pagado');
const totalSummerCampIncome = summerCampFiltered.reduce((sum, p) => sum + (p.amount || 0), 0);

// Total ingresos
const totalIncome = totalMonthlyIncome + totalTournamentIncome + totalLeagueIncome + totalGeneralIncome + totalSummerCampIncome;

// Egresos — incluye ambas tablas: expenses + caja_principal_expenses
const expensesFiltered = expenses.filter(e => filterByPeriod(e.expense_date));
const cajaPrincipalFiltered = cajaPrincipalExpenses.filter(e => filterByPeriod(e.expense_date));
const allExpensesFiltered = [...expensesFiltered, ...cajaPrincipalFiltered];
const totalExpenses = allExpensesFiltered.reduce((sum, e) => sum + (e.amount || 0), 0);

// Balance
const balance = totalIncome - totalExpenses;

// Egresos por categoría (ambas tablas)
const expensesByCategory = allExpensesFiltered.reduce((acc, exp) => {
const cat = exp.category || 'otros';
acc[cat] = (acc[cat] || 0) + (exp.amount || 0);
return acc;
}, {});

// Calcular saldos por cuenta (histórico completo, no filtrado por período)
const calculateAccountBalances = () => {
// FIX: only count status === 'pagado' for monthly payments; tournaments always use paid_amount
const scPaid = summerCampPayments.filter(p => p.status === 'pagado');
const allPayments = [
  ...payments.filter(p => p.status === 'pagado'),
  ...tournamentPayments,
  ...leaguePayments,
  ...generalPayments,
  ...scPaid,
];
// FIX: include caja_principal_expenses in account balance calculation
const allExpenses = [...expenses, ...cajaPrincipalExpenses];

const balances = {
efectivo: 0,
tarjeta: 0,
BBVA: 0,
MP: 0,
NU: 0,
OpenBank: 0,
MercadoPagoBIA: 0,
};

// Sumar ingresos (para TournamentPayment usar paid_amount, para el resto amount)
allPayments.forEach(p => {
const ingreso = (p.paid_amount !== undefined && p.paid_amount !== null) ? p.paid_amount : (p.amount || 0);
if (p.payment_method === 'efectivo') {
balances.efectivo += ingreso;
} else if (p.payment_method === 'tarjeta') {
balances.tarjeta += ingreso;
} else if (p.payment_method === 'transferencia' && p.bank_name) {
balances[p.bank_name] = (balances[p.bank_name] || 0) + ingreso;
}
});

// Restar egresos
allExpenses.forEach(e => {
if (e.payment_method === 'efectivo') {
balances.efectivo -= e.amount || 0;
} else if (e.payment_method === 'tarjeta') {
balances.tarjeta -= e.amount || 0;
} else if (e.payment_method === 'transferencia' && e.account) {
balances[e.account] = (balances[e.account] || 0) - (e.amount || 0);
}
});

return balances;
};

const accountBalances = calculateAccountBalances();

const categoryLabels = {
nomina: 'Nómina',
bono_torneo: 'Bono Torneo',
viaticos: 'Viáticos',
hospedaje: 'Hospedaje',
transporte: 'Transporte',
equipamiento: 'Equipamiento',
mantenimiento: 'Mantenimiento',
arbitros: 'Árbitros',
intereses: 'Intereses',
retorno_inversion: 'Retorno de Inversión',
copa: 'Copa',
torneo: 'Torneo',
liga: 'Liga',
otros: 'Otros'
};

return (
<div className="space-y-5">
<ERPPageHeader
icon={BarChart2}
iconColor="text-green-600"
iconBg="bg-green-50"
title="Dashboard Financiero"
subtitle="Resumen de ingresos, egresos y balance del período"
breadcrumb={['BIA', 'Dashboard']}
actions={
<div className="flex items-center gap-2">
<Calendar className="w-4 h-4 text-gray-400" />
<Select value={period} onValueChange={setPeriod}>
<SelectTrigger className="w-36 h-9 text-sm">
<SelectValue />
</SelectTrigger>
<SelectContent>
<SelectItem value="month">Este Mes</SelectItem>
<SelectItem value="year">Este Año</SelectItem>
</SelectContent>
</Select>
</div>
}
/>

{/* KPIs principales */}
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
<KPICard title="Total Ingresos" value={formatCurrency(totalIncome)} icon={TrendingUp} color="green" />
<KPICard title="Total Egresos" value={formatCurrency(totalExpenses)} icon={TrendingDown} color="red" />
<KPICard title="Balance" value={formatCurrency(balance)} icon={DollarSign} color={balance >= 0 ? 'blue' : 'orange'} trendLabel={balance >= 0 ? 'Saldo positivo' : 'Saldo negativo'} />
</div>

{/* Desglose de Ingresos */}
<Card>
<CardHeader>
<CardTitle className="text-green-700">Ingresos por Categoría</CardTitle>
</CardHeader>
<CardContent>
<div className="space-y-4">
{/* Cuotas Mensuales */}
<div className="bg-green-50 rounded-lg border border-green-200">
<button
onClick={() => setExpandedCategory(expandedCategory === 'monthly' ? null : 'monthly')}
className="w-full flex justify-between items-center p-4 hover:bg-green-100 transition-colors"
>
<div className="flex items-center gap-3">
<div>
<p className="font-semibold text-gray-800">Cuotas Mensuales</p>
<p className="text-sm text-gray-600">{monthlyPayments.length} pagos</p>
</div>
</div>
<div className="flex items-center gap-3">
<span className="text-2xl font-bold text-green-600">{formatCurrency(totalMonthlyIncome)}</span>
{expandedCategory === 'monthly' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
</div>
</button>
{expandedCategory === 'monthly' && (
<div className="border-t border-green-200 p-4 space-y-4 max-h-96 overflow-y-auto">
{/* Resumen por método de pago */}
<div className="grid grid-cols-3 gap-3 mb-4">
<div className="p-3 bg-white rounded border border-green-200">
<p className="text-xs text-gray-600">Efectivo</p>
<p className="text-lg font-bold text-green-600">
{formatCurrency(monthlyPayments.filter(p => p.payment_method === 'efectivo').reduce((sum, p) => sum + (p.amount || 0), 0))}
</p>
</div>
<div className="p-3 bg-white rounded border border-green-200">
<p className="text-xs text-gray-600">Tarjeta</p>
<p className="text-lg font-bold text-green-600">
{formatCurrency(monthlyPayments.filter(p => p.payment_method === 'tarjeta').reduce((sum, p) => sum + (p.amount || 0), 0))}
</p>
</div>
<div className="p-3 bg-white rounded border border-green-200">
<p className="text-xs text-gray-600">Transferencia</p>
<p className="text-lg font-bold text-green-600">
{formatCurrency(monthlyPayments.filter(p => p.payment_method === 'transferencia').reduce((sum, p) => sum + (p.amount || 0), 0))}
</p>
</div>
</div>
{/* Lista de pagos */}
<div className="space-y-2">
{monthlyPayments.map((payment) => {
const player = players.find(p => p.id === payment.player_id);
return (
<div key={payment.id} className="flex justify-between items-center p-2 bg-white rounded border border-green-100">
<div className="flex items-center gap-2">
<User className="w-4 h-4 text-gray-500" />
<div>
<p className="text-sm font-medium text-gray-800">{player?.full_name || 'Jugador no encontrado'}</p>
<p className="text-xs text-gray-600">{payment.month} • {payment.payment_method}</p>
<p className="text-xs text-gray-500">{format(new Date(payment.payment_date), "d 'de' MMMM, yyyy", { locale: es })}</p>
</div>
</div>
<span className="text-sm font-bold text-green-600">{formatCurrency(payment.amount)}</span>
</div>
);
})}
</div>
</div>
)}
</div>

{/* Torneos */}
<div className="bg-purple-50 rounded-lg border border-purple-200">
<button
onClick={() => setExpandedCategory(expandedCategory === 'tournament' ? null : 'tournament')}
className="w-full flex justify-between items-center p-4 hover:bg-purple-100 transition-colors"
>
<div className="flex items-center gap-3">
<div>
<p className="font-semibold text-gray-800">Torneos</p>
<p className="text-sm text-gray-600">{tournamentPaymentsFiltered.length} inscripciones</p>
</div>
</div>
<div className="flex items-center gap-3">
<span className="text-2xl font-bold text-purple-600">{formatCurrency(totalTournamentIncome)}</span>
{expandedCategory === 'tournament' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
</div>
</button>
{expandedCategory === 'tournament' && (
<div className="border-t border-purple-200 p-4 space-y-4 max-h-96 overflow-y-auto">
{/* Resumen por método de pago */}
<div className="grid grid-cols-3 gap-3 mb-4">
<div className="p-3 bg-white rounded border border-purple-200">
<p className="text-xs text-gray-600">Efectivo</p>
<p className="text-lg font-bold text-purple-600">
{formatCurrency(tournamentPaymentsFiltered.filter(p => p.payment_method === 'efectivo').reduce((sum, p) => sum + (p.paid_amount ?? p.amount ?? 0), 0))}
</p>
</div>
<div className="p-3 bg-white rounded border border-purple-200">
<p className="text-xs text-gray-600">Tarjeta</p>
<p className="text-lg font-bold text-purple-600">
{formatCurrency(tournamentPaymentsFiltered.filter(p => p.payment_method === 'tarjeta').reduce((sum, p) => sum + (p.paid_amount ?? p.amount ?? 0), 0))}
</p>
</div>
<div className="p-3 bg-white rounded border border-purple-200">
<p className="text-xs text-gray-600">Transferencia</p>
<p className="text-lg font-bold text-purple-600">
{formatCurrency(tournamentPaymentsFiltered.filter(p => p.payment_method === 'transferencia').reduce((sum, p) => sum + (p.paid_amount ?? p.amount ?? 0), 0))}
</p>
</div>
</div>
{/* Lista de pagos */}
<div className="space-y-2">
{tournamentPaymentsFiltered.map((payment) => {
const player = players.find(p => p.id === payment.player_id);
const tournament = tournaments.find(t => t.id === payment.tournament_id);
return (
<div key={payment.id} className="flex justify-between items-center p-2 bg-white rounded border border-purple-100">
<div className="flex items-center gap-2">
<User className="w-4 h-4 text-gray-500" />
<div>
<p className="text-sm font-medium text-gray-800">{player?.full_name || 'Jugador no encontrado'}</p>
<p className="text-xs text-gray-600">{tournament?.name || 'Torneo'} • {payment.payment_method}</p>
<p className="text-xs text-gray-500">{format(new Date(payment.payment_date), "d 'de' MMMM, yyyy", { locale: es })}</p>
</div>
</div>
<span className="text-sm font-bold text-purple-600">{formatCurrency(payment.paid_amount ?? payment.amount)}</span>
</div>
);
})}
</div>
</div>
)}
</div>

{/* Pagos Generales */}
<div className="bg-orange-50 rounded-lg border border-orange-200">
<button
onClick={() => setExpandedCategory(expandedCategory === 'general' ? null : 'general')}
className="w-full flex justify-between items-center p-4 hover:bg-orange-100 transition-colors"
>
<div className="flex items-center gap-3">
<div>
<p className="font-semibold text-gray-800">Pagos Generales</p>
<p className="text-sm text-gray-600">{generalPaymentsFiltered.length} pagos</p>
</div>
</div>
<div className="flex items-center gap-3">
<span className="text-2xl font-bold text-orange-600">{formatCurrency(totalGeneralIncome)}</span>
{expandedCategory === 'general' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
</div>
</button>
{expandedCategory === 'general' && (
<div className="border-t border-orange-200 p-4 space-y-4 max-h-96 overflow-y-auto">
{/* Resumen por método de pago */}
<div className="grid grid-cols-3 gap-3 mb-4">
<div className="p-3 bg-white rounded border border-orange-200">
<p className="text-xs text-gray-600">Efectivo</p>
<p className="text-lg font-bold text-orange-600">
{formatCurrency(generalPaymentsFiltered.filter(p => p.payment_method === 'efectivo').reduce((sum, p) => sum + (p.amount || 0), 0))}
</p>
</div>
<div className="p-3 bg-white rounded border border-orange-200">
<p className="text-xs text-gray-600">Tarjeta</p>
<p className="text-lg font-bold text-orange-600">
{formatCurrency(generalPaymentsFiltered.filter(p => p.payment_method === 'tarjeta').reduce((sum, p) => sum + (p.amount || 0), 0))}
</p>
</div>
<div className="p-3 bg-white rounded border border-orange-200">
<p className="text-xs text-gray-600">Transferencia</p>
<p className="text-lg font-bold text-orange-600">
{formatCurrency(generalPaymentsFiltered.filter(p => p.payment_method === 'transferencia').reduce((sum, p) => sum + (p.amount || 0), 0))}
</p>
</div>
</div>
{/* Lista de pagos */}
<div className="space-y-2">
{generalPaymentsFiltered.map((payment) => (
<div key={payment.id} className="flex justify-between items-center p-2 bg-white rounded border border-orange-100">
<div className="flex items-center gap-2">
<DollarSign className="w-4 h-4 text-gray-500" />
<div>
<p className="text-sm font-medium text-gray-800">{payment.concept}</p>
<p className="text-xs text-gray-600">{payment.payment_method}</p>
<p className="text-xs text-gray-500">{format(new Date(payment.payment_date), "d 'de' MMMM, yyyy", { locale: es })}</p>
</div>
</div>
<span className="text-sm font-bold text-orange-600">{formatCurrency(payment.amount)}</span>
</div>
))}
</div>
</div>
)}
</div>

{/* Summer Camp */}
<div className="bg-yellow-50 rounded-lg border border-yellow-200">
<button
onClick={() => setExpandedCategory(expandedCategory === 'summercamp' ? null : 'summercamp')}
className="w-full flex justify-between items-center p-4 hover:bg-yellow-100 transition-colors"
>
<div>
<p className="font-semibold text-gray-800">Summer Camp</p>
<p className="text-sm text-gray-600">{summerCampFiltered.length} pagos registrados</p>
</div>
<div className="flex items-center gap-3">
<span className="text-2xl font-bold text-yellow-600">{formatCurrency(totalSummerCampIncome)}</span>
{expandedCategory === 'summercamp' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
</div>
</button>
{expandedCategory === 'summercamp' && (
<div className="border-t border-yellow-200 p-4 space-y-4 max-h-96 overflow-y-auto">
<div className="grid grid-cols-3 gap-3 mb-4">
{['efectivo','tarjeta','transferencia'].map(m => (
<div key={m} className="p-3 bg-white rounded border border-yellow-200">
<p className="text-xs text-gray-600 capitalize">{m}</p>
<p className="text-lg font-bold text-yellow-600">
{formatCurrency(summerCampFiltered.filter(p => p.payment_method === m).reduce((s, p) => s + (p.amount || 0), 0))}
</p>
</div>
))}
</div>
<div className="space-y-2">
{summerCampFiltered.map(p => (
<div key={p.id} className="flex justify-between items-center p-2 bg-white rounded border border-yellow-100">
<div className="flex items-center gap-2">
<User className="w-4 h-4 text-gray-500" />
<div>
<p className="text-sm font-medium text-gray-800">{p.player_name || '—'}</p>
<p className="text-xs text-gray-600">
{p.payment_type === 'semana' ? `Semana ${p.week_number}` : 'Uniformes'} • {p.payment_method}
</p>
<p className="text-xs text-gray-500">{format(new Date(p.payment_date), "d 'de' MMMM, yyyy", { locale: es })}</p>
</div>
</div>
<span className="text-sm font-bold text-yellow-600">{formatCurrency(p.amount)}</span>
</div>
))}
</div>
</div>
)}
</div>

{/* Liga Fut 7 */}
<div className="bg-blue-50 rounded-lg border border-blue-200">
<button
onClick={() => setExpandedCategory(expandedCategory === 'league' ? null : 'league')}
className="w-full flex justify-between items-center p-4 hover:bg-blue-100 transition-colors"
>
<div className="flex items-center gap-3">
<div>
<p className="font-semibold text-gray-800">Liga Fut 7</p>
<p className="text-sm text-gray-600">
{leagueRegistrations.length} inscripciones + {leagueReferees.length} arbitrajes
</p>
</div>
</div>
<div className="flex items-center gap-3">
<span className="text-2xl font-bold text-blue-600">{formatCurrency(totalLeagueIncome)}</span>
{expandedCategory === 'league' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
</div>
</button>
{expandedCategory === 'league' && (
<div className="border-t border-blue-200 p-4 space-y-4 max-h-96 overflow-y-auto">
{/* Resumen por método de pago */}
<div className="grid grid-cols-3 gap-3 mb-4">
<div className="p-3 bg-white rounded border border-blue-200">
<p className="text-xs text-gray-600">Efectivo</p>
<p className="text-lg font-bold text-blue-600">
{formatCurrency(leaguePaymentsFiltered.filter(p => p.payment_method === 'efectivo').reduce((sum, p) => sum + (p.amount || 0), 0))}
</p>
</div>
<div className="p-3 bg-white rounded border border-blue-200">
<p className="text-xs text-gray-600">Tarjeta</p>
<p className="text-lg font-bold text-blue-600">
{formatCurrency(leaguePaymentsFiltered.filter(p => p.payment_method === 'tarjeta').reduce((sum, p) => sum + (p.amount || 0), 0))}
</p>
</div>
<div className="p-3 bg-white rounded border border-blue-200">
<p className="text-xs text-gray-600">Transferencia</p>
<p className="text-lg font-bold text-blue-600">
{formatCurrency(leaguePaymentsFiltered.filter(p => p.payment_method === 'transferencia').reduce((sum, p) => sum + (p.amount || 0), 0))}
</p>
</div>
</div>
{/* Lista de pagos */}
<div className="space-y-2">
{leaguePaymentsFiltered.map((payment) => {
const team = teams.find(t => t.id === payment.team_id);
return (
<div key={payment.id} className="flex justify-between items-center p-2 bg-white rounded border border-blue-100">
<div className="flex items-center gap-2">
<User className="w-4 h-4 text-gray-500" />
<div>
<p className="text-sm font-medium text-gray-800">{team?.name || 'Equipo no encontrado'}</p>
<p className="text-xs text-gray-600">
{payment.payment_type === 'inscripcion' ? 'Inscripción' : 'Arbitraje'}
{payment.week_number && ` - Semana ${payment.week_number}`} • {payment.payment_method}
</p>
<p className="text-xs text-gray-500">{format(new Date(payment.payment_date), "d 'de' MMMM, yyyy", { locale: es })}</p>
</div>
</div>
<span className="text-sm font-bold text-blue-600">{formatCurrency(payment.amount)}</span>
</div>
);
})}
</div>
</div>
)}
</div>
</div>
</CardContent>
</Card>

{/* Desglose de Egresos */}
<Card>
<CardHeader>
<CardTitle className="text-red-700">Egresos por Categoría</CardTitle>
</CardHeader>
<CardContent>
{Object.keys(expensesByCategory).length === 0 ? (
<p className="text-center py-8 text-gray-500">No hay egresos registrados en este período</p>
) : (
<div className="space-y-3">
{Object.entries(expensesByCategory).map(([category, amount]) => (
<div key={category} className="bg-red-50 rounded-lg border border-red-200">
<button
onClick={() => setExpandedCategory(expandedCategory === `expense_${category}` ? null : `expense_${category}`)}
className="w-full flex justify-between items-center p-4 hover:bg-red-100 transition-colors"
>
<span className="font-semibold text-gray-800">{categoryLabels[category] || category}</span>
<div className="flex items-center gap-3">
<span className="text-xl font-bold text-red-600">{formatCurrency(amount)}</span>
{expandedCategory === `expense_${category}` ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
</div>
</button>
{expandedCategory === `expense_${category}` && (
<div className="border-t border-red-200 p-4 space-y-4 max-h-96 overflow-y-auto">
{/* Resumen por método de pago */}
<div className="grid grid-cols-3 gap-3 mb-4">
<div className="p-3 bg-white rounded border border-red-200">
<p className="text-xs text-gray-600">Efectivo</p>
<p className="text-lg font-bold text-red-600">
{formatCurrency(allExpensesFiltered.filter(e => e.category === category && e.payment_method === 'efectivo').reduce((sum, e) => sum + (e.amount || 0), 0))}
</p>
</div>
<div className="p-3 bg-white rounded border border-red-200">
<p className="text-xs text-gray-600">Tarjeta</p>
<p className="text-lg font-bold text-red-600">
{formatCurrency(allExpensesFiltered.filter(e => e.category === category && e.payment_method === 'tarjeta').reduce((sum, e) => sum + (e.amount || 0), 0))}
</p>
</div>
<div className="p-3 bg-white rounded border border-red-200">
<p className="text-xs text-gray-600">Transferencia</p>
<p className="text-lg font-bold text-red-600">
{formatCurrency(allExpensesFiltered.filter(e => e.category === category && e.payment_method === 'transferencia').reduce((sum, e) => sum + (e.amount || 0), 0))}
</p>
</div>
</div>
{/* Lista de gastos */}
<div className="space-y-2">
{allExpensesFiltered.filter(e => e.category === category).map((expense) => (
<div key={expense.id} className="flex justify-between items-center p-2 bg-white rounded border border-red-100">
<div className="flex items-center gap-2">
<div>
<p className="text-sm font-medium text-gray-800">{expense.concept}</p>
<p className="text-xs text-gray-600">{expense.payment_method}{expense.account && ` - ${expense.account}`}</p>
<p className="text-xs text-gray-500">{format(new Date(expense.expense_date), "d 'de' MMMM, yyyy", { locale: es })}</p>
</div>
</div>
<span className="text-sm font-bold text-red-600">{formatCurrency(expense.amount)}</span>
</div>
))}
</div>
</div>
)}
</div>
))}
</div>
)}
</CardContent>
</Card>

{/* Saldos por Cuenta */}
<Card>
<CardHeader>
<CardTitle className="text-blue-700">Saldos por Cuenta</CardTitle>
</CardHeader>
<CardContent>
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
<div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
<p className="text-sm text-gray-600 mb-1">Efectivo</p>
<p className={`text-2xl font-bold ${accountBalances.efectivo >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
{formatCurrency(accountBalances.efectivo)}
</p>
</div>
<div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
<p className="text-sm text-gray-600 mb-1">Tarjeta</p>
<p className={`text-2xl font-bold ${accountBalances.tarjeta >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
{formatCurrency(accountBalances.tarjeta)}
</p>
</div>
<div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
<p className="text-sm text-gray-600 mb-1">BBVA</p>
<p className={`text-2xl font-bold ${accountBalances.BBVA >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
{formatCurrency(accountBalances.BBVA)}
</p>
</div>
<div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
<p className="text-sm text-gray-600 mb-1">MP</p>
<p className={`text-2xl font-bold ${accountBalances.MP >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
{formatCurrency(accountBalances.MP)}
</p>
</div>
<div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
<p className="text-sm text-gray-600 mb-1">NU</p>
<p className={`text-2xl font-bold ${accountBalances.NU >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
{formatCurrency(accountBalances.NU)}
</p>
</div>
<div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
<p className="text-sm text-gray-600 mb-1">OpenBank</p>
<p className={`text-2xl font-bold ${accountBalances.OpenBank >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
{formatCurrency(accountBalances.OpenBank)}
</p>
</div>
<div className="p-4 bg-teal-50 rounded-lg border border-teal-200">
<p className="text-sm text-gray-600 mb-1">Mercado Pago BIA</p>
<p className={`text-2xl font-bold ${accountBalances.MercadoPagoBIA >= 0 ? 'text-teal-600' : 'text-red-600'}`}>
{formatCurrency(accountBalances.MercadoPagoBIA)}
</p>
</div>
</div>
</CardContent>
</Card>
</div>
);
}
