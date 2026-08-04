import React, { useState } from 'react';
import ERPPageHeader from '../components/layout/ERPPageHeader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44, supabase } from '@/api/base44Client';
import { toast } from 'sonner';
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

// Regla de morosidad del club (día límite / recargo) y condonaciones registradas
const { data: clubSettings = [] } = useQuery({
queryKey: ['clubSettings'],
queryFn: () => base44.entities.ClubSetting.list(),
});
const lateFeeSettings = clubSettings.find(cs => cs.key === 'late_fee')?.value || null;
const seasonCalendar = clubSettings.find(cs => cs.key === 'season_calendar')?.value || null;
const feesConfig = clubSettings.find(cs => cs.key === 'fees')?.value || null;

const { data: saldosCuentas = [] } = useQuery({
queryKey: ['saldosPorCuenta'],
queryFn: async () => {
const { data, error } = await supabase.rpc('saldos_por_cuenta');
if (error) throw error;
return data || [];
},
});

const { data: bankAccounts = [] } = useQuery({
queryKey: ['bankAccounts'],
queryFn: () => base44.entities.BankAccount.list('sort_order'),
});
const { data: uniformCatalog = [] } = useQuery({
queryKey: ['catalogItems'],
queryFn: () => base44.entities.CatalogItem.list('sort_order'),
});

const { data: debtWaivers = [] } = useQuery({
queryKey: ['debtWaivers'],
queryFn: () => base44.entities.DebtWaiver.list(null, 10000),
});

// Condonar deuda: registro inmutable + auditoría (nunca se borra deuda en silencio)
const [condonarInfo, setCondonarInfo] = useState(null); // { player, month, amount }
const [condonarReason, setCondonarReason] = useState('');
const condonarMutation = useMutation({
mutationFn: async ({ player, month, amount, reason }) => {
const user = await base44.auth.me();
await base44.entities.DebtWaiver.create({
player_id: player.id, month, amount, reason, created_by: user.email,
});
await logAudit({
action: 'CONDONACIÓN', module: 'Pagos', entity_type: 'DebtWaiver',
entity_id: player.id, entity_name: player.full_name,
monetaryDiff: -amount,
details: `Deuda condonada: ${month} por $${amount}. Motivo: ${reason}`,
});
},
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: ['debtWaivers'] });
setCondonarInfo(null); setCondonarReason('');
toast.success('Deuda condonada y registrada en Auditoría');
},
onError: () => toast.error('No se pudo registrar la condonación'),
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
const { data: cashRegisters = [] } = useQuery({
queryKey: ['cashRegisters'],
queryFn: () => base44.entities.CashRegister.list('-register_date'),
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
queryClient.invalidateQueries({ queryKey: ['saldosPorCuenta'] });
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
queryClient.invalidateQueries({ queryKey: ['saldosPorCuenta'] });
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
queryClient.invalidateQueries({ queryKey: ['saldosPorCuenta'] });
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
// Abono a partida abierta vía RPC atómica (estilo caja SAP): basta permiso de
// captura, y nunca queda aplicado a medias. Todo ocurre en Supabase en una transacción.
(async () => {
const existing = payments.find(p => p.id === existingPaymentId);
try {
const { data: res, error } = await supabase.rpc('abonar_partida', {
p_payment_id: existingPaymentId,
p_monto: paymentData.amount || 0,
p_metodo: paymentData.payment_method || 'efectivo',
p_banco: paymentData.bank_name || null,
p_referencia: paymentData.reference_number || null,
p_fecha: (paymentData.payment_date || '').slice(0, 10) || null,
});
if (error) throw error;
await logAudit({
action: res?.liquidado ? 'MODIFICACIÓN' : 'CREACIÓN', module: 'Pagos', entity_type: 'Payment',
entity_id: String(res?.abono_id || existingPaymentId),
entity_name: `Abono a uniformes`,
previousData: existing, newData: { ...paymentData, resto: res?.resto },
monetaryDiff: paymentData.amount || 0,
details: res?.liquidado ? `Saldo de uniformes liquidado: $${paymentData.amount}` : `Abono a uniformes: $${paymentData.amount} — resta $${res?.resto}`,
});
queryClient.invalidateQueries({ queryKey: ['payments'] });
queryClient.invalidateQueries({ queryKey: ['saldosPorCuenta'] });
toast.success(res?.liquidado ? 'Saldo de uniformes liquidado' : `Abono registrado — resta $${res?.resto}`);
setPaymentConfig(null);
} catch (err) {
toast.error(`No se pudo aplicar el abono: ${err?.message || 'error desconocido'}`);
}
})();
} else if (existingPaymentId && paymentData.status === 'pagado') {
// Liquidar partida pendiente (mensualidad/inscripción) vía RPC atómica:
// funciona también para roles de solo-captura (operación de caja, no edición)
(async () => {
const existing = payments.find(p => p.id === existingPaymentId);
try {
const { error } = await supabase.rpc('abonar_partida', {
p_payment_id: existingPaymentId,
p_monto: paymentData.amount || 0,
p_metodo: paymentData.payment_method || 'efectivo',
p_banco: paymentData.bank_name || null,
p_referencia: paymentData.reference_number || null,
p_fecha: (paymentData.payment_date || '').slice(0, 10) || null,
p_surcharge: paymentData.surcharge || 0,
p_notas: paymentData.notes || null,
});
if (error) throw error;
await logAudit({
action: 'MODIFICACIÓN', module: 'Pagos', entity_type: 'Payment',
entity_id: existingPaymentId,
entity_name: `Liquidación de partida pendiente`,
previousData: existing, newData: paymentData,
monetaryDiff: (paymentData.amount || 0) - (existing?.amount || 0),
details: `Partida liquidada: ${paymentData.month} por $${paymentData.amount}`,
});
queryClient.invalidateQueries({ queryKey: ['payments'] });
queryClient.invalidateQueries({ queryKey: ['saldosPorCuenta'] });
toast.success('Pago registrado');
setPaymentConfig(null);
} catch (err) {
toast.error(`No se pudo registrar el pago: ${err?.message || 'error desconocido'}`);
}
})();
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
// Abono a partida abierta vía RPC atómica (misma lógica que handleUnifiedSubmit)
const { error: rpcError } = await supabase.rpc('abonar_partida', {
p_payment_id: existingPaymentId,
p_monto: paymentData.amount || 0,
p_metodo: paymentData.payment_method || 'efectivo',
p_banco: paymentData.bank_name || null,
p_referencia: paymentData.reference_number || null,
p_fecha: (paymentData.payment_date || '').slice(0, 10) || null,
});
if (rpcError) throw new Error(`Abono a uniformes: ${rpcError.message}`);
} else if (existingPaymentId && paymentData.status === 'pagado') {
// Liquidación vía RPC atómica (funciona para roles de solo-captura)
const { error: liqError } = await supabase.rpc('abonar_partida', {
p_payment_id: existingPaymentId,
p_monto: paymentData.amount || 0,
p_metodo: paymentData.payment_method || 'efectivo',
p_banco: paymentData.bank_name || null,
p_referencia: paymentData.reference_number || null,
p_fecha: (paymentData.payment_date || '').slice(0, 10) || null,
p_surcharge: paymentData.surcharge || 0,
p_notas: paymentData.notes || null,
});
if (liqError) throw new Error(`Liquidación: ${liqError.message}`);
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
queryClient.invalidateQueries({ queryKey: ['saldosPorCuenta'] });
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
feesConfig={feesConfig}
uniformCatalog={uniformCatalog}
bankAccounts={bankAccounts}
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
{/* Fuente única: RPC saldos_por_cuenta() — misma cifra en Pagos, Egresos y Dashboard */}
{(() => {
const estilos = {
'Efectivo': ['bg-blue-50 border-blue-200', 'text-blue-600'],
'Tarjeta': ['bg-purple-50 border-purple-200', 'text-purple-600'],
'BBVA': ['bg-emerald-50 border-emerald-200', 'text-emerald-600'],
'MP': ['bg-cyan-50 border-cyan-200', 'text-cyan-600'],
'NU': ['bg-violet-50 border-violet-200', 'text-violet-600'],
'OpenBank': ['bg-orange-50 border-orange-200', 'text-orange-600'],
'MercadoPagoBIA': ['bg-teal-50 border-teal-200', 'text-teal-600'],
'Fondos (caja)': ['bg-green-50 border-green-200', 'text-green-600'],
};
return saldosCuentas.map((c) => {
const [box, txt] = estilos[c.cuenta] || ['bg-gray-50 border-gray-200', 'text-gray-700'];
const saldo = parseFloat(c.saldo) || 0;
return (
<div key={c.cuenta} className={`p-4 rounded-lg border ${box}`}>
<p className="text-sm text-gray-600 mb-1">{c.cuenta === 'MercadoPagoBIA' ? 'Mercado Pago BIA' : c.cuenta}</p>
<p className={`text-2xl font-bold ${saldo >= 0 ? txt : 'text-red-600'}`}>{formatCurrency(saldo)}</p>
<p className="text-xs text-gray-500 mt-1">In: {formatCurrency(parseFloat(c.ingresos) || 0)} | Out: {formatCurrency(parseFloat(c.egresos) || 0)}</p>
</div>
);
});
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
lateFeeSettings={lateFeeSettings}
seasonCalendar={seasonCalendar}
debtWaivers={debtWaivers}
onCondonar={(player, month, amount) => setCondonarInfo({ player, month, amount })}
/>
</TabsContent>

<TabsContent value="unified" className="mt-6">
<PlayerUnifiedDebt
feesConfig={feesConfig}
players={players}
payments={payments}
lateFeeSettings={lateFeeSettings}
seasonCalendar={seasonCalendar}
debtWaivers={debtWaivers}
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

{/* Modal Condonar Deuda */}
{condonarInfo && (
<div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
<div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
<h3 className="text-lg font-bold text-gray-900">Condonar deuda</h3>
<p className="text-sm text-gray-600">
{condonarInfo.player.full_name} — {condonarInfo.month} — <span className="font-bold text-red-600">${condonarInfo.amount}</span>
</p>
<p className="text-xs text-gray-500">La condonación es permanente, queda registrada en Auditoría y no se puede editar ni borrar.</p>
<div>
<label className="text-sm font-medium text-gray-700">Motivo (obligatorio)</label>
<textarea
className="mt-1 w-full border rounded-md p-2 text-sm"
rows={3}
value={condonarReason}
onChange={(e) => setCondonarReason(e.target.value)}
placeholder="Ej. Acuerdo con el padre por baja definitiva en marzo"
/>
</div>
<div className="flex justify-end gap-2">
<Button variant="outline" onClick={() => { setCondonarInfo(null); setCondonarReason(''); }}>Cancelar</Button>
<Button
className="bg-purple-600 hover:bg-purple-700"
disabled={!condonarReason.trim() || condonarMutation.isPending}
onClick={() => condonarMutation.mutate({ ...condonarInfo, reason: condonarReason.trim() })}
>
Condonar y registrar
</Button>
</div>
</div>
</div>
)}
</div>
);
}
