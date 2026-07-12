import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, CreditCard, AlertCircle, Trophy, TrendingUp, DollarSign, ChevronDown, ChevronUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import FinancialSummary from '../components/FinancialSummary';
import { formatCurrency } from '../components/lib/formatCurrency';
import { Badge } from '@/components/ui/badge';
import KPICard from '../components/layout/KPICard';

export default function Home() {
const [expandedBanks, setExpandedBanks] = useState({});
const { data: players = [] } = useQuery({
queryKey: ['players'],
queryFn: () => base44.entities.Player.list(),
});

const { data: payments = [] } = useQuery({
queryKey: ['payments'],
queryFn: () => base44.entities.Payment.list(),
});

const { data: generalPayments = [] } = useQuery({
queryKey: ['generalPayments'],
queryFn: () => base44.entities.GeneralPayment.list(),
});

const { data: tournaments = [] } = useQuery({
queryKey: ['tournaments'],
queryFn: () => base44.entities.Tournament.list(),
});

const { data: tournamentPayments = [] } = useQuery({
queryKey: ['tournamentPayments'],
queryFn: () => base44.entities.TournamentPayment.list(),
});

// FIX: added leaguePayments query (was missing from Panel)
const { data: leaguePayments = [] } = useQuery({
queryKey: ['leaguePayments'],
queryFn: () => base44.entities.LeaguePayment.list(),
});

// FIX: added summerCampPayments query (was missing from Panel)
const { data: summerCampPayments = [] } = useQuery({
queryKey: ['summerCampPayments'],
queryFn: () => base44.entities.SummerCampPayment.list(),
});

const activePlayers = players.filter(p => p.status === 'activo');

const currentMonth = format(new Date(), 'MMMM yyyy', { locale: es });

// Filtrar pagos del mes actual por fecha de pago
const monthStart = startOfMonth(new Date());
const monthEnd = endOfMonth(new Date());

const parsePaymentDate = (dateStr) => {
if (!dateStr) return null;
// Si ya es un objeto Date
if (dateStr instanceof Date) return dateStr;
const str = String(dateStr);
// Toma solo la parte de fecha para evitar problemas de zona horaria
const datePart = str.includes('T') ? str.split('T')[0] : str.split(' ')[0];
const parts = datePart.split('-').map(Number);
if (parts.length < 3 || parts.some(isNaN)) return null;
return new Date(parts[0], parts[1] - 1, parts[2]);
};

// FIX: helper to get the effective amount (tournaments use paid_amount)
const getPaymentAmount = (p) =>
  (p.paid_amount !== undefined && p.paid_amount !== null) ? p.paid_amount : (p.amount || 0);

// FIX: added p.status === 'pagado' filter — previously included pending payments
const paymentsThisMonth = payments.filter(p => {
const paymentDate = parsePaymentDate(p.payment_date);
if (!paymentDate) return false;
return paymentDate >= monthStart && paymentDate <= monthEnd && p.status === 'pagado';
});

const generalPaymentsThisMonth = generalPayments.filter(p => {
const paymentDate = parsePaymentDate(p.payment_date);
if (!paymentDate) return false;
return paymentDate >= monthStart && paymentDate <= monthEnd;
});

const playersWithPaymentThisMonth = new Set(paymentsThisMonth.map(p => p.player_id));
const playersWithoutPayment = activePlayers.filter(p => !playersWithPaymentThisMonth.has(p.id));

const totalCollected = paymentsThisMonth.reduce((sum, p) => sum + (p.amount || 0), 0);
const expectedTotal = activePlayers.reduce((sum, p) => sum + (p.monthly_fee || 0), 0);

// Ingresos por método de pago (incluye todos los tipos de ingreso del mes)
const monthTournamentPayments = tournamentPayments.filter(p => {
const paymentDate = parsePaymentDate(p.payment_date);
if (!paymentDate) return false;
// FIX: tournament payments use status 'pagado' or 'abono' with a payment date
return paymentDate >= monthStart && paymentDate <= monthEnd &&
  p.payment_date && ['pagado', 'abono'].includes(p.status);
});

// FIX: added league payments for current month
const monthLeaguePayments = leaguePayments.filter(p => {
const paymentDate = parsePaymentDate(p.payment_date);
if (!paymentDate) return false;
return paymentDate >= monthStart && paymentDate <= monthEnd;
});

// FIX: added summer camp payments for current month (status === 'pagado')
const monthSummerCampPayments = summerCampPayments.filter(p => {
const paymentDate = parsePaymentDate(p.payment_date);
if (!paymentDate) return false;
return paymentDate >= monthStart && paymentDate <= monthEnd && p.status === 'pagado';
});

// FIX: allPaymentsThisMonth now includes league and summerCamp
const allPaymentsThisMonth = [
  ...paymentsThisMonth,
  ...generalPaymentsThisMonth,
  ...monthTournamentPayments,
  ...monthLeaguePayments,
  ...monthSummerCampPayments,
];

const cashPayments = allPaymentsThisMonth.filter(p => p.payment_method === 'efectivo');
const cardPayments = allPaymentsThisMonth.filter(p => p.payment_method === 'tarjeta');
const transferPayments = allPaymentsThisMonth.filter(p => p.payment_method === 'transferencia');

// FIX: use getPaymentAmount to correctly handle paid_amount for tournaments
const totalCash = cashPayments.reduce((sum, p) => sum + getPaymentAmount(p), 0);
const totalCard = cardPayments.reduce((sum, p) => sum + getPaymentAmount(p), 0);
const totalTransfer = transferPayments.reduce((sum, p) => sum + getPaymentAmount(p), 0);

// Desglose por tipo de pago
const cashPlayerPayments = paymentsThisMonth.filter(p => p.payment_method === 'efectivo').reduce((sum, p) => sum + (p.amount || 0), 0);
const cashGeneralPayments = generalPaymentsThisMonth.filter(p => p.payment_method === 'efectivo').reduce((sum, p) => sum + (p.amount || 0), 0);
// FIX: use paid_amount for tournament amounts
const cashTournamentPayments = monthTournamentPayments.filter(p => p.payment_method === 'efectivo').reduce((sum, p) => sum + getPaymentAmount(p), 0);
const cashLeaguePayments = monthLeaguePayments.filter(p => p.payment_method === 'efectivo').reduce((sum, p) => sum + (p.amount || 0), 0);
const cashSummerCampPayments = monthSummerCampPayments.filter(p => p.payment_method === 'efectivo').reduce((sum, p) => sum + (p.amount || 0), 0);

const cardPlayerPayments = paymentsThisMonth.filter(p => p.payment_method === 'tarjeta').reduce((sum, p) => sum + (p.amount || 0), 0);
const cardGeneralPayments = generalPaymentsThisMonth.filter(p => p.payment_method === 'tarjeta').reduce((sum, p) => sum + (p.amount || 0), 0);
// FIX: use paid_amount for tournament amounts
const cardTournamentPayments = monthTournamentPayments.filter(p => p.payment_method === 'tarjeta').reduce((sum, p) => sum + getPaymentAmount(p), 0);
const cardLeaguePayments = monthLeaguePayments.filter(p => p.payment_method === 'tarjeta').reduce((sum, p) => sum + (p.amount || 0), 0);
const cardSummerCampPayments = monthSummerCampPayments.filter(p => p.payment_method === 'tarjeta').reduce((sum, p) => sum + (p.amount || 0), 0);

const transferPlayerPayments = paymentsThisMonth.filter(p => p.payment_method === 'transferencia').reduce((sum, p) => sum + (p.amount || 0), 0);
const transferGeneralPayments = generalPaymentsThisMonth.filter(p => p.payment_method === 'transferencia').reduce((sum, p) => sum + (p.amount || 0), 0);
// FIX: use paid_amount for tournament amounts
const transferTournamentPayments = monthTournamentPayments.filter(p => p.payment_method === 'transferencia').reduce((sum, p) => sum + getPaymentAmount(p), 0);
const transferLeaguePayments = monthLeaguePayments.filter(p => p.payment_method === 'transferencia').reduce((sum, p) => sum + (p.amount || 0), 0);
const transferSummerCampPayments = monthSummerCampPayments.filter(p => p.payment_method === 'transferencia').reduce((sum, p) => sum + (p.amount || 0), 0);

// Ingresos por banco (transferencias)
const bbvaPayments = transferPayments.filter(p => p.bank_name === 'BBVA');
const mpPayments = transferPayments.filter(p => p.bank_name === 'MP');
const nuPayments = transferPayments.filter(p => p.bank_name === 'NU');
const openBankPayments = transferPayments.filter(p => p.bank_name === 'OpenBank');
const mercadoPagoBIAPayments = transferPayments.filter(p => p.bank_name === 'MercadoPagoBIA');

const totalBBVA = bbvaPayments.reduce((sum, p) => sum + getPaymentAmount(p), 0);
const totalMP = mpPayments.reduce((sum, p) => sum + getPaymentAmount(p), 0);
const totalNU = nuPayments.reduce((sum, p) => sum + getPaymentAmount(p), 0);
const totalOpenBank = openBankPayments.reduce((sum, p) => sum + getPaymentAmount(p), 0);
const totalMercadoPagoBIA = mercadoPagoBIAPayments.reduce((sum, p) => sum + getPaymentAmount(p), 0);

// Desglose por banco y tipo de pago
const getBankBreakdown = (bankName) => {
const playerPayments = paymentsThisMonth.filter(p => p.payment_method === 'transferencia' && p.bank_name === bankName);
const generalPaymentsBank = generalPaymentsThisMonth.filter(p => p.payment_method === 'transferencia' && p.bank_name === bankName);
const tournamentPaymentsBank = monthTournamentPayments.filter(p => p.payment_method === 'transferencia' && p.bank_name === bankName);
const leaguePaymentsBank = monthLeaguePayments.filter(p => p.payment_method === 'transferencia' && p.bank_name === bankName);
const summerCampPaymentsBank = monthSummerCampPayments.filter(p => p.payment_method === 'transferencia' && p.bank_name === bankName);

return {
playerPayments,
generalPayments: generalPaymentsBank,
tournamentPayments: tournamentPaymentsBank,
leaguePayments: leaguePaymentsBank,
summerCampPayments: summerCampPaymentsBank,
totalPlayer: playerPayments.reduce((sum, p) => sum + (p.amount || 0), 0),
totalGeneral: generalPaymentsBank.reduce((sum, p) => sum + (p.amount || 0), 0),
// FIX: use paid_amount for tournament amounts
totalTournament: tournamentPaymentsBank.reduce((sum, p) => sum + getPaymentAmount(p), 0),
totalLeague: leaguePaymentsBank.reduce((sum, p) => sum + (p.amount || 0), 0),
totalSummerCamp: summerCampPaymentsBank.reduce((sum, p) => sum + (p.amount || 0), 0),
};
};

const getPlayerName = (playerId) => {
const player = players.find(p => p.id === playerId);
return player?.full_name || 'Desconocido';
};

const toggleBank = (bankName) => {
setExpandedBanks(prev => ({ ...prev, [bankName]: !prev[bankName] }));
};

const formatSafeDate = (dateString) => {
if (!dateString) return '';
try {
const date = new Date(dateString + 'T00:00:00');
if (isNaN(date.getTime())) return '';
return format(date, 'dd/MM/yyyy');
} catch {
return '';
}
};

const upcomingTournaments = tournaments.filter(t => t.status === 'proximo').length;

const stats = [
{
title: 'Jugadores Activos',
value: activePlayers.length,
icon: Users,
color: 'bg-blue-500',
link: 'Players',
},
{
title: 'Pagos Este Mes',
value: paymentsThisMonth.length,
icon: CreditCard,
color: 'bg-green-500',
subtitle: `${playersWithPaymentThisMonth.size} de ${activePlayers.length} jugadores`,
link: 'Payments',
},
{
title: 'Padres Morosos',
value: playersWithoutPayment.length,
icon: AlertCircle,
color: 'bg-red-500',
subtitle: `${playersWithoutPayment.length} sin pagar este mes`,
link: 'Payments',
},
{
title: 'Torneos Próximos',
value: upcomingTournaments,
icon: Trophy,
color: 'bg-purple-500',
link: 'Tournaments',
},
];

return (
<div className="space-y-6">
{/* Hero Banner ERP */}
<div className="bg-gradient-to-r from-[#1a1a2e] via-[#a50044] to-[#004d98] rounded-xl p-6 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
<div>
<p className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">Panel de Control</p>
<h1 className="text-2xl md:text-3xl font-bold">Barcelona Inter Academy</h1>
<p className="text-white/70 text-sm mt-1">
{format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es }).charAt(0).toUpperCase() + format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es }).slice(1)}
</p>
</div>
<div className="flex gap-3 flex-wrap">
<div className="bg-white/10 backdrop-blur rounded-lg px-4 py-2 text-center">
<p className="text-xs text-white/60">Mes Actual</p>
<p className="text-lg font-bold">{currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1)}</p>
</div>
<div className="bg-white/10 backdrop-blur rounded-lg px-4 py-2 text-center">
<p className="text-xs text-white/60">Recaudado</p>
<p className="text-lg font-bold">{formatCurrency(totalCollected)}</p>
</div>
</div>
</div>

{/* KPIs */}
<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
{stats.map((stat) => {
const Icon = stat.icon;
const colorMap = {
'bg-blue-500': 'blue', 'bg-green-500': 'green',
'bg-red-500': 'red', 'bg-purple-500': 'purple',
};
return (
<Link key={stat.title} to={createPageUrl(stat.link)}>
<KPICard
title={stat.title}
value={stat.value}
icon={Icon}
color={colorMap[stat.color] || 'blue'}
trendLabel={stat.subtitle}
className="cursor-pointer hover:scale-[1.02] transition-transform"
/>
</Link>
);
})}
</div>

{/* Financial Summary */}
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
<Card className="shadow-lg border-2">
<CardHeader>
<CardTitle className="flex items-center gap-2">
<DollarSign className="w-5 h-5 text-green-600" />
Resumen Financiero - {currentMonth}
</CardTitle>
</CardHeader>
<CardContent className="space-y-4">
<div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
<span className="text-gray-700 font-medium">Total Recaudado</span>
<span className="text-2xl font-bold text-green-600">{formatCurrency(totalCollected)}</span>
</div>
<div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
<span className="text-gray-700 font-medium">Total Esperado</span>
<span className="text-2xl font-bold text-blue-600">{formatCurrency(expectedTotal)}</span>
</div>
<div className="flex justify-between items-center p-4 bg-orange-50 rounded-lg">
<span className="text-gray-700 font-medium">Pendiente</span>
<span className="text-2xl font-bold text-orange-600">{formatCurrency(expectedTotal - totalCollected)}</span>
</div>
</CardContent>
</Card>

<Card className="shadow-lg border-2">
<CardHeader>
<CardTitle className="flex items-center gap-2">
<CreditCard className="w-5 h-5 text-blue-600" />
Ingresos por Método de Pago
</CardTitle>
</CardHeader>
<CardContent>
<Tabs defaultValue="total" className="space-y-3">
<TabsList className="grid w-full grid-cols-4">
<TabsTrigger value="total">Total</TabsTrigger>
<TabsTrigger value="efectivo">Efectivo</TabsTrigger>
<TabsTrigger value="tarjeta">Tarjeta</TabsTrigger>
<TabsTrigger value="transferencia">Transfer.</TabsTrigger>
</TabsList>

<TabsContent value="total" className="space-y-3">
<div className="space-y-2">
<div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg border border-emerald-200">
<div>
<p className="text-gray-700 font-medium">Efectivo</p>
<p className="text-xs text-gray-500">{cashPayments.length} pagos</p>
</div>
<span className="text-xl font-bold text-emerald-600">{formatCurrency(totalCash)}</span>
</div>
<div className="pl-4 space-y-1">
<div className="flex justify-between items-center p-2 bg-emerald-50/50 rounded border border-emerald-100">
<span className="text-xs text-gray-600">Pagos de Jugadores ({paymentsThisMonth.filter(p => p.payment_method === 'efectivo').length})</span>
<span className="text-sm font-semibold text-emerald-600">{formatCurrency(cashPlayerPayments)}</span>
</div>
<div className="flex justify-between items-center p-2 bg-emerald-50/50 rounded border border-emerald-100">
<span className="text-xs text-gray-600">Pagos Generales ({generalPaymentsThisMonth.filter(p => p.payment_method === 'efectivo').length})</span>
<span className="text-sm font-semibold text-emerald-600">{formatCurrency(cashGeneralPayments)}</span>
</div>
<div className="flex justify-between items-center p-2 bg-emerald-50/50 rounded border border-emerald-100">
<span className="text-xs text-gray-600">Pagos de Torneos ({monthTournamentPayments.filter(p => p.payment_method === 'efectivo').length})</span>
<span className="text-sm font-semibold text-emerald-600">{formatCurrency(cashTournamentPayments)}</span>
</div>
<div className="flex justify-between items-center p-2 bg-emerald-50/50 rounded border border-emerald-100">
<span className="text-xs text-gray-600">Liga Fut 7 ({monthLeaguePayments.filter(p => p.payment_method === 'efectivo').length})</span>
<span className="text-sm font-semibold text-emerald-600">{formatCurrency(cashLeaguePayments)}</span>
</div>
<div className="flex justify-between items-center p-2 bg-emerald-50/50 rounded border border-emerald-100">
<span className="text-xs text-gray-600">Summer Camp ({monthSummerCampPayments.filter(p => p.payment_method === 'efectivo').length})</span>
<span className="text-sm font-semibold text-emerald-600">{formatCurrency(cashSummerCampPayments)}</span>
</div>
</div>
</div>

<div className="space-y-2">
<div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-200">
<div>
<p className="text-gray-700 font-medium">Tarjeta</p>
<p className="text-xs text-gray-500">{cardPayments.length} pagos</p>
</div>
<span className="text-xl font-bold text-blue-600">{formatCurrency(totalCard)}</span>
</div>
<div className="pl-4 space-y-1">
<div className="flex justify-between items-center p-2 bg-blue-50/50 rounded border border-blue-100">
<span className="text-xs text-gray-600">Pagos de Jugadores ({paymentsThisMonth.filter(p => p.payment_method === 'tarjeta').length})</span>
<span className="text-sm font-semibold text-blue-600">{formatCurrency(cardPlayerPayments)}</span>
</div>
<div className="flex justify-between items-center p-2 bg-blue-50/50 rounded border border-blue-100">
<span className="text-xs text-gray-600">Pagos Generales ({generalPaymentsThisMonth.filter(p => p.payment_method === 'tarjeta').length})</span>
<span className="text-sm font-semibold text-blue-600">{formatCurrency(cardGeneralPayments)}</span>
</div>
<div className="flex justify-between items-center p-2 bg-blue-50/50 rounded border border-blue-100">
<span className="text-xs text-gray-600">Pagos de Torneos ({monthTournamentPayments.filter(p => p.payment_method === 'tarjeta').length})</span>
<span className="text-sm font-semibold text-blue-600">{formatCurrency(cardTournamentPayments)}</span>
</div>
<div className="flex justify-between items-center p-2 bg-blue-50/50 rounded border border-blue-100">
<span className="text-xs text-gray-600">Liga Fut 7 ({monthLeaguePayments.filter(p => p.payment_method === 'tarjeta').length})</span>
<span className="text-sm font-semibold text-blue-600">{formatCurrency(cardLeaguePayments)}</span>
</div>
<div className="flex justify-between items-center p-2 bg-blue-50/50 rounded border border-blue-100">
<span className="text-xs text-gray-600">Summer Camp ({monthSummerCampPayments.filter(p => p.payment_method === 'tarjeta').length})</span>
<span className="text-sm font-semibold text-blue-600">{formatCurrency(cardSummerCampPayments)}</span>
</div>
</div>
</div>

<div className="space-y-2">
<div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg border border-purple-200">
<div>
<p className="text-gray-700 font-bold">Transferencia</p>
<p className="text-xs text-gray-500">{transferPayments.length} pagos</p>
</div>
<span className="text-xl font-bold text-purple-600">{formatCurrency(totalTransfer)}</span>
</div>
<div className="pl-4 space-y-1">
<div className="flex justify-between items-center p-2 bg-purple-50/50 rounded border border-purple-100">
<span className="text-xs text-gray-600">Pagos de Jugadores ({paymentsThisMonth.filter(p => p.payment_method === 'transferencia').length})</span>
<span className="text-sm font-semibold text-purple-600">{formatCurrency(transferPlayerPayments)}</span>
</div>
<div className="flex justify-between items-center p-2 bg-purple-50/50 rounded border border-purple-100">
<span className="text-xs text-gray-600">Pagos Generales ({generalPaymentsThisMonth.filter(p => p.payment_method === 'transferencia').length})</span>
<span className="text-sm font-semibold text-purple-600">{formatCurrency(transferGeneralPayments)}</span>
</div>
<div className="pl-2 pt-1 space-y-1">
<p className="text-xs font-semibold text-gray-600">Por Banco:</p>
<div className="flex justify-between items-center p-1.5 bg-purple-50/30 rounded border border-purple-100">
<span className="text-xs text-gray-600">BBVA ({bbvaPayments.length})</span>
<span className="text-xs font-semibold text-purple-600">{formatCurrency(totalBBVA)}</span>
</div>
<div className="flex justify-between items-center p-1.5 bg-purple-50/30 rounded border border-purple-100">
<span className="text-xs text-gray-600">MP ({mpPayments.length})</span>
<span className="text-xs font-semibold text-purple-600">{formatCurrency(totalMP)}</span>
</div>
<div className="flex justify-between items-center p-1.5 bg-purple-50/30 rounded border border-purple-100">
<span className="text-xs text-gray-600">NU ({nuPayments.length})</span>
<span className="text-xs font-semibold text-purple-600">{formatCurrency(totalNU)}</span>
</div>
<div className="flex justify-between items-center p-1.5 bg-purple-50/30 rounded border border-purple-100">
<span className="text-xs text-gray-600">OpenBank ({openBankPayments.length})</span>
<span className="text-xs font-semibold text-purple-600">{formatCurrency(totalOpenBank)}</span>
</div>
<div className="flex justify-between items-center p-1.5 bg-purple-50/30 rounded border border-purple-100">
<span className="text-xs text-gray-600">Mercado Pago BIA ({mercadoPagoBIAPayments.length})</span>
<span className="text-xs font-semibold text-purple-600">{formatCurrency(totalMercadoPagoBIA)}</span>
</div>
</div>
</div>
</div>
</TabsContent>

<TabsContent value="efectivo" className="space-y-2">
<div className="flex justify-between items-center p-3 bg-emerald-50 rounded border border-emerald-200">
<span className="text-sm text-gray-700">Pagos de Jugadores</span>
<span className="text-sm font-semibold text-emerald-600">{formatCurrency(cashPlayerPayments)}</span>
</div>
<div className="flex justify-between items-center p-3 bg-emerald-50 rounded border border-emerald-200">
<span className="text-sm text-gray-700">Pagos Generales</span>
<span className="text-sm font-semibold text-emerald-600">{formatCurrency(cashGeneralPayments)}</span>
</div>
<div className="flex justify-between items-center p-3 bg-emerald-50 rounded border border-emerald-200">
<span className="text-sm text-gray-700">Torneos</span>
<span className="text-sm font-semibold text-emerald-600">{formatCurrency(cashTournamentPayments)}</span>
</div>
<div className="flex justify-between items-center p-3 bg-emerald-50 rounded border border-emerald-200">
<span className="text-sm text-gray-700">Liga Fut 7</span>
<span className="text-sm font-semibold text-emerald-600">{formatCurrency(cashLeaguePayments)}</span>
</div>
<div className="flex justify-between items-center p-3 bg-emerald-50 rounded border border-emerald-200">
<span className="text-sm text-gray-700">Summer Camp</span>
<span className="text-sm font-semibold text-emerald-600">{formatCurrency(cashSummerCampPayments)}</span>
</div>
{/* FIX: was totalCash + cashTournamentPayments (double-counting). Now just totalCash which already includes all sources */}
<div className="flex justify-between items-center p-3 bg-emerald-100 rounded border-2 border-emerald-300">
<span className="font-bold text-gray-900">Total Efectivo</span>
<span className="text-lg font-bold text-emerald-600">{formatCurrency(totalCash)}</span>
</div>
</TabsContent>

<TabsContent value="tarjeta" className="space-y-2">
<div className="flex justify-between items-center p-3 bg-blue-50 rounded border border-blue-200">
<span className="text-sm text-gray-700">Pagos de Jugadores</span>
<span className="text-sm font-semibold text-blue-600">{formatCurrency(cardPlayerPayments)}</span>
</div>
<div className="flex justify-between items-center p-3 bg-blue-50 rounded border border-blue-200">
<span className="text-sm text-gray-700">Pagos Generales</span>
<span className="text-sm font-semibold text-blue-600">{formatCurrency(cardGeneralPayments)}</span>
</div>
<div className="flex justify-between items-center p-3 bg-blue-50 rounded border border-blue-200">
<span className="text-sm text-gray-700">Torneos</span>
<span className="text-sm font-semibold text-blue-600">{formatCurrency(cardTournamentPayments)}</span>
</div>
<div className="flex justify-between items-center p-3 bg-blue-50 rounded border border-blue-200">
<span className="text-sm text-gray-700">Liga Fut 7</span>
<span className="text-sm font-semibold text-blue-600">{formatCurrency(cardLeaguePayments)}</span>
</div>
<div className="flex justify-between items-center p-3 bg-blue-50 rounded border border-blue-200">
<span className="text-sm text-gray-700">Summer Camp</span>
<span className="text-sm font-semibold text-blue-600">{formatCurrency(cardSummerCampPayments)}</span>
</div>
{/* FIX: was totalCard + cardTournamentPayments (double-counting). Now just totalCard */}
<div className="flex justify-between items-center p-3 bg-blue-100 rounded border-2 border-blue-300">
<span className="font-bold text-gray-900">Total Tarjeta</span>
<span className="text-lg font-bold text-blue-600">{formatCurrency(totalCard)}</span>
</div>
</TabsContent>

<TabsContent value="transferencia" className="space-y-2">
<div className="flex justify-between items-center p-3 bg-purple-50 rounded border border-purple-200">
<span className="text-sm text-gray-700">Pagos de Jugadores</span>
<span className="text-sm font-semibold text-purple-600">{formatCurrency(transferPlayerPayments)}</span>
</div>
<div className="flex justify-between items-center p-3 bg-purple-50 rounded border border-purple-200">
<span className="text-sm text-gray-700">Pagos Generales</span>
<span className="text-sm font-semibold text-purple-600">{formatCurrency(transferGeneralPayments)}</span>
</div>
<div className="flex justify-between items-center p-3 bg-purple-50 rounded border border-purple-200">
<span className="text-sm text-gray-700">Pagos de Torneos</span>
<span className="text-sm font-semibold text-purple-600">{formatCurrency(transferTournamentPayments)}</span>
</div>
<div className="flex justify-between items-center p-3 bg-purple-50 rounded border border-purple-200">
<span className="text-sm text-gray-700">Liga Fut 7</span>
<span className="text-sm font-semibold text-purple-600">{formatCurrency(transferLeaguePayments)}</span>
</div>
<div className="flex justify-between items-center p-3 bg-purple-50 rounded border border-purple-200">
<span className="text-sm text-gray-700">Summer Camp</span>
<span className="text-sm font-semibold text-purple-600">{formatCurrency(transferSummerCampPayments)}</span>
</div>
<div className="pt-2 space-y-2">
<p className="text-xs font-semibold text-gray-600 uppercase">Por Banco</p>

{/* BBVA */}
<div className="space-y-1">
<button
onClick={() => toggleBank('BBVA')}
className="w-full flex justify-between items-center p-2 bg-purple-50/50 rounded border border-purple-100 hover:bg-purple-100 transition-colors"
>
<div className="flex items-center gap-2">
<span className="text-xs text-gray-600 font-semibold">BBVA ({bbvaPayments.length})</span>
{expandedBanks.BBVA ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
</div>
<span className="text-sm font-semibold text-purple-600">{formatCurrency(totalBBVA)}</span>
</button>
{expandedBanks.BBVA && (
<div className="pl-4 space-y-1">
{getBankBreakdown('BBVA').playerPayments.map((payment) => (
<div key={payment.id} className="bg-purple-50/30 p-2 rounded border border-purple-100">
<div className="flex justify-between items-start">
<div className="flex-1">
<div className="flex items-center gap-2">
<Badge variant="outline" className="text-xs">Jugador</Badge>
<span className="text-xs font-semibold">{getPlayerName(payment.player_id)}</span>
</div>
<div className="text-xs text-gray-600 mt-1">
{payment.payment_date && formatSafeDate(payment.payment_date) && (
<span>Fecha: {formatSafeDate(payment.payment_date)}</span>
)}
{payment.month && <span> • Mes: {payment.month}</span>}
</div>
</div>
<span className="text-xs font-bold text-purple-600">{formatCurrency(payment.amount)}</span>
</div>
</div>
))}
{getBankBreakdown('BBVA').generalPayments.map((payment) => (
<div key={payment.id} className="bg-purple-50/30 p-2 rounded border border-purple-100">
<div className="flex justify-between items-start">
<div className="flex-1">
<div className="flex items-center gap-2">
<Badge variant="outline" className="text-xs">General</Badge>
<span className="text-xs font-semibold">{payment.concept}</span>
</div>
<div className="text-xs text-gray-600 mt-1">
{payment.payment_date && formatSafeDate(payment.payment_date) && (
<span>Fecha: {formatSafeDate(payment.payment_date)}</span>
)}
</div>
</div>
<span className="text-xs font-bold text-purple-600">{formatCurrency(payment.amount)}</span>
</div>
</div>
))}
{getBankBreakdown('BBVA').tournamentPayments.map((payment) => (
<div key={payment.id} className="bg-purple-50/30 p-2 rounded border border-purple-100">
<div className="flex justify-between items-start">
<div className="flex-1">
<div className="flex items-center gap-2">
<Badge variant="outline" className="text-xs">Torneo</Badge>
<span className="text-xs font-semibold">{getPlayerName(payment.player_id)}</span>
</div>
<div className="text-xs text-gray-600 mt-1">
{payment.payment_date && formatSafeDate(payment.payment_date) && (
<span>Fecha: {formatSafeDate(payment.payment_date)}</span>
)}
</div>
</div>
<span className="text-xs font-bold text-purple-600">{formatCurrency(getPaymentAmount(payment))}</span>
</div>
</div>
))}
</div>
)}
</div>

{/* MP */}
<div className="space-y-1">
<button
onClick={() => toggleBank('MP')}
className="w-full flex justify-between items-center p-2 bg-purple-50/50 rounded border border-purple-100 hover:bg-purple-100 transition-colors"
>
<div className="flex items-center gap-2">
<span className="text-xs text-gray-600 font-semibold">MP ({mpPayments.length})</span>
{expandedBanks.MP ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
</div>
<span className="text-sm font-semibold text-purple-600">{formatCurrency(totalMP)}</span>
</button>
{expandedBanks.MP && (
<div className="pl-4 space-y-1">
{getBankBreakdown('MP').playerPayments.map((payment) => (
<div key={payment.id} className="bg-purple-50/30 p-2 rounded border border-purple-100">
<div className="flex justify-between items-start">
<div className="flex-1">
<div className="flex items-center gap-2">
<Badge variant="outline" className="text-xs">Jugador</Badge>
<span className="text-xs font-semibold">{getPlayerName(payment.player_id)}</span>
</div>
<div className="text-xs text-gray-600 mt-1">
{payment.payment_date && formatSafeDate(payment.payment_date) && (
<span>Fecha: {formatSafeDate(payment.payment_date)}</span>
)}
{payment.month && <span> • Mes: {payment.month}</span>}
</div>
</div>
<span className="text-xs font-bold text-purple-600">{formatCurrency(payment.amount)}</span>
</div>
</div>
))}
{getBankBreakdown('MP').generalPayments.map((payment) => (
<div key={payment.id} className="bg-purple-50/30 p-2 rounded border border-purple-100">
<div className="flex justify-between items-start">
<div className="flex-1">
<div className="flex items-center gap-2">
<Badge variant="outline" className="text-xs">General</Badge>
<span className="text-xs font-semibold">{payment.concept}</span>
</div>
<div className="text-xs text-gray-600 mt-1">
{payment.payment_date && formatSafeDate(payment.payment_date) && (
<span>Fecha: {formatSafeDate(payment.payment_date)}</span>
)}
</div>
</div>
<span className="text-xs font-bold text-purple-600">{formatCurrency(payment.amount)}</span>
</div>
</div>
))}
{getBankBreakdown('MP').tournamentPayments.map((payment) => (
<div key={payment.id} className="bg-purple-50/30 p-2 rounded border border-purple-100">
<div className="flex justify-between items-start">
<div className="flex-1">
<div className="flex items-center gap-2">
<Badge variant="outline" className="text-xs">Torneo</Badge>
<span className="text-xs font-semibold">{getPlayerName(payment.player_id)}</span>
</div>
<div className="text-xs text-gray-600 mt-1">
{payment.payment_date && formatSafeDate(payment.payment_date) && (
<span>Fecha: {formatSafeDate(payment.payment_date)}</span>
)}
</div>
</div>
<span className="text-xs font-bold text-purple-600">{formatCurrency(getPaymentAmount(payment))}</span>
</div>
</div>
))}
</div>
)}
</div>

{/* NU */}
<div className="space-y-1">
<button
onClick={() => toggleBank('NU')}
className="w-full flex justify-between items-center p-2 bg-purple-50/50 rounded border border-purple-100 hover:bg-purple-100 transition-colors"
>
<div className="flex items-center gap-2">
<span className="text-xs text-gray-600 font-semibold">NU ({nuPayments.length})</span>
{expandedBanks.NU ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
</div>
<span className="text-sm font-semibold text-purple-600">{formatCurrency(totalNU)}</span>
</button>
{expandedBanks.NU && (
<div className="pl-4 space-y-1">
{getBankBreakdown('NU').playerPayments.map((payment) => (
<div key={payment.id} className="bg-purple-50/30 p-2 rounded border border-purple-100">
<div className="flex justify-between items-start">
<div className="flex-1">
<div className="flex items-center gap-2">
<Badge variant="outline" className="text-xs">Jugador</Badge>
<span className="text-xs font-semibold">{getPlayerName(payment.player_id)}</span>
</div>
<div className="text-xs text-gray-600 mt-1">
{payment.payment_date && formatSafeDate(payment.payment_date) && (
<span>Fecha: {formatSafeDate(payment.payment_date)}</span>
)}
{payment.month && <span> • Mes: {payment.month}</span>}
</div>
</div>
<span className="text-xs font-bold text-purple-600">{formatCurrency(payment.amount)}</span>
</div>
</div>
))}
{getBankBreakdown('NU').generalPayments.map((payment) => (
<div key={payment.id} className="bg-purple-50/30 p-2 rounded border border-purple-100">
<div className="flex justify-between items-start">
<div className="flex-1">
<div className="flex items-center gap-2">
<Badge variant="outline" className="text-xs">General</Badge>
<span className="text-xs font-semibold">{payment.concept}</span>
</div>
<div className="text-xs text-gray-600 mt-1">
{payment.payment_date && formatSafeDate(payment.payment_date) && (
<span>Fecha: {formatSafeDate(payment.payment_date)}</span>
)}
</div>
</div>
<span className="text-xs font-bold text-purple-600">{formatCurrency(payment.amount)}</span>
</div>
</div>
))}
{getBankBreakdown('NU').tournamentPayments.map((payment) => (
<div key={payment.id} className="bg-purple-50/30 p-2 rounded border border-purple-100">
<div className="flex justify-between items-start">
<div className="flex-1">
<div className="flex items-center gap-2">
<Badge variant="outline" className="text-xs">Torneo</Badge>
<span className="text-xs font-semibold">{getPlayerName(payment.player_id)}</span>
</div>
<div className="text-xs text-gray-600 mt-1">
{payment.payment_date && formatSafeDate(payment.payment_date) && (
<span>Fecha: {formatSafeDate(payment.payment_date)}</span>
)}
</div>
</div>
<span className="text-xs font-bold text-purple-600">{formatCurrency(getPaymentAmount(payment))}</span>
</div>
</div>
))}
</div>
)}
</div>

{/* MercadoPagoBIA */}
<div className="space-y-1">
<button
onClick={() => toggleBank('MercadoPagoBIA')}
className="w-full flex justify-between items-center p-2 bg-purple-50/50 rounded border border-purple-100 hover:bg-purple-100 transition-colors"
>
<div className="flex items-center gap-2">
<span className="text-xs text-gray-600 font-semibold">Mercado Pago BIA ({mercadoPagoBIAPayments.length})</span>
{expandedBanks.MercadoPagoBIA ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
</div>
<span className="text-sm font-semibold text-purple-600">{formatCurrency(totalMercadoPagoBIA)}</span>
</button>
{expandedBanks.MercadoPagoBIA && (
<div className="pl-4 space-y-1">
{getBankBreakdown('MercadoPagoBIA').playerPayments.map((payment) => (
<div key={payment.id} className="bg-purple-50/30 p-2 rounded border border-purple-100">
<div className="flex justify-between items-start">
<div className="flex-1">
<div className="flex items-center gap-2">
<Badge variant="outline" className="text-xs">Jugador</Badge>
<span className="text-xs font-semibold">{getPlayerName(payment.player_id)}</span>
</div>
<div className="text-xs text-gray-600 mt-1">
{payment.payment_date && formatSafeDate(payment.payment_date) && (
<span>Fecha: {formatSafeDate(payment.payment_date)}</span>
)}
{payment.month && <span> • Mes: {payment.month}</span>}
</div>
</div>
<span className="text-xs font-bold text-purple-600">{formatCurrency(payment.amount)}</span>
</div>
</div>
))}
{getBankBreakdown('MercadoPagoBIA').generalPayments.map((payment) => (
<div key={payment.id} className="bg-purple-50/30 p-2 rounded border border-purple-100">
<div className="flex justify-between items-start">
<div className="flex-1">
<div className="flex items-center gap-2">
<Badge variant="outline" className="text-xs">General</Badge>
<span className="text-xs font-semibold">{payment.concept}</span>
</div>
<div className="text-xs text-gray-600 mt-1">
{payment.payment_date && formatSafeDate(payment.payment_date) && (
<span>Fecha: {formatSafeDate(payment.payment_date)}</span>
)}
</div>
</div>
<span className="text-xs font-bold text-purple-600">{formatCurrency(payment.amount)}</span>
</div>
</div>
))}
</div>
)}
</div>

{/* OpenBank */}
<div className="space-y-1">
<button
onClick={() => toggleBank('OpenBank')}
className="w-full flex justify-between items-center p-2 bg-purple-50/50 rounded border border-purple-100 hover:bg-purple-100 transition-colors"
>
<div className="flex items-center gap-2">
<span className="text-xs text-gray-600 font-semibold">OpenBank ({openBankPayments.length})</span>
{expandedBanks.OpenBank ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
</div>
<span className="text-sm font-semibold text-purple-600">{formatCurrency(totalOpenBank)}</span>
</button>
{expandedBanks.OpenBank && (
<div className="pl-4 space-y-1">
{getBankBreakdown('OpenBank').playerPayments.map((payment) => (
<div key={payment.id} className="bg-purple-50/30 p-2 rounded border border-purple-100">
<div className="flex justify-between items-start">
<div className="flex-1">
<div className="flex items-center gap-2">
<Badge variant="outline" className="text-xs">Jugador</Badge>
<span className="text-xs font-semibold">{getPlayerName(payment.player_id)}</span>
</div>
<div className="text-xs text-gray-600 mt-1">
{payment.payment_date && formatSafeDate(payment.payment_date) && (
<span>Fecha: {formatSafeDate(payment.payment_date)}</span>
)}
{payment.month && <span> • Mes: {payment.month}</span>}
</div>
</div>
<span className="text-xs font-bold text-purple-600">{formatCurrency(payment.amount)}</span>
</div>
</div>
))}
{getBankBreakdown('OpenBank').generalPayments.map((payment) => (
<div key={payment.id} className="bg-purple-50/30 p-2 rounded border border-purple-100">
<div className="flex justify-between items-start">
<div className="flex-1">
<div className="flex items-center gap-2">
<Badge variant="outline" className="text-xs">General</Badge>
<span className="text-xs font-semibold">{payment.concept}</span>
</div>
<div className="text-xs text-gray-600 mt-1">
{payment.payment_date && formatSafeDate(payment.payment_date) && (
<span>Fecha: {formatSafeDate(payment.payment_date)}</span>
)}
</div>
</div>
<span className="text-xs font-bold text-purple-600">{formatCurrency(payment.amount)}</span>
</div>
</div>
))}
{getBankBreakdown('OpenBank').tournamentPayments.map((payment) => (
<div key={payment.id} className="bg-purple-50/30 p-2 rounded border border-purple-100">
<div className="flex justify-between items-start">
<div className="flex-1">
<div className="flex items-center gap-2">
<Badge variant="outline" className="text-xs">Torneo</Badge>
<span className="text-xs font-semibold">{getPlayerName(payment.player_id)}</span>
</div>
<div className="text-xs text-gray-600 mt-1">
{payment.payment_date && formatSafeDate(payment.payment_date) && (
<span>Fecha: {formatSafeDate(payment.payment_date)}</span>
)}
</div>
</div>
<span className="text-xs font-bold text-purple-600">{formatCurrency(getPaymentAmount(payment))}</span>
</div>
</div>
))}
</div>
)}
</div>
</div>
{/* FIX: was totalTransfer + transferTournamentPayments (double-counting). Now just totalTransfer */}
<div className="flex justify-between items-center p-3 bg-purple-100 rounded border-2 border-purple-300">
<span className="font-bold text-gray-900">Total Transferencia</span>
<span className="text-lg font-bold text-purple-600">{formatCurrency(totalTransfer)}</span>
</div>
</TabsContent>
</Tabs>
</CardContent>
</Card>

<Card className="shadow-lg border-2">
<CardHeader>
<CardTitle className="flex items-center gap-2">
<TrendingUp className="w-5 h-5 text-blue-600" />
Padres Morosos Este Mes
</CardTitle>
</CardHeader>
<CardContent>
{playersWithoutPayment.length === 0 ? (
<div className="text-center py-8 text-gray-500">
<CreditCard className="w-12 h-12 mx-auto mb-3 text-green-500" />
<p className="font-medium">¡Excelente!</p>
<p className="text-sm">Todos los pagos están al día</p>
</div>
) : (
<div className="space-y-3 max-h-64 overflow-y-auto">
{playersWithoutPayment.slice(0, 5).map((player) => (
<div key={player.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
<div className="flex-1">
<p className="font-medium text-gray-900">{player.full_name}</p>
<p className="text-xs text-gray-600">{player.parent_name} - {player.parent_phone}</p>
</div>
<span className="text-sm font-bold text-red-600">{formatCurrency(player.monthly_fee)}</span>
</div>
))}
{playersWithoutPayment.length > 5 && (
<Link to={createPageUrl('Payments')}>
<p className="text-center text-sm text-blue-600 hover:underline mt-2">
Ver todos ({playersWithoutPayment.length})
</p>
</Link>
)}
</div>
)}
</CardContent>
</Card>
</div>

{/* Financial Summary by Month/Year */}
<FinancialSummary />
</div>
);
}
