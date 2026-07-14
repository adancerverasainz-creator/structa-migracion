import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { X, Save, Wallet } from 'lucide-react';
import { format } from 'date-fns';

export default function ExpenseForm({ expense, onSubmit, onCancel, isLoading }) {
  const { data: payments = [] } = useQuery({
    queryKey: ['payments'],
    queryFn: () => base44.entities.Payment.list(),
  });

  const { data: tournamentPayments = [] } = useQuery({
    queryKey: ['tournamentPayments'],
    queryFn: () => base44.entities.TournamentPayment.list(),
  });

  const { data: leaguePayments = [] } = useQuery({
    queryKey: ['leaguePayments'],
    queryFn: () => base44.entities.LeaguePayment.list(),
  });

  const { data: generalPayments = [] } = useQuery({
    queryKey: ['generalPayments'],
    queryFn: () => base44.entities.GeneralPayment.list(),
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => base44.entities.Expense.list(),
  });

  // Calcular saldos
  const calculateAccountBalances = () => {
    const allPayments = [...payments, ...tournamentPayments, ...leaguePayments, ...generalPayments];
    const allExpenses = expenses;

    const balances = {
      efectivo: 0,
      BBVA: 0,
      MP: 0,
      NU: 0,
      OpenBank: 0,
      MercadoPagoBIA: 0,
    };

    allPayments.forEach(p => {
      if (p.payment_method === 'efectivo') {
        balances.efectivo += p.amount || 0;
      } else if (p.payment_method === 'transferencia' && p.bank_name) {
        balances[p.bank_name] = (balances[p.bank_name] || 0) + (p.amount || 0);
      } else if (p.payment_method === 'tarjeta' && p.bank_name) {
        balances[p.bank_name] = (balances[p.bank_name] || 0) + (p.amount || 0);
      }
    });

    allExpenses.forEach(e => {
      if (e.payment_method === 'efectivo') {
        balances.efectivo -= e.amount || 0;
      } else if (e.payment_method === 'transferencia' && e.account) {
        balances[e.account] = (balances[e.account] || 0) - (e.amount || 0);
      }
    });

    return balances;
  };

  const accountBalances = calculateAccountBalances();
  const [formData, setFormData] = useState(expense || {
    concept: '',
    amount: '',
    expense_date: format(new Date(), 'yyyy-MM-dd'),
    category: 'otros',
    payment_method: 'efectivo',
    account: '',
    notes: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      amount: parseFloat(formData.amount) || 0,
      source_module: formData.source_module || 'egresos',
    });
  };

  return (
    <Card className="shadow-lg border-2 border-red-200">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{expense ? 'Editar Gasto' : 'Registrar Nuevo Gasto'}</span>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-5 h-5" />
          </Button>
        </CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {/* Saldos disponibles */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-3">
              <Wallet className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-blue-800">Saldos Disponibles</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
              <div>
                <p className="text-gray-600">Efectivo</p>
                <p className={`font-bold ${accountBalances.efectivo >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  ${accountBalances.efectivo.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-gray-600">BBVA</p>
                <p className={`font-bold ${accountBalances.BBVA >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  ${accountBalances.BBVA.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-gray-600">MP</p>
                <p className={`font-bold ${accountBalances.MP >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  ${accountBalances.MP.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-gray-600">NU</p>
                <p className={`font-bold ${accountBalances.NU >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  ${accountBalances.NU.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-gray-600">OpenBank</p>
                <p className={`font-bold ${accountBalances.OpenBank >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  ${accountBalances.OpenBank.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-gray-600">MP BIA</p>
                <p className={`font-bold ${accountBalances.MercadoPagoBIA >= 0 ? 'text-teal-600' : 'text-red-600'}`}>
                  ${(accountBalances.MercadoPagoBIA || 0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="concept">Concepto *</Label>
              <Input
                id="concept"
                value={formData.concept}
                onChange={(e) => setFormData({ ...formData, concept: e.target.value })}
                placeholder="Descripción del gasto"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Monto *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">$</span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  onWheel={e => e.currentTarget.blur()}
                  className="pl-7"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense_date">Fecha *</Label>
              <Input
                id="expense_date"
                type="date"
                value={formData.expense_date}
                onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Categoría *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nomina">Nómina</SelectItem>
                  <SelectItem value="bono_torneo">Bono Torneo</SelectItem>
                  <SelectItem value="viaticos">Viáticos</SelectItem>
                  <SelectItem value="hospedaje">Hospedaje</SelectItem>
                  <SelectItem value="transporte">Transporte</SelectItem>
                  <SelectItem value="equipamiento">Equipamiento</SelectItem>
                  <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                  <SelectItem value="arbitros">Árbitros</SelectItem>
                  <SelectItem value="intereses">Intereses</SelectItem>
                  <SelectItem value="retorno_inversion">Retorno de Inversión</SelectItem>
                  <SelectItem value="copa">Copa</SelectItem>
                  <SelectItem value="torneo">Torneo</SelectItem>
                  <SelectItem value="liga">Liga</SelectItem>
                  <SelectItem value="otros">Otros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_method">Método de Pago *</Label>
              <Select
                value={formData.payment_method}
                onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="tarjeta">Tarjeta</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.payment_method === 'transferencia' && (
              <div className="space-y-2">
                <Label htmlFor="account">Cuenta</Label>
                <Select
                  value={formData.account}
                  onValueChange={(value) => setFormData({ ...formData, account: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BBVA">BBVA</SelectItem>
                    <SelectItem value="MP">MP</SelectItem>
                    <SelectItem value="NU">NU</SelectItem>
                    <SelectItem value="OpenBank">OpenBank</SelectItem>
                    <SelectItem value="MercadoPagoBIA">Mercado Pago BIA</SelectItem>
                    <SelectItem value="Efectivo">Efectivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notas adicionales..."
                rows={2}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading} className="bg-red-600 hover:bg-red-700">
            <Save className="w-4 h-4 mr-2" />
            {expense ? 'Actualizar' : 'Guardar'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}