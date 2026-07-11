import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Save, DollarSign, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '../lib/formatCurrency';

export default function AbonoDeudaModal({ debtInfo, onSubmit, onCancel, isLoading }) {
  const { player, pendingAmount, month, payment_type, existingPaymentId } = debtInfo;

  const [formData, setFormData] = useState({
    amount: pendingAmount || '',
    surcharge: 0,
    payment_date: format(new Date(), 'yyyy-MM-dd'),
    payment_method: 'efectivo',
    bank_name: '',
    reference_number: '',
    notes: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const baseAmount = parseFloat(formData.amount);
    if (!baseAmount || baseAmount <= 0) return;
    const surchargeAmount = parseFloat(formData.surcharge) || 0;
    const subtotal = baseAmount + surchargeAmount;
    const requiresInvoice = formData.requires_invoice || false;
    const ivaAmount = requiresInvoice ? subtotal * 0.16 : 0;
    const totalAmount = subtotal + ivaAmount;
    const remaining = pendingAmount - baseAmount;
    const isUniformes = payment_type === 'uniformes';
    // Auto generar nota descriptiva
    let autoNote = '';
    if (formData.notes) {
      autoNote = formData.notes;
    } else if (isUniformes) {
      autoNote = remaining > 0 ? `Pendiente: $${remaining.toFixed(0)}` : 'Pago total de uniformes';
    }
    if (surchargeAmount > 0) {
      autoNote = (autoNote ? autoNote + ' | ' : '') + `Recargo: ${formatCurrency(surchargeAmount)}`;
    }
    if (requiresInvoice) {
      autoNote = (autoNote ? autoNote + ' | ' : '') + `IVA 16% incluido: ${formatCurrency(ivaAmount)}`;
    }
    onSubmit({
      player_id: player.id,
      amount: totalAmount,
      surcharge: surchargeAmount,
      payment_date: formData.payment_date + 'T12:00:00',
      month: isUniformes ? 'uniformes' : (month || ''),
      payment_method: formData.payment_method,
      bank_name: formData.bank_name || '',
      reference_number: formData.reference_number || '',
      notes: autoNote,
      status: remaining <= 0 ? 'pagado' : 'pendiente',
      payment_type: payment_type || 'mensualidad',
      existingPaymentId: existingPaymentId || null,
    });
  };

  const typeLabel = {
    mensualidad: 'Mensualidad',
    uniformes: 'Uniformes',
    inscripcion: 'Inscripción',
    reinscripcion: 'Reinscripción',
  }[payment_type] || payment_type;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-2 border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Registrar Abono
            </span>
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <X className="w-5 h-5" />
            </Button>
          </CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {/* Info del deudor */}
            <div className="p-3 bg-gray-50 rounded-lg border">
              <p className="font-semibold text-gray-900">{player.full_name}</p>
              <p className="text-sm text-gray-500">{player.parent_name} · {player.category || ''}</p>
              <div className="flex justify-between mt-2 text-sm">
                <span className="text-gray-600">{typeLabel} — {month !== 'uniformes' ? month : 'Uniformes'}</span>
                <span className="font-bold text-red-600">Adeuda: {formatCurrency(pendingAmount)}</span>
              </div>
            </div>

            {/* Monto */}
            <div className="space-y-2">
              <Label>Monto a abonar *</Label>
              <div className="flex gap-2 mb-2">
                <Button
                  type="button"
                  size="sm"
                  variant={parseFloat(formData.amount) === pendingAmount ? 'default' : 'outline'}
                  className={parseFloat(formData.amount) === pendingAmount ? 'bg-green-600 hover:bg-green-700' : ''}
                  onClick={() => setFormData({ ...formData, amount: pendingAmount })}
                >
                  Total ({formatCurrency(pendingAmount)})
                </Button>
                {pendingAmount > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setFormData({ ...formData, amount: Math.floor(pendingAmount / 2) })}
                  >
                    Mitad ({formatCurrency(Math.floor(pendingAmount / 2))})
                  </Button>
                )}
              </div>
              <Input
                type="number"
                min="1"
                max={pendingAmount}
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                required
              />
              {parseFloat(formData.amount) > 0 && parseFloat(formData.amount) < pendingAmount && (
                <p className="text-xs text-orange-600">⚠️ Abono parcial — quedará pendiente: {formatCurrency(pendingAmount - parseFloat(formData.amount))}</p>
              )}
            </div>

            {/* Recargos — solo para mensualidad */}
            {(payment_type || 'mensualidad') === 'mensualidad' && (
              <div className="space-y-2">
                <Label>Recargos</Label>
                <div className="flex gap-2">
                  {[0, 50, 100, 200].map((value) => (
                    <Button
                      key={value}
                      type="button"
                      variant={(formData.surcharge || 0) === value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFormData({ ...formData, surcharge: value })}
                      className={(formData.surcharge || 0) === value ? 'bg-orange-600 hover:bg-orange-700' : ''}
                    >
                      {formatCurrency(value)}
                    </Button>
                  ))}
                </div>
                {(formData.surcharge || 0) > 0 && (
                  <p className="text-sm font-semibold text-orange-600">Recargo: {formatCurrency(formData.surcharge || 0)}</p>
                )}
              </div>
            )}

            {/* Fecha */}
            <div className="space-y-2">
              <Label>Fecha *</Label>
              <Input
                type="date"
                value={formData.payment_date}
                onChange={e => setFormData({ ...formData, payment_date: e.target.value })}
                required
              />
            </div>

            {/* ¿Requiere factura? */}
            <div className="space-y-3 p-3 bg-gray-50 rounded-lg border">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.requires_invoice || false}
                  onChange={e => setFormData({ ...formData, requires_invoice: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <Receipt className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium">¿Requiere factura?</span>
              </label>
              {formData.requires_invoice && (() => {
                const subtotal = (parseFloat(formData.amount) || 0) + (parseFloat(formData.surcharge) || 0);
                const iva = subtotal * 0.16;
                const total = subtotal + iva;
                return (
                  <div className="bg-white rounded-lg border p-3 space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-medium">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">IVA (16%)</span>
                      <span className="font-medium text-orange-600">{formatCurrency(iva)}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t pt-1.5">
                      <span className="font-semibold text-gray-800">Total</span>
                      <span className="font-bold text-blue-600">{formatCurrency(total)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Método de pago */}
            <div className="space-y-2">
              <Label>Método de pago *</Label>
              <Select value={formData.payment_method} onValueChange={v => setFormData({ ...formData, payment_method: v, bank_name: '' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="tarjeta">Tarjeta Bancaria</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.payment_method === 'transferencia' && (
              <div className="space-y-2">
                <Label>Banco *</Label>
                <Select value={formData.bank_name} onValueChange={v => setFormData({ ...formData, bank_name: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar banco" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BBVA">BBVA</SelectItem>
                    <SelectItem value="MP">MP</SelectItem>
                    <SelectItem value="NU">NU</SelectItem>
                    <SelectItem value="OpenBank">OpenBank</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {(formData.payment_method === 'tarjeta' || formData.payment_method === 'transferencia') && (
              <div className="space-y-2">
                <Label>Referencia</Label>
                <Input
                  value={formData.reference_number}
                  onChange={e => setFormData({ ...formData, reference_number: e.target.value })}
                  placeholder="Número de referencia"
                />
              </div>
            )}

            {/* Notas */}
            <div className="space-y-2">
              <Label>Notas</Label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                rows="3"
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Agregar notas sobre este abono..."
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-green-600 hover:bg-green-700">
              <Save className="w-4 h-4 mr-2" />
              Guardar Abono
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}