// v2 - includes MercadoPagoBIA card
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44, supabase } from '@/api/base44Client';
import { usePerms } from '@/lib/usePerms';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, TrendingDown, Trash2, Edit, Search, Printer, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { confirmar } from '@/components/ui/confirmar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import ExpenseForm from '../components/expenses/ExpenseForm';
import { formatCurrency } from '../components/lib/formatCurrency';
import { logAudit } from '../components/lib/auditLogger';
import ERPPageHeader from '../components/layout/ERPPageHeader';
import KPICard from '../components/layout/KPICard';
import { imprimirVale, folioVale, cuentaLegible } from '../components/print/PrintVale';

export default function Expenses() {
  const { canDelete, isAdmin } = usePerms('expenses');
  const { data: me } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me() });
const [showForm, setShowForm] = useState(false);
const [editingExpense, setEditingExpense] = useState(null);
const [searchTerm, setSearchTerm] = useState('');
const [reversarInfo, setReversarInfo] = useState(null); // egreso a reversar (storno)
const [motivoReverso, setMotivoReverso] = useState('');
const queryClient = useQueryClient();

const { data: expenses = [], isLoading } = useQuery({
queryKey: ['expenses'],
queryFn: () => base44.entities.Expense.list('-expense_date'),
});

const { data: saldosCuentas = [] } = useQuery({
queryKey: ['saldosPorCuenta'],
queryFn: async () => {
const { data, error } = await supabase.rpc('saldos_por_cuenta');
if (error) throw error;
return data || [];
},
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
const { data: cashRegisters = [] } = useQuery({
queryKey: ['cashRegisters'],
queryFn: () => base44.entities.CashRegister.list('-register_date'),
});

// Vale térmico 80mm de un egreso (tipoVale, no 'tipo': ese campo ya es la categoría)
const valeDeEgreso = (e) => ({
  tipoVale: 'EGRESO',
  id: e.id,
  folio: folioVale(e),
  fecha: e.expense_date,
  concepto: e.concept,
  monto: e.amount,
  cuenta_nombre: cuentaLegible(e),
  forma_pago: e.payment_method,
  referencia: e.reference_number,
  categoria_nombre: e.category,
  autorizado_por: e.created_by || me?.email || '',
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
onSuccess: (result, data) => {
queryClient.invalidateQueries({ queryKey: ['expenses'] });
queryClient.invalidateQueries({ queryKey: ['saldosPorCuenta'] });
setShowForm(false);
setEditingExpense(null);
// Impresión automática del vale SOLO al crear (no al editar)
imprimirVale(valeDeEgreso({ ...data, id: result?.id, folio: result?.folio }));
},
onError: (err) => toast.error(`Operación fallida: ${err?.message || 'error desconocido'}`),
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
queryClient.invalidateQueries({ queryKey: ['saldosPorCuenta'] });
setShowForm(false);
setEditingExpense(null);
},
onError: (err) => toast.error(`Operación fallida: ${err?.message || 'error desconocido'}`),
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
queryClient.invalidateQueries({ queryKey: ['saldosPorCuenta'] });
queryClient.invalidateQueries({ queryKey: ['payments'] });
},
onError: (err) => toast.error(`Operación fallida: ${err?.message || 'error desconocido'}`),
});

const handleSubmit = (data) => {
if (editingExpense) {
updateMutation.mutate({ id: editingExpense.id, data, prev: editingExpense });
} else {
createMutation.mutate(data);
}
};

// Ventana de corrección (espejo del candado en BD, regla 28/ago/26):
// egresos generados por módulos (nómina/CxP/corte/fondos) intocables; no-admin solo
// puede corregir el MISMO DÍA y solo lo que él capturó (así el corte diario no cambia).
// OJO: 'egresos' es el source_module de los gastos capturados A MANO en este módulo
// (lo pone el propio formulario), así que NO cuenta como "de módulo".
// Los traspasos (is_transfer) también cuentan como "de módulo" aunque los viejos
// traigan source_module 'egresos': se administran desde Tesorería, no aquí.
const esDeModulo = (e) => (!!e.source_module && e.source_module !== 'egresos') || !!e.payroll_item_id || !!e.cxp_payment_id || !!e.is_transfer;

// Storno self-service: quien capturó el egreso (o un admin) puede reversarlo
// CUALQUIER día, con motivo obligatorio — el reverso es contra-movimiento, no borrado.
const reversedIds = new Set(expenses.filter(e => e.reversal_of).map(e => e.reversal_of));
const puedeReversar = (e) => !esDeModulo(e) && !e.reversal_of && !reversedIds.has(e.id)
  && (isAdmin || e.created_by === me?.email);

const reversarMutation = useMutation({
  mutationFn: async ({ expense, motivo }) => {
    const { data, error } = await supabase.rpc('reversar_egreso', { p_id: expense.id, p_motivo: motivo });
    if (error) throw new Error(error.message);
    return data;
  },
  onSuccess: async (newId, { expense, motivo }) => {
    await logAudit({
      action: 'REVERSO', module: 'Egresos', entity_type: 'Expense',
      entity_id: newId, entity_name: expense.concept,
      previousValue: expense, monetaryDiff: expense.amount || 0,
      details: `Reverso (storno) del egreso ${expense.id}. Motivo: ${motivo}`,
    });
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    queryClient.invalidateQueries({ queryKey: ['saldosPorCuenta'] });
    toast.success('Reverso registrado — el egreso queda anulado por contra-movimiento');
    setReversarInfo(null); setMotivoReverso('');
  },
  onError: (e) => toast.error(`No se pudo reversar: ${e.message}`),
});

const puedeCorregir = (e) => {
  if (esDeModulo(e)) return false;
  if (isAdmin) return true;
  const creado = e.created_date || e.created_at;
  return !!creado && new Date(creado).toDateString() === new Date().toDateString()
    && e.created_by === me?.email;
};

const handleEdit = (expense) => {
setEditingExpense(expense);
setShowForm(true);
};

const handleDelete = (expense) => {
confirmar('¿Estás seguro de eliminar este gasto?').then((ok) => { if (!ok) return;
deleteMutation.mutate(expense);
});
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

// Fusión Fase 1: total de gastos reales = expenses sin traspasos (gastos de Fondos incluidos)
const totalExpenses = expenses.filter(e => !e.is_transfer).reduce((sum, e) => sum + (e.amount || 0), 0);

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
{expense.reversal_of && <Badge className="bg-gray-200 text-gray-700">↩ Reverso</Badge>}
{reversedIds.has(expense.id) && <Badge className="bg-red-100 text-red-700">Reversado</Badge>}
{!expense.reversal_of && (
<Button variant="ghost" size="icon" onClick={() => imprimirVale(valeDeEgreso(expense))} title="Imprimir vale (térmica 80mm)">
<Printer className="w-4 h-4 text-gray-600" />
</Button>
)}
{puedeReversar(expense) && (
<Button variant="ghost" size="icon" title="Reversar (contra-movimiento con motivo)"
  onClick={() => { setReversarInfo(expense); setMotivoReverso(''); }}>
<Undo2 className="w-4 h-4 text-amber-700" />
</Button>
)}
{puedeCorregir(expense) && (
<Button variant="ghost" size="icon" onClick={() => handleEdit(expense)} title="Corregir (ventana del mismo día)">
<Edit className="w-4 h-4 text-blue-600" />
</Button>
)}
{canDelete && puedeCorregir(expense) && (
<Button variant="ghost" size="icon" onClick={() => handleDelete(expense)}>
<Trash2 className="w-4 h-4 text-red-600" />
</Button>
)}
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

{/* Modal de reverso: motivo obligatorio, contra-movimiento (storno) */}
{reversarInfo && (
<div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
  <Card className="w-full max-w-md">
    <CardHeader>
      <CardTitle className="text-base">Reversar egreso</CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      <p className="text-sm text-gray-700">
        <span className="font-semibold">{reversarInfo.concept}</span> — {formatCurrency(reversarInfo.amount)}
      </p>
      <p className="text-xs text-gray-500">
        Se creará un contra-movimiento por el monto contrario. El egreso original no se
        borra: queda marcado como reversado y la caja se corrige al instante.
      </p>
      <textarea
        className="w-full border rounded-md p-2 text-sm min-h-[70px]"
        placeholder="Motivo del reverso (obligatorio, mínimo 5 caracteres)"
        value={motivoReverso}
        onChange={(e) => setMotivoReverso(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={reversarMutation.isPending}
          onClick={() => { setReversarInfo(null); setMotivoReverso(''); }}>Cancelar</Button>
        <Button className="bg-amber-600 hover:bg-amber-700"
          disabled={reversarMutation.isPending || motivoReverso.trim().length < 5}
          onClick={() => reversarMutation.mutate({ expense: reversarInfo, motivo: motivoReverso.trim() })}>
          {reversarMutation.isPending ? 'Reversando…' : 'Confirmar reverso'}
        </Button>
      </div>
    </CardContent>
  </Card>
</div>
)}
</div>
);
}
