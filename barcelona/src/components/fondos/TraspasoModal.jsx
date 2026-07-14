import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowRightLeft, Building2, Wallet, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../lib/formatCurrency';

const BANKS = [
  { value: 'BBVA', label: 'BBVA' },
  { value: 'MP', label: 'Mercado Pago (MP)' },
  { value: 'NU', label: 'Nu' },
  { value: 'OpenBank', label: 'OpenBank' },
];

export default function TraspasoModal({ onClose, bankBalances }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    bank: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    reference: '',
    notes: '',
  });
  const [error, setError] = useState('');

  const selectedBalance = form.bank ? (bankBalances[form.bank] ?? 0) : null;
  const amount = parseFloat(form.amount) || 0;

  const mutation = useMutation({
    mutationFn: async () => {
      const user = await base44.auth.me();

      // 1) Registrar egreso del banco (sale del banco)
      const expenseRecord = await base44.entities.Expense.create({
        concept: `Traspaso a Caja Fondos desde ${form.bank}`,
        amount: amount,
        expense_date: form.date,
        category: 'otros',
        payment_method: 'transferencia',
        account: form.bank,
        is_transfer: true,
        transfer_to: 'Fondos',
        source_module: 'fondos',
        notes: form.notes || `Referencia: ${form.reference || 'N/A'}`,
      });

      // 2) Registrar ingreso en Caja Fondos (entra como efectivo)
      const cashRecord = await base44.entities.CashRegister.create({
        cash_amount: amount,
        register_date: form.date,
        source: `Traspaso desde ${form.bank}`,
        notes: form.notes || `Referencia: ${form.reference || 'N/A'}`,
      });

      // 3) Auditoría
      await base44.entities.AuditLog.create({
        action: 'CREACIÓN',
        module: 'Fondos',
        entity_type: 'Traspaso',
        entity_id: cashRecord.id,
        entity_name: `Traspaso ${form.bank} → Efectivo: ${formatCurrency(amount)}`,
        user_email: user.email,
        details: `Banco origen: ${form.bank} | Monto: ${formatCurrency(amount)} | Fecha: ${form.date}${form.reference ? ' | Ref: ' + form.reference : ''}`,
        monetary_diff: 0,
      });

      return { expenseRecord, cashRecord };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashRegisters'] });
      queryClient.invalidateQueries({ queryKey: ['cajaPrincipalExpenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      onClose();
    },
    onError: (err) => {
      setError(err.message || 'Error al procesar el traspaso');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!form.bank) return setError('Selecciona un banco de origen.');
    if (amount <= 0) return setError('El monto debe ser mayor a $0.');
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <Card className="w-full max-w-lg shadow-2xl border-0 my-auto">
        {/* Header */}
        <CardHeader className="bg-gradient-to-r from-[#1a1a2e] to-[#004d98] text-white rounded-t-xl pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <ArrowRightLeft className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-white text-lg">Traspaso Banco → Efectivo</CardTitle>
              <p className="text-white/70 text-sm mt-0.5">Registra salida del banco e ingreso en Caja Fondos</p>
            </div>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-5 pt-6">

            {/* Flujo visual */}
            <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="flex flex-col items-center gap-1">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-xs font-semibold text-blue-700">{form.bank || 'Banco'}</span>
                {form.bank && selectedBalance !== null && (
                  <span className="text-[10px] text-gray-500">Saldo: {formatCurrency(selectedBalance)}</span>
                )}
              </div>
              <div className="flex-1 flex items-center justify-center gap-1">
                <div className="h-px flex-1 border-t-2 border-dashed border-gray-300" />
                <ArrowRightLeft className="w-4 h-4 text-gray-400" />
                <div className="h-px flex-1 border-t-2 border-dashed border-gray-300" />
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Wallet className="w-5 h-5 text-green-600" />
                </div>
                <span className="text-xs font-semibold text-green-700">Caja Fondos</span>
                <span className="text-[10px] text-gray-500">Efectivo</span>
              </div>
            </div>

            {/* Banco origen */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Banco Origen *</Label>
              <Select value={form.bank} onValueChange={(v) => setForm({ ...form, bank: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar banco..." />
                </SelectTrigger>
                <SelectContent>
                  {BANKS.map(b => (
                    <SelectItem key={b.value} value={b.value}>
                      <div className="flex items-center justify-between gap-8 w-full">
                        <span>{b.label}</span>
                        {bankBalances && bankBalances[b.value] !== undefined && (
                          <span className={`text-xs font-medium ${bankBalances[b.value] >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {formatCurrency(bankBalances[b.value])}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Monto */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Monto a Traspasar *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  className="pl-7"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                />
              </div>
              {form.bank && selectedBalance !== null && amount > 0 && (
                <p className={`text-xs ${amount > selectedBalance ? 'text-red-500' : 'text-green-600'}`}>
                  {amount > selectedBalance
                    ? `⚠ El monto excede el saldo disponible (${formatCurrency(selectedBalance)})`
                    : `Saldo restante en ${form.bank}: ${formatCurrency(selectedBalance - amount)}`
                  }
                </p>
              )}
            </div>

            {/* Fecha y Referencia */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Fecha *</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Referencia</Label>
                <Input
                  placeholder="Folio, comprobante..."
                  value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                />
              </div>
            </div>

            {/* Notas */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Notas</Label>
              <Textarea
                placeholder="Observaciones adicionales..."
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            {/* Resumen */}
            {form.bank && amount > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm space-y-1">
                <p className="font-semibold text-blue-800 mb-2">Resumen del traspaso:</p>
                <p className="text-blue-700">• Egreso en <strong>{form.bank}</strong>: <strong>-{formatCurrency(amount)}</strong></p>
                <p className="text-green-700">• Ingreso en <strong>Caja Fondos (Efectivo)</strong>: <strong>+{formatCurrency(amount)}</strong></p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
          </CardContent>

          <div className="px-6 pb-6 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-[#004d98] hover:bg-[#003d78] gap-2"
              disabled={mutation.isPending}
            >
              <ArrowRightLeft className="w-4 h-4" />
              {mutation.isPending ? 'Procesando...' : 'Confirmar Traspaso'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}