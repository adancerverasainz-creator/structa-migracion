import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Wallet, Trash2, DollarSign, TrendingDown, TrendingUp, ArrowUpCircle, ArrowDownCircle, Edit, Search, ArrowRightLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import ExpenseForm from '../components/expenses/ExpenseForm';
import { formatCurrency } from '../components/lib/formatCurrency';
import TraspasoModal from '../components/fondos/TraspasoModal';

export default function Fondos() {
  const [showForm, setShowForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showTraspasoModal, setShowTraspasoModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [editingCashRegister, setEditingCashRegister] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    cash_amount: '',
    register_date: new Date().toISOString().split('T')[0],
    notes: '',
    source: 'Corte de caja'
  });

  const queryClient = useQueryClient();

  const { data: cashRegisters = [], isLoading } = useQuery({
    queryKey: ['cashRegisters'],
    queryFn: () => base44.entities.CashRegister.list('-register_date'),
  });

  // Fusión Fase 1 (2026-07-13): los gastos de Fondos viven en expenses con account='Fondos'

  // Para saldos de bancos en modal de traspaso
  const { data: allPayments = [] } = useQuery({
    queryKey: ['allPaymentsForFondos'],
    queryFn: async () => {
      const [p, gp, tp, lp] = await Promise.all([
        base44.entities.Payment.list(null, 10000),
        base44.entities.GeneralPayment.list(null, 10000),
        base44.entities.TournamentPayment.list(null, 10000),
        base44.entities.LeaguePayment.list(null, 10000),
      ]);
      return [...p, ...gp, ...tp, ...lp];
    },
  });
  const { data: allExpenses = [] } = useQuery({
    queryKey: ['allExpensesForFondos'],
    queryFn: () => base44.entities.Expense.list(null, 10000),
  });
  const expenses = allExpenses.filter(e => e.account === 'Fondos');

  const bankBalances = ['BBVA', 'MP', 'NU', 'OpenBank'].reduce((acc, bank) => {
    const inc = allPayments.filter(p => p.payment_method === 'transferencia' && p.bank_name === bank).reduce((s, p) => s + (p.amount || 0), 0);
    const out = allExpenses.filter(e => e.payment_method === 'transferencia' && e.account === bank).reduce((s, e) => s + (e.amount || 0), 0);
    acc[bank] = inc - out;
    return acc;
  }, {});

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.CashRegister.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashRegisters'] });
      setShowForm(false);
      setEditingCashRegister(null);
      setFormData({
        cash_amount: '',
        register_date: new Date().toISOString().split('T')[0],
        notes: '',
        source: 'Corte de caja'
      });
    },
  });

  const updateCashRegisterMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CashRegister.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashRegisters'] });
      setShowForm(false);
      setEditingCashRegister(null);
      setFormData({
        cash_amount: '',
        register_date: new Date().toISOString().split('T')[0],
        notes: '',
        source: 'Corte de caja'
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (register) => {
      const user = await base44.auth.me();
      await base44.entities.AuditLog.create({
        action: 'ELIMINACIÓN',
        module: 'Fondos',
        entity_type: 'CashRegister',
        entity_id: register.id,
        entity_name: `Efectivo: $${register.cash_amount}`,
        user_email: user.email,
        details: `Fecha: ${register.register_date}, Origen: ${register.source}`
      });
      return base44.entities.CashRegister.delete(register.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashRegisters'] });
    },
  });

  const createExpenseMutation = useMutation({
    mutationFn: (data) => base44.entities.Expense.create({ ...data, payment_method: 'transferencia', account: 'Fondos', source_module: 'fondos', is_transfer: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allExpensesForFondos'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setShowExpenseForm(false);
      setEditingExpense(null);
    },
  });

  const updateExpenseMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Expense.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allExpensesForFondos'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setShowExpenseForm(false);
      setEditingExpense(null);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      cash_amount: parseFloat(formData.cash_amount) || 0
    };
    
    if (editingCashRegister && editingCashRegister.id) {
      updateCashRegisterMutation.mutate({ id: editingCashRegister.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEditCashRegister = (cashRegister) => {
    setEditingCashRegister(cashRegister);
    setFormData({
      cash_amount: cashRegister.cash_amount.toString(),
      register_date: cashRegister.register_date,
      notes: cashRegister.notes || '',
      source: cashRegister.source || 'Corte de caja'
    });
    setShowForm(true);
  };

  const handleEditTransaction = (transaction) => {
    if (transaction.type === 'ingreso') {
      handleEditCashRegister(transaction.record);
    } else {
      setEditingExpense(transaction.record);
      setShowExpenseForm(true);
    }
  };

  const deleteExpenseMutation = useMutation({
    mutationFn: async (expense) => {
      const user = await base44.auth.me();
      await base44.entities.AuditLog.create({
        action: 'ELIMINACIÓN',
        module: 'Fondos',
        entity_type: 'Expense',
        entity_id: expense.id,
        entity_name: expense.concept,
        user_email: user.email,
        details: `Monto: $${expense.amount}, Categoría: ${expense.category}`
      });
      return base44.entities.Expense.delete(expense.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allExpensesForFondos'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });

  const handleDelete = (transaction) => {
    if (confirm('¿Estás seguro de eliminar este registro?')) {
      if (transaction.type === 'ingreso') {
        deleteMutation.mutate(transaction.record);
      } else {
        deleteExpenseMutation.mutate(transaction.record);
      }
    }
  };

  const handleExpenseSubmit = (data) => {
    if (editingExpense) {
      updateExpenseMutation.mutate({ id: editingExpense.id, data });
    } else {
      createExpenseMutation.mutate(data);
    }
  };

  const totalCash = cashRegisters.reduce((sum, r) => sum + (r.cash_amount || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const balance = totalCash - totalExpenses;

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

  // Combine and sort transactions
  const allTransactions = [
    ...cashRegisters.map(r => ({
      id: r.id,
      type: 'ingreso',
      amount: r.cash_amount,
      date: r.register_date,
      description: r.source || 'Efectivo',
      notes: r.notes,
      record: r
    })),
    ...expenses.map(e => ({
      id: e.id,
      type: 'egreso',
      amount: e.amount,
      date: e.expense_date,
      description: e.concept,
      category: e.category,
      notes: e.notes,
      record: e
    }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  // Filter transactions based on search term
  const transactions = allTransactions.filter(transaction => {
    const searchLower = searchTerm.toLowerCase();
    const matchesDescription = transaction.description?.toLowerCase().includes(searchLower);
    const matchesNotes = transaction.notes?.toLowerCase().includes(searchLower);
    const matchesDate = transaction.date?.includes(searchTerm);
    const matchesAmount = transaction.amount?.toString().includes(searchTerm);
    const matchesType = transaction.type?.toLowerCase().includes(searchLower);
    const matchesCategory = transaction.category && categoryLabels[transaction.category]?.toLowerCase().includes(searchLower);
    return matchesDescription || matchesNotes || matchesDate || matchesAmount || matchesType || matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Wallet className="w-8 h-8 text-green-600" />
            Fondos
          </h1>
          <p className="text-gray-600 mt-1">Efectivo del corte de caja</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => setShowTraspasoModal(true)}
            className="bg-[#004d98] hover:bg-[#003d78] gap-1.5"
            size="sm"
          >
            <ArrowRightLeft className="w-4 h-4" />
            Traspaso Banco → Efectivo
          </Button>
          <Button
            onClick={() => {
              setEditingCashRegister(null);
              setFormData({
                cash_amount: '',
                register_date: new Date().toISOString().split('T')[0],
                notes: '',
                source: 'Corte de caja'
              });
              setShowForm(true);
            }}
            className="bg-green-600 hover:bg-green-700"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Agregar Efectivo
          </Button>
          <Button
            onClick={() => {
              setEditingExpense(null);
              setShowExpenseForm(true);
            }}
            className="bg-red-600 hover:bg-red-700"
            size="sm"
          >
            <TrendingDown className="w-4 h-4 mr-2" />
            Registrar Gasto
          </Button>
        </div>
      </div>

      {showTraspasoModal && (
        <TraspasoModal
          onClose={() => setShowTraspasoModal(false)}
          bankBalances={bankBalances}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Ingresos</p>
                <p className="text-3xl font-bold text-green-600">{formatCurrency(totalCash)}</p>
              </div>
              <TrendingUp className="w-12 h-12 text-green-600 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-red-200 bg-gradient-to-br from-red-50 to-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Egresos</p>
                <p className="text-3xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
              </div>
              <TrendingDown className="w-12 h-12 text-red-600 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card className={`border-2 ${balance >= 0 ? 'border-blue-200 bg-gradient-to-br from-blue-50 to-white' : 'border-orange-200 bg-gradient-to-br from-orange-50 to-white'}`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Balance</p>
                <p className={`text-3xl font-bold ${balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{formatCurrency(balance)}</p>
              </div>
              <DollarSign className={`w-12 h-12 ${balance >= 0 ? 'text-blue-600' : 'text-orange-600'} opacity-20`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {showForm && (
        <Card className="shadow-lg border-2 border-green-200">
          <CardHeader>
            <CardTitle>{editingCashRegister ? 'Editar Efectivo en Caja' : 'Agregar Efectivo a Caja'}</CardTitle>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cash_amount">Monto de Efectivo *</Label>
                  <Input
                    id="cash_amount"
                    type="number"
                    step="0.01"
                    value={formData.cash_amount}
                    onChange={(e) => setFormData({ ...formData, cash_amount: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register_date">Fecha *</Label>
                  <Input
                    id="register_date"
                    type="date"
                    value={formData.register_date}
                    onChange={(e) => setFormData({ ...formData, register_date: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="source">Origen</Label>
                <Input
                  id="source"
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  placeholder="Ej: Corte de caja"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Notas adicionales..."
                />
              </div>
            </CardContent>
            <div className="p-6 pt-0 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => {
                setShowForm(false);
                setEditingCashRegister(null);
              }}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={createMutation.isPending || updateCashRegisterMutation.isPending}>
                {(createMutation.isPending || updateCashRegisterMutation.isPending) ? 'Guardando...' : (editingCashRegister ? 'Actualizar' : 'Guardar')}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {showExpenseForm && (
        <ExpenseForm
          expense={editingExpense}
          onSubmit={handleExpenseSubmit}
          onCancel={() => {
            setShowExpenseForm(false);
            setEditingExpense(null);
          }}
          isLoading={createExpenseMutation.isPending || updateExpenseMutation.isPending}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Historial de Movimientos
          </CardTitle>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar por descripción, fecha, monto o categoría..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              <p className="mt-2 text-gray-600">Cargando registros...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-12 text-center">
              <Wallet className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay movimientos</h3>
              <p className="text-gray-600 mb-4">Comienza agregando ingresos o gastos</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((transaction) => (
                <div
                  key={`${transaction.type}-${transaction.id}`}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`p-2 rounded-lg ${transaction.type === 'ingreso' ? 'bg-green-100' : 'bg-red-100'}`}>
                      {transaction.type === 'ingreso' ? (
                        <ArrowUpCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <ArrowDownCircle className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{transaction.description}</h3>
                        <Badge variant={transaction.type === 'ingreso' ? 'default' : 'destructive'} className={transaction.type === 'ingreso' ? 'bg-green-600' : ''}>
                          {transaction.type === 'ingreso' ? 'Ingreso' : 'Egreso'}
                        </Badge>
                        {transaction.category && (
                          <Badge variant="outline">{categoryLabels[transaction.category]}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <span>{format(new Date(transaction.date + 'T00:00:00'), "d 'de' MMMM, yyyy", { locale: es })}</span>
                        {transaction.notes && <span>• {transaction.notes}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-2xl font-bold ${transaction.type === 'ingreso' ? 'text-green-600' : 'text-red-600'}`}>
                      {transaction.type === 'ingreso' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => handleEditTransaction(transaction)}>
                      <Edit className="w-4 h-4 text-blue-600" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(transaction)}>
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}