import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { X, DollarSign, CheckCircle2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '../lib/formatCurrency';

export default function AbonoForm({ account, pendingAmount, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState({
    amount: '',
    payment_date: format(new Date(), 'yyyy-MM-dd'),
    payment_method: 'efectivo',
    cash_register: 'caja_chica',
    bank_name: '',
    reference_number: '',
    notes: '',
  });

  const amount = parseFloat(formData.amount) || 0;
  const isOverpay = amount > pendingAmount && amount > 0;
  const isExact = amount === pendingAmount && amount > 0;
  const isPartial = amount > 0 && amount < pendingAmount;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (amount <= 0) return;
    onSubmit({ ...formData, account_payable_id: account.id, amount });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl my-auto">

        {/* Header */}
        <div className="bg-gradient-to-r from-green-700 to-green-600 rounded-t-2xl px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">Registrar Abono</h2>
              <p className="text-white/70 text-sm truncate max-w-xs">{account.concept}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5">

            {/* Resumen de deuda */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <p className="text-xs text-red-500 font-semibold uppercase tracking-wide">Saldo Pendiente</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(pendingAmount)}</p>
              </div>
              <div className={`rounded-xl p-4 text-center border transition-all ${
                isExact ? 'bg-green-50 border-green-200' :
                isOverpay ? 'bg-orange-50 border-orange-200' :
                isPartial ? 'bg-amber-50 border-amber-200' :
                'bg-gray-50 border-gray-200'
              }`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Abono a Registrar</p>
                <p className={`text-2xl font-bold mt-1 ${
                  isExact ? 'text-green-600' : isOverpay ? 'text-orange-600' : isPartial ? 'text-amber-600' : 'text-gray-400'
                }`}>
                  {amount > 0 ? formatCurrency(amount) : '—'}
                </p>
              </div>
            </div>

            {/* Alerta de estado */}
            {isOverpay && (
              <div className="flex items-center gap-2 text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                El abono excede el saldo pendiente. Solo se aplicará {formatCurrency(pendingAmount)}.
              </div>
            )}
            {isExact && (
              <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                ¡Pago completo! La cuenta quedará saldada.
              </div>
            )}

            {/* Monto */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-gray-700">Monto del Abono *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">$</span>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={formData.amount}
                  onChange={e => setFormData({ ...formData, amount: e.target.value })}
                  onWheel={e => e.currentTarget.blur()}
                  placeholder="0.00"
                  className="pl-7 h-11 text-lg font-semibold"
                  required
                />
              </div>
              {/* Botón monto total */}
              <button
                type="button"
                onClick={() => setFormData({ ...formData, amount: String(pendingAmount) })}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline underline-offset-2"
              >
                Pagar monto completo ({formatCurrency(pendingAmount)})
              </button>
            </div>

            {/* Fecha y Método */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">Fecha *</Label>
                <Input
                  type="date"
                  value={formData.payment_date}
                  onChange={e => setFormData({ ...formData, payment_date: e.target.value })}
                  className="h-10"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">Método de Pago *</Label>
                <Select value={formData.payment_method} onValueChange={v => setFormData({ ...formData, payment_method: v, bank_name: '' })}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="tarjeta">Tarjeta</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Condicionales */}
            {formData.payment_method === 'efectivo' && (
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">Caja *</Label>
                <Select value={formData.cash_register} onValueChange={v => setFormData({ ...formData, cash_register: v })}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="caja_chica">Caja Chica (Egresos)</SelectItem>
                    <SelectItem value="caja_principal">Fondos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {formData.payment_method === 'transferencia' && (
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">Banco</Label>
                <Select value={formData.bank_name} onValueChange={v => setFormData({ ...formData, bank_name: v })}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Seleccionar banco" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BBVA">BBVA</SelectItem>
                    <SelectItem value="MP">MP</SelectItem>
                    <SelectItem value="NU">NU</SelectItem>
                    <SelectItem value="OpenBank">OpenBank</SelectItem>
                    <SelectItem value="MercadoPagoBIA">Mercado Pago BIA</SelectItem>
                    </SelectContent>
                    </Select>
                    </div>
                    )}

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-gray-700">Referencia / Comprobante</Label>
              <Input
                value={formData.reference_number}
                onChange={e => setFormData({ ...formData, reference_number: e.target.value })}
                placeholder="N° de comprobante o folio"
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-gray-700">Notas</Label>
              <Textarea
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notas adicionales..."
                rows={2}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || amount <= 0} className="bg-green-600 hover:bg-green-700 gap-2">
              <DollarSign className="w-4 h-4" />
              {isLoading ? 'Registrando...' : 'Registrar Abono'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}