import React, { useState } from 'react';
import ERPPageHeader from '../components/layout/ERPPageHeader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, CreditCard, AlertCircle, DollarSign, Search } from 'lucide-react';
import PaymentForm from '../components/payments/PaymentForm';
import PaymentsList from '../components/payments/PaymentsList';
import DebtorsList from '../components/payments/DebtorsList';
import GeneralPaymentForm from '../components/payments/GeneralPaymentForm';
import GeneralPaymentsList from '../components/payments/GeneralPaymentsList';
import PlayerUnifiedDebt from '../components/payments/PlayerUnifiedDebt';
import UnifiedPaymentGateway from '../components/payments/UnifiedPaymentGateway';
import PagoGeneralModal from '../components/payments/PagoGeneralModal';
import { formatCurrency } from '../components/lib/formatCurrency';
import { logAudit } from '../components/lib/auditLogger';

export default function Payments() {
const [showForm, setShowForm] = useState(false);
const [editingPayment, setEditingPayment] = useState(null);
const [showGeneralForm, setShowGeneralForm] = useState(false);
const [editingGeneralPayment, setEditingGeneralPayment] = useState(null);
const [activeTab, setActiveTab] = useState('payments');
const [paymentConfig, setPaymentConfig] = useState(null);
const [pagoGeneralInfo, setPagoGeneralInfo] = useState(null);
const queryClient = useQueryClient();

const { data: payments = [], isLoading: paymentsLoading } = useQuery({
queryKey: ['payments'],
queryFn: () => base44.entities.Payment.list('-payment_date'),
});

const { data: players = [], isLoading: playersLoading } = useQuery({
queryKey: ['players'],
queryFn: () => base44.entities.Player.list(),
});

const { data: generalPayments = [], isLoading: generalPaymentsLoading } = useQuery({
queryKey: ['generalPayments'],
queryFn: () => base44.entities.GeneralPayment.list('-payment_date'),
});

const { data: tournamentPayments = [] } = useQuery({
queryKey: ['tournamentPayments'],
queryFn: () => base44.entities.TournamentPayment.list(),
});

const { data: leaguePayments = [] } = useQuery({
queryKey: ['leaguePayments'],
queryFn: () => base44.entities.LeaguePayment.list(),
});

const { data: summerCampPayments = [] } = useQuery({
queryKey: ['summerCampPayments'],
queryFn: () => base44.entities.SummerCampPayment.list(),
});

const { data: expenses = [] } = useQuery({
queryKey: ['expenses'],
queryFn: () => base44.entities.Expense.list(),
});

// FIX: added caja_principal_expenses as second expense source
const { data: cajaPrincipalExpenses = [] } = useQuery({
queryKey: ['cajaPrincipalExpenses'],
queryFn: () => base44.entities.CajaPrincipalExpense.list('-expense_date'),
});

const { data: tournaments = [] } = useQuery({
queryKey: ['tournaments'],
queryFn: () => base44.entities.Tournament.list(),
});

const { data: tournamentAttendees = [] } = useQuery({
queryKey: ['tournamentAttendees'],
queryFn: () => base44.entities.TournamentAttendee.list(),
});

const createMutation = useMutation({
mutationFn: async (data) => {
const result = await base44.entities.Payment.create(data);
const player = players.find(p => p.id === data.player_id);
await logAudit({
action: 'CREACIÓN', module: 'Pagos', entity_type: 'Payment',
entity_id: result.id,
entity_name: player ? `Pago de ${player.full_name}` : 'Pago',
newData: data,
details: `Mes: ${data.month}, Monto: $${data.amount}, Método: ${data.payment_method}`
});
return result;
},
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: ['payments'] });
setShowForm(false);
setEditingPayment(null);
},
});

const updateMutation = useMutation({
mutationFn: async ({ id, data, previousPayment }) => {
const player = players.find(p => p.id === data.player_id);
const prevAmount = previousPayment?.amount || 0;
const newAmount = data.amount || 0;
await logAudit({
action: 'MODIFICACIÓN', module: 'Pagos', entity_type: 'Payment',
entity_id: id,
entity_name: player ? `Pago de ${player.full_name}` : 'Pago',
previousData: previousPayment,
newData: data,
monetaryDiff: newAmount - prevAmount,
details: `Mes: ${data.month}, Monto anterior: $${prevAmount} → Nuevo: $${newAmount}`
});
return base44.entities.Payment.update(id, data);
},
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: ['payments'] });
setShowForm(false);
setEditingPayment(null);
},
});

const deleteMutation = useMutation({
mutationFn: async (payment) => {
const player = players.find(p => p.id === payment.player_id);
await logAudit({
action: 'ELIMINACIÓN', module: 'Pagos', entity_type: 'Payment',
entity_id: payment.id,
entity_name: player ? `Pago de ${player.full_name}` : 'Pago',
previousData: payment,
monetaryDiff: -(payment.amount || 0),
details: `Mes: ${payment.month}, Monto: $${payment.amount}`
});
return base44.entities.Payment.delete(payment.id);
},
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: ['payments'] });
queryClient.invalidateQueries({ queryKey: ['players'] });
},
});

const handleSubmit = (data) => {
if (editingPayment && editingPayment.id) {
updateMutation.mutate({ id: editingPayment.id, data, previousPayment: editingPayment });
} else {
createMutation.mutate(data);
}
};

const handleEdit = (payment) => {
setEditingPayment(payment);
setShowForm(true);
};

const createTournamentPaymentMutation = useMutation({
mutationFn: async (data) => {
const result = await base44.entities.TournamentPayment.create(data);
const player = players.find(p => p.id === data.player_id);
await logAudit({
action: 'CREACIÓN', module: 'Torneos', entity_type: 'TournamentPayment',
entity_id: result.id,
entity_name: player ? `Pago torneo de ${player.full_name}` : 'Pago torneo',
newData: data,
details: `Torneo ID: ${data.tournament_id}, Abonado: $${data.paid_amount}, Método: ${data.payment_method}`
});
return result;
},
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: ['tournamentPayments'] });
queryClient.invalidateQueries({ queryKey: ['tournamentAttendees'] });
setPaymentConfig(null);
},
});

const handlePay = (debtInfo) => {
setPaymentConfig({
type: debtInfo.isTournament ? 'torneo' : (debtInfo.payment_type || 'mensualidad'),
player: debtInfo.player,
debtInfo,
});
};

const handleUnifiedSubmit = (data) => {
if (data.type === 'tournament') {
const { type, ...tpData } = data;
createTournamentPaymentMutation.mutate(tpData);
} else {
const { type, existingPaymentId, ...paymentData } = data;
const isUniformes = paymentData.payment_type === 'uniformes';

if (isUniformes && existingPaymentId) {
const abonoRecord = { ...paymentData, status: 'pagado' };
createMutation.mutate(abonoRecord, {
onSuccess: () => {
const existing = payments.find(p => p.id === existingPaymentId);
if (existing) {
updateMutation.mutate({
id: existingPaymentId,
data: { ...existing, notes: paymentData.notes },
previousPayment: existing
});
}
setPaymentConfig(null);
}
});
} else if (existingPaymentId && paymentData.status === 'pagado') {
updateMutation.mutate(
{ id: existingPaymentId, data: { ...paymentData }, previousPayment: payments.find(p => p.id === existingPaymentId) },
{ onSuccess: () => setPaymentConfig(null) }
);
} else if (existingPaymentId && paymentData.status === 'pendiente') {
const existing = payments.find(p => p.id === existingPaymentId);
updateMutation.mutate(
{ id: existingPaymentId, data: { ...existing, notes: paymentData.notes, status: 'pendiente' }, previousPayment: existing },
{ onSuccess: () => setPaymentConfig(null) }
);
} else {
createMutation.mutate(paymentData, {
onSuccess: () => setPaymentConfig(null),
});
}
}
};

const handleAbonar = (debtInfo) => {
setPaymentConfig({
type: debtInfo.payment_type || 'mensualidad',
player: debtInfo.player,
debtInfo,
});
};

const handlePagoGeneralConfirm = async ({ payments: paymentList, summary }) => {
// Create all payments sequentially for audit trail integrity
for (const p of paymentList) {
if (p.type === 'tournament') {
const { type, ...tpData } = p;
await createTournamentPaymentMutation.mutateAsync(tpData);
} else {
const { type, ...rpData } = p;
// Use the existing abono logic
const { existingPaymentId, ...paymentData } = rpData;
if (existingPaymentId && paymentData.payment_type === 'uniformes') {
const abonoRecord = { ...paymentData, status: 'pagado' };
await base44.entities.Payment.create(abonoRecord);
const existing = payments.find(ep => ep.id === existingPaymentId);
if (existing) {
await base44.entities.Payment.update(existingPaymentId, { ...existing, notes: paymentData.notes });
}
} else if (existingPaymentId && paymentData.status === 'pagado') {
await base44.entities.Payment.update(existingPaymentId, paymentData);
} else {
await base44.entities.Payment.create(paymentData);
}
// Log audit
const player = players.find(pl => pl.id === p.player_id);
await logAudit({
action: 'CREACIÓN', module: 'Pagos', entity_type: 'Payment',
entity_id: 'batch',
entity_name: player ? `Pago general de ${player.full_name}` : 'Pago general',
newData: paymentData,
details: `Pago general — ${paymentData.payment_type || 'mensualidad'}: $${paymentData.amount}`
});
}
}

// Refresh all queries
queryClient.invalidateQueries({ queryKey: ['payments'] });
queryClient.invalidateQueries({ queryKey: ['tournamentPayments'] });
queryClient.invalidateQueries({ queryKey: ['players'] });
setPagoGeneralInfo(null);
};

const handleDelete = (payment) => {
if (confirm('¿Estás seguro de eliminar este pago?')) {
deleteMutation.mutate(payment);
}
};

// General Payments
const createGeneralMutation = useMutation({
mutationFn: async (data) => {
const result = await base44.entities.GeneralPayment.create(data);
await logAudit({
action: 'CREACIÓN', module: 'Pagos Generales', entity_type: 'GeneralPayment',
entity_id: result.id, entity_name: data.concept,
newData: data,
details: `Monto: $${data.amount}, Método: ${data.payment_method}`
});
return result;
},
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: ['generalPayments'] });
setShowGeneralForm(false);
setEditingGeneralPayment(null);
},
});

const updateGeneralMutation = useMutation({
mutationFn: async ({ id, data, prev }) => {
await logAudit({
action: 'MODIFICACIÓN', module: 'Pagos Generales', entity_type: 'GeneralPayment',
entity_id: id, entity_name: data.concept,
previousData: prev, newData: data,
monetaryDiff: (data.amount || 0) - (prev?.amount || 0),
details: `Monto anterior: $${prev?.amount} → Nuevo: $${data.amount}`
});
return base44.entities.GeneralPayment.update(id, data);
},
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: ['generalPayments'] });
setShowGeneralForm(false);
setEditingGeneralPayment(null);
},
});

const deleteGeneralMutation = useMutation({
mutationFn: async (payment) => {
await logAudit({
action: 'ELIMINACIÓN', module: 'Pagos Generales', entity_type: 'GeneralPayment',
entity_id: payment.id, entity_name: payment.concept,
previousData: payment,
monetaryDiff: -(payment.amount || 0),
details: `Monto: $${payment.amount}, Categoría: ${payment.category}`
});
return base44.entities.GeneralPayment.delete(payment.id);
},
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: ['generalPayments'] });
},
});

const handleGeneralSubmit = (data) => {
if (editingGeneralPayment) {
updateGeneralMutation.mutate({ id: editingGeneralPayment.id, data, prev: editingGeneralPayment });
} else {
createGeneralMutation.mutate(data);
}
};

const handleGeneralEdit = (payment) => {
setEditingGeneralPayment(payment);
setShowGeneralForm(true);
};

const handleGeneralDelete = (payment) => {
if (confirm('¿Estás seguro de eliminar este pago general?')) {
deleteGeneralMutation.mutate(payment);
}
};

return (
<div className="space-y-5">
{paymentConfig && paymentConfig.type !== 'pago_general' && (
<UnifiedPaymentGateway
config={paymentConfig}
onSubmit={handleUnifiedSubmit}
onCancel={() => setPaymentConfig(null)}
isLoading={createMutation.isPending || updateMutation.isPending || createTournamentPaymentMutation.isPending}
/>
)}
{pagoGeneralInfo && (
<PagoGeneralModal
player={pagoGeneralInfo.player}
debts={pagoGeneralInfo.debts}
onConfirm={handlePagoGeneralConfirm}
onCancel={() => setPagoGeneralInfo(null)}
isLoading={createMutation.isPending || createTournamentPaymentMutation.isPending}
/>
)}
<ERPPageHeader
icon={CreditCard}
iconColor="text-green-600"
iconBg="bg-green-50"
title="Gestión de Pagos"
subtitle="Administra mensualidades, inscripciones y pagos generales"
breadcrumb={['BIA', 'Pagos']}
actions={
<>
<Button size="sm" onClick={() => { setEditingPayment({ amount: 400 }); setShowForm(true); }} className="bg-green-600 hover:bg-green-700 gap-1.5">
<Plus className="w-4 h-4" /> Pago Jugadores
</Button>
<Button size="sm" onClick={() => { setEditingGeneralPayment(null); setShowGeneralForm(true); }} className="bg-blue-600 hover:bg-blue-700 gap-1.5">
<Plus className="w-4 h-4" /> Pagos Generales
</Button>
</>
}
/>

{/* Form */}
{showForm && (
<PaymentForm
payment={editingPayment}
players={players}
onSubmit={handleSubmit}
onCancel={() => {
setShowForm(false);
setEditingPayment(null);
}}
isLoading={createMutation.isPending || updateMutation.isPending}
/>
)}

{/* General Payment Form */}
{showGeneralForm && (
<GeneralPaymentForm
payment={editingGeneralPayment}
onSubmit={handleGeneralSubmit}
onCancel={() => {
setShowGeneralForm(false);
setEditingGeneralPayment(null);
}}
isLoading={createGeneralMutation.isPending || updateGeneralMutation.isPending}
/>
)}

{/* Saldos por Cuenta */}
<Card>
<CardHeader>
<CardTitle>Saldos por Cuenta</CardTitle>
<p className="text-sm text-gray-600">Ingresos totales - Egresos totales</p>
</CardHeader>
<CardContent>
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
{(() => {
// FIX: paid_amount null → usa amount como fallback (igual que Egresos/Dashboard)
// El bug anterior: (paid_amount ?? 0) retornaba 0 cuando paid_amount=null,
// ignorando $1,168,949 en torneos efectivo con paid_amount no asignado.
const getAmt = (p) => (p.paid_amount !== undefined && p.paid_amount !== null) ? p.paid_amount : (p.amount || 0);

// FIX: payments filtrado a status=pagado (consistente con Egresos/Dashboard)
const allPayments = [
  ...payments.filter(p => p.status === 'pagado'),
  ...generalPayments,
  ...tournamentPayments,
  ...leaguePayments,
  ...summerCampPayments.filter(p => p.status === 'pagado'),
];

// FIX: incluye caja_principal_expenses en Out (consistente con Egresos/Dashboard)
const allExpenses = [...expenses, ...cajaPrincipalExpenses];

const efectivoIn = allPayments.filter(p => p.payment_method === 'efectivo').reduce((sum, p) => sum + getAmt(p), 0);
const efectivoOut = allExpenses.filter(e => e.payment_method === 'efectivo').reduce((sum, e) => sum + (e.amount || 0), 0);
const efectivoBalance = efectivoIn - efectivoOut;

const tarjetaIn = allPayments.filter(p => p.payment_method === 'tarjeta').reduce((sum, p) => sum + getAmt(p), 0);
const tarjetaOut = allExpenses.filter(e => e.payment_method === 'tarjeta').reduce((sum, e) => sum + (e.amount || 0), 0);
const tarjetaBalance = tarjetaIn - tarjetaOut;

const bbvaIn = allPayments.filter(p => p.payment_method === 'transferencia' && p.bank_name === 'BBVA').reduce((sum, p) => sum + getAmt(p), 0);
const bbvaOut = allExpenses.filter(e => e.payment_method === 'transferencia' && e.account === 'BBVA').reduce((sum, e) => sum + (e.amount || 0), 0);
const bbvaBalance = bbvaIn - bbvaOut;

const mpIn = allPayments.filter(p => p.payment_method === 'transferencia' && p.bank_name === 'MP').reduce((sum, p) => sum + getAmt(p), 0);
const mpOut = allExpenses.filter(e => e.payment_method === 'transferencia' && e.account === 'MP').reduce((sum, e) => sum + (e.amount || 0), 0);
const mpBalance = mpIn - mpOut;

const nuIn = allPayments.filter(p => p.payment_method === 'transferencia' && p.bank_name === 'NU').reduce((sum, p) => sum + getAmt(p), 0);
const nuOut = allExpenses.filter(e => e.payment_method === 'transferencia' && e.account === 'NU').reduce((sum, e) => sum + (e.amount || 0), 0);
const nuBalance = nuIn - nuOut;

const obIn = allPayments.filter(p => p.payment_method === 'transferencia' && p.bank_name === 'OpenBank').reduce((sum, p) => sum + getAmt(p), 0);
const obOut = allExpenses.filter(e => e.payment_method === 'transferencia' && e.account === 'OpenBank').reduce((sum, e) => sum + (e.amount || 0), 0);
const obBalance = obIn - obOut;

const mpbiaIn = allPayments.filter(p => p.payment_method === 'transferencia' && p.bank_name === 'MercadoPagoBIA').reduce((sum, p) => sum + getAmt(p), 0);
const mpbiaOut = allExpenses.filter(e => e.payment_method === 'transferencia' && e.account === 'MercadoPagoBIA').reduce((sum, e) => sum + (e.amount || 0), 0);
const mpbiaBalance = mpbiaIn - mpbiaOut;

return (<>
<div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
<p className="text-sm text-gray-600 mb-1">Efectivo</p>
<p className={`text-2xl font-bold ${efectivoBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
{formatCurrency(efectivoBalance)}
</p>
<p className="text-xs text-gray-500 mt-1">
In: {formatCurrency(efectivoIn)} | Out: {formatCurrency(efectivoOut)}
</p>
</div>
<div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
<p className="text-sm text-gray-600 mb-1">Tarjeta</p>
<p className={`text-2xl font-bold ${tarjetaBalance >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
{formatCurrency(tarjetaBalance)}
</p>
<p className="text-xs text-gray-500 mt-1">
In: {formatCurrency(tarjetaIn)} | Out: {formatCurrency(tarjetaOut)}
</p>
</div>
<div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
<p className="text-sm text-gray-600 mb-1">BBVA</p>
<p className={`text-2xl font-bold ${bbvaBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
{formatCurrency(bbvaBalance)}
</p>
<p className="text-xs text-gray-500 mt-1">
In: {formatCurrency(bbvaIn)} | Out: {formatCurrency(bbvaOut)}
</p>
</div>
<div className="p-4 bg-cyan-50 rounded-lg border border-cyan-200">
<p className="text-sm text-gray-600 mb-1">MP</p>
<p className={`text-2xl font-bold ${mpBalance >= 0 ? 'text-cyan-600' : 'text-red-600'}`}>
{formatCurrency(mpBalance)}
</p>
<p className="text-xs text-gray-500 mt-1">
In: {formatCurrency(mpIn)} | Out: {formatCurrency(mpOut)}
</p>
</div>
<div className="p-4 bg-violet-50 rounded-lg border border-violet-200">
<p className="text-sm text-gray-600 mb-1">NU</p>
<p className={`text-2xl font-bold ${nuBalance >= 0 ? 'text-violet-600' : 'text-red-600'}`}>
{formatCurrency(nuBalance)}
</p>
<p className="text-xs text-gray-500 mt-1">
In: {formatCurrency(nuIn)} | Out: {formatCurrency(nuOut)}
</p>
</div>
<div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
<p className="text-sm text-gray-600 mb-1">OpenBank</p>
<p className={`text-2xl font-bold ${obBalance >= 0 ? 'text-orange-600' : 'text-red-600'}`}>
{formatCurrency(obBalance)}
</p>
<p className="text-xs text-gray-500 mt-1">
In: {formatCurrency(obIn)} | Out: {formatCurrency(obOut)}
</p>
</div>
<div className="p-4 bg-teal-50 rounded-lg border border-teal-200">
<p className="text-sm text-gray-600 mb-1">Mercado Pago BIA</p>
<p className={`text-2xl font-bold ${mpbiaBalance >= 0 ? 'text-teal-600' : 'text-red-600'}`}>
{formatCurrency(mpbiaBalance)}
</p>
<p className="text-xs text-gray-500 mt-1">
In: {formatCurrency(mpbiaIn)} | Out: {formatCurrency(mpbiaOut)}
</p>
</div>
</>);
})()}
</div>
</CardContent>
</Card>

{/* Tabs */}
<Tabs defaultValue="payments" className="w-full">
<TabsList className="grid w-full grid-cols-4">
<TabsTrigger value="payments" className="flex items-center gap-2">
<CreditCard className="w-4 h-4" />
Pagos Jugadores
</TabsTrigger>
<TabsTrigger value="general" className="flex items-center gap-2">
<DollarSign className="w-4 h-4" />
Pagos Generales
</TabsTrigger>
<TabsTrigger value="debtors" className="flex items-center gap-2">
<AlertCircle className="w-4 h-4" />
Morosos
</TabsTrigger>
<TabsTrigger value="unified" className="flex items-center gap-2">
<Search className="w-4 h-4" />
Deuda Unificada
</TabsTrigger>
</TabsList>

<TabsContent value="payments" className="mt-6">
<PaymentsList
payments={payments}
players={players}
isLoading={paymentsLoading || playersLoading}
onEdit={handleEdit}
onDelete={handleDelete}
/>
</TabsContent>

<TabsContent value="general" className="mt-6">
<GeneralPaymentsList
payments={generalPayments}
isLoading={generalPaymentsLoading}
onEdit={handleGeneralEdit}
onDelete={handleGeneralDelete}
/>
</TabsContent>

<TabsContent value="debtors" className="mt-6">
<DebtorsList
players={players}
payments={payments}
isLoading={playersLoading || paymentsLoading}
onAbonar={handleAbonar}
onAbonarInscripcion={handleAbonar}
/>
</TabsContent>

<TabsContent value="unified" className="mt-6">
<PlayerUnifiedDebt
players={players}
payments={payments}
tournamentPayments={tournamentPayments}
tournaments={tournaments}
tournamentAttendees={tournamentAttendees}
summerCampPayments={summerCampPayments}
isLoading={playersLoading || paymentsLoading}
onAbonar={handlePay}
onAbonarTorneo={(info) => setPaymentConfig({ type: 'torneo', player: info.player, debtInfo: info })}
onPagoGeneral={(info) => setPagoGeneralInfo(info)}
/>
</TabsContent>
</Tabs>
</div>
);
}
