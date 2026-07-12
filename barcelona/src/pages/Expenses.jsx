import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, TrendingDown, Trash2, Edit, Search } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import ExpenseForm from '../components/expenses/ExpenseForm';
import { formatCurrency } from '../components/lib/formatCurrency';
import { logAudit } from '../components/lib/auditLogger';
import ERPPageHeader from '../components/layout/ERPPageHeader';
import KPICard from '../components/layout/KPICard';

export default function Expenses() {
const [showForm, setShowForm] = useState(false);
const [editingExpense, setEditingExpense] = useState(null);
const [searchTerm, setSearchTerm] = useState('');
const queryClient = useQueryClient();

const { data: expenses = [], isLoading } = useQuery({
queryKey: ['expenses'],
queryFn: () => base44.entities.Expense.list('-expense_date'),
});

const { data: payments = [] } = useQuery({
queryKey: ['payments'],
queryFn: () => base44.entities.Payment.list(),
});

const { data: generalPayments = [] } = useQuery({
queryKey: ['generalPayments'],
queryFn: () => base44.entities.GeneralPayment.list(),
});

const { data: tournamentPayments = [] } = useQuery({
queryKey: ['tournamentPayments'],
queryFn: () => base44.entities.TournamentPayment.list(),
});

const { data: leaguePayments = [] } = useQuery({
queryKey: ['leaguePayments'],
queryFn: () => base44.entities.LeaguePayment.list(),
});

// FIX: added summerCampPayments (was missing from account balance calculation)
const { data: summerCampPayments = [] } = useQuery({
queryKey: ['summerCampPayments'],
queryFn: () => base44.entities.SummerCampPayment.list(),
});

// FIX: added caja_principal_expenses as second expense source
const { data: cajaPrincipalExpenses = [] } = useQuery({
queryKey: ['cajaPrincipalExpenses'],
queryFn: () => base44.entities.CajaPrincipalExpense.list('-expense_date'),
});

const createMutation = useMutation({
mutationFn: async (data) => {
const result = await base44.entities.Expense.create(data);
await logAudit({
action: 'CREACIÓN', module: 'Egresos', entity_type: 'Expense',
entity_id: result.id, entity_name: data.concept,
newData: data,
details: `Categoría: ${data.category}, Monto: $${data.amount}`
});
return result;
},
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: ['expenses'] });
setShowForm(false);
setEditingExpense(null);
},
});

const updateMutation = useMutation({
mutationFn: async ({ id, data, prev }) => {
await logAudit({
action: 'MODIFICACIÓN', module: 'Egresos', entity_type: 'Expense',
entity_id: id, entity_name: data.concept,
previousData: prev, newData: data,
monetaryDiff: (data.amount || 0) - (prev?.amount || 0),
details: `Monto anterior: $${prev?.amount} → Nuevo: $${data.amount}`
});
return base44.entities.Expense.update(id, data);
},
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: ['expenses'] });
setShowForm(false);
setEditingExpense(null);
},
});

const deleteMutation = useMutation({
mutationFn: async (expense) => {
await logAudit({
action: 'ELIMINACIÓN', module: 'Egresos', entity_type: 'Expense',
entity_id: expense.id, entity_name: expense.concept,
previousData: expense,
monetaryDiff: -(expense.amount || 0),
details: `Categoría: ${expense.category}, Monto: $${expense.amount}`
});
return base44.entities.Expense.delete(expense.id);
},
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: ['expenses'] });
queryClient.invalidateQueries({ queryKey: ['payments'] });
},
});

const handleSubmit = (data) => {
if (editingExpense) {
updateMutation.mutate({ id: editingExpense.id, data, prev: editingExpense });
} else {
createMutation.mutate(data);
}
};

const handleEdit = (expense) => {
setEditingExpense(expense);
setShowForm(true);
};

const handleDelete = (expense) => {
if (confirm('¿Estás seguro de eliminar este gasto?')) {
deleteMutation.mutate(expense);
}
};

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

// FIX: includes caja_principal_expenses in total
const totalExpenses = [...expenses, ...cajaPrincipalExpenses].reduce((sum, e) => sum + (e.amount || 0), 0);

// Filter expenses based on search term
const filteredExpenses = expenses.filter(expense => {
const searchLower = searchTerm.toLowerCase();
const matchesConcept = expense.concept?.toLowerCase().includes(searchLower);
const matchesCategory = categoryLabels[expense.category]?.toLowerCase().includes(searchLower);
const matchesDate = expense.expense_date?.includes(searchTerm);
const matchesAmount = expense.amount?.toString().includes(searchTerm);
const matchesAccount = expense.account?.toLowerCase().includes(searchLower);
const matchesNotes = expense.notes?.toLowerCase().includes(searchLower);
const matchesPaymentMethod = expense.payment_method?.toLowerCase().includes(searchLower);
return matchesConcept || matchesCategory || matchesDate || matchesAmount || matchesAccount || matchesNotes || matchesPaymentMethod;
});

return (
<div className="space-y-5">
<ERPPageHeader
icon={TrendingDown}
iconColor="text-red-600"
iconBg="bg-red-50"
title="Gestión de Egresos"
subtitle="Administra todos los gastos y egresos del club"
breadcrumb={['BIA', 'Egresos']}
actions={
<Button size="sm" onClick={() => { setEditingExpense(null); setShowForm(true); }} className="bg-red-600 hover:bg-red-700 gap-1.5">
<Plus className="w-4 h-4" /> Registrar Gasto
</Button>
}
/>

<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
<KPICard title="Total Egresos" value={formatCurrency(totalExpenses)} icon={TrendingDown} color="red" trendLabel={`${filteredExpenses.length} registros`} />
<KPICard title="Registros Encontrados" value={filteredExpenses.length} icon={Search} color="gray" trendLabel="según filtro actual" />
</div>

{/* Saldos por Cuenta */}
<Card>
<CardHeader>
<CardTitle>Saldos por Cuenta</CardTitle>
<p className="text-sm text-gray-600">Ingresos totales - Egresos totales</p>
</CardHeader>
<CardContent>
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
{(() => {
// FIX: helper to correctly use paid_amount for tournaments (null → fallback to amount)
const getAmt = (p) => (p.paid_amount !== undefined && p.paid_amount !== null) ? p.paid_amount : (p.amount || 0);

// FIX: added summerCampPayments (status === 'pagado') + status filter on payments
const allPayments = [
  ...payments.filter(p => p.status === 'pagado'),
  ...generalPayments,
  ...tournamentPayments,
  ...leaguePayments,
  ...summerCampPayments.filter(p => p.status === 'pagado'),
];

const efectivoIn = allPayments.filter(p => p.payment_method === 'efectivo').reduce((sum, p) => sum + getAmt(p), 0);
const efectivoOut = [...expenses, ...cajaPrincipalExpenses].filter(e => e.payment_method === 'efectivo').reduce((sum, e) => sum + (e.amount || 0), 0);
const efectivoBalance = efectivoIn - efectivoOut;

const tarjetaIn = allPayments.filter(p => p.payment_method === 'tarjeta').reduce((sum, p) => sum + getAmt(p), 0);
const tarjetaOut = [...expenses, ...cajaPrincipalExpenses].filter(e => e.payment_method === 'tarjeta').reduce((sum, e) => sum + (e.amount || 0), 0);
const tarjetaBalance = tarjetaIn - tarjetaOut;

const bbvaIn = allPayments.filter(p => p.payment_method === 'transferencia' && p.bank_name === 'BBVA').reduce((sum, p) => sum + getAmt(p), 0);
const bbvaOut = [...expenses, ...cajaPrincipalExpenses].filter(e => e.payment_method === 'transferencia' && e.account === 'BBVA').reduce((sum, e) => sum + (e.amount || 0), 0);
const bbvaBalance = bbvaIn - bbvaOut;

const mpIn = allPayments.filter(p => p.payment_method === 'transferencia' && p.bank_name === 'MP').reduce((sum, p) => sum + getAmt(p), 0);
const mpOut = [...expenses, ...cajaPrincipalExpenses].filter(e => e.payment_method === 'transferencia' && e.account === 'MP').reduce((sum, e) => sum + (e.amount || 0), 0);
const mpBalance = mpIn - mpOut;

const nuIn = allPayments.filter(p => p.payment_method === 'transferencia' && p.bank_name === 'NU').reduce((sum, p) => sum + getAmt(p), 0);
const nuOut = [...expenses, ...cajaPrincipalExpenses].filter(e => e.payment_method === 'transferencia' && e.account === 'NU').reduce((sum, e) => sum + (e.amount || 0), 0);
const nuBalance = nuIn - nuOut;

const obIn = allPayments.filter(p => p.payment_method === 'transferencia' && p.bank_name === 'OpenBank').reduce((sum, p) => sum + getAmt(p), 0);
const obOut = [...expenses, ...cajaPrincipalExpenses].filter(e => e.payment_method === 'transferencia' && e.account === 'OpenBank').reduce((sum, e) => sum + (e.amount || 0), 0);
const obBalance = obIn - obOut;

const mpbiaIn = allPayments.filter(p => p.payment_method === 'transferencia' && p.bank_name === 'MercadoPagoBIA').reduce((sum, p) => sum + getAmt(p), 0);
const mpbiaOut = [...expenses, ...cajaPrincipalExpenses].filter(e => e.payment_method === 'transferencia' && e.account === 'MercadoPagoBIA').reduce((sum, e) => sum + (e.amount || 0), 0);
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

{showForm && (
<ExpenseForm
expense={editingExpense}
onSubmit={handleSubmit}
onCancel={() => {
setShowForm(false);
setEditingExpense(null);
}}
isLoading={createMutation.isPending || updateMutation.isPending}
/>
)}

{isLoading ? (
<div className="text-center py-12">
<div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
<p className="mt-2 text-gray-600">Cargando gastos...</p>
</div>
) : expenses.length === 0 ? (
<Card>
<CardContent className="py-12 text-center">
<TrendingDown className="w-16 h-16 mx-auto text-gray-300 mb-4" />
<h3 className="text-lg font-semibold text-gray-900 mb-2">No hay gastos registrados</h3>
<p className="text-gray-600 mb-4">Comienza registrando tu primer gasto</p>
<Button onClick={() => setShowForm(true)} className="bg-red-600 hover:bg-red-700">
<Plus className="w-4 h-4 mr-2" />
Registrar Gasto
</Button>
</CardContent>
</Card>
) : (
<>
<Card>
<CardHeader>
<CardTitle className="flex items-center gap-2">
<TrendingDown className="w-5 h-5 text-red-600" />
Lista de Gastos
</CardTitle>
<div className="relative mt-4">
<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
<Input
placeholder="Buscar por concepto, categoría, fecha, monto o cuenta..."
value={searchTerm}
onChange={(e) => setSearchTerm(e.target.value)}
className="pl-9"
/>
</div>
</CardHeader>
</Card>

{filteredExpenses.length === 0 ? (
<Card>
<CardContent className="py-12 text-center">
<Search className="w-16 h-16 mx-auto text-gray-300 mb-4" />
<h3 className="text-lg font-semibold text-gray-900 mb-2">No se encontraron resultados</h3>
<p className="text-gray-600">No hay gastos que coincidan con "{searchTerm}"</p>
</CardContent>
</Card>
) : (
<div className="space-y-3">
{filteredExpenses.map((expense) => (
<Card key={expense.id} className="hover:shadow-md transition-shadow">
<CardContent className="p-4">
<div className="flex items-center justify-between">
<div className="flex-1">
<div className="flex items-center gap-2 mb-2">
<h3 className="font-semibold text-gray-900">{expense.concept}</h3>
<Badge variant="outline">{categoryLabels[expense.category]}</Badge>
<Badge variant="secondary">{expense.payment_method}</Badge>
</div>
<div className="flex gap-4 text-sm text-gray-600">
<span>{format(new Date(expense.expense_date + 'T00:00:00'), "d 'de' MMMM, yyyy", { locale: es })}</span>
{expense.account && <span>• Cuenta: {expense.account}</span>}
{expense.notes && <span>• {expense.notes}</span>}
</div>
</div>
<div className="flex items-center gap-4">
<span className="text-2xl font-bold text-red-600">{formatCurrency(expense.amount)}</span>
<div className="flex gap-2">
<Button variant="ghost" size="icon" onClick={() => handleEdit(expense)}>
<Edit className="w-4 h-4 text-blue-600" />
</Button>
<Button variant="ghost" size="icon" onClick={() => handleDelete(expense)}>
<Trash2 className="w-4 h-4 text-red-600" />
</Button>
</div>
</div>
</div>
</CardContent>
</Card>
))}
</div>
)}
</>
)}
</div>
);
}
