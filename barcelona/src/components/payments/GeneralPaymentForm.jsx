import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign } from 'lucide-react';

export default function GeneralPaymentForm({ payment, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState(payment || {
    concept: '',
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'efectivo',
    bank_name: '',
    reference_number: '',
    category: 'otros',
    notes: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Preserve the date as selected by adding time to avoid timezone shift
    const dateWithTime = formData.payment_date + 'T12:00:00';
    onSubmit({
      ...formData,
      payment_date: dateWithTime,
      amount: parseFloat(formData.amount)
    });
  };

  return (
    <Card className="border-blue-200 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100">
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-blue-600" />
          {payment ? 'Editar Pago General' : 'Registrar Pago General'}
        </CardTitle>
      </CardHeader>
      <CardContent className="mt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Categoría */}
            <div>
              <Label htmlFor="category">Categoría</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="renta_cancha">Renta de Cancha</SelectItem>
                  <SelectItem value="patrocinio">Patrocinio</SelectItem>
                  <SelectItem value="otros">Otros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Renta de Cancha - montos rápidos */}
            {formData.category === 'renta_cancha' && (
              <div className="md:col-span-2">
                <Label className="text-orange-700 font-semibold">Renta de Cancha — Monto rápido</Label>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {[350, 400, 700, 1000, 1200, 1500, 2000].map((v) => (
                    <Button
                      key={v}
                      type="button"
                      variant={Number(formData.amount) === v ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFormData({ ...formData, amount: String(v) })}
                      className={Number(formData.amount) === v ? 'bg-orange-500 hover:bg-orange-600 border-orange-500' : 'border-orange-300 text-orange-700 hover:bg-orange-50'}
                    >
                      ${v.toLocaleString()}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Monto */}
            <div>
              <Label htmlFor="amount">Monto *</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">$</span>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    onWheel={e => e.currentTarget.blur()}
                    placeholder="0.00"
                    required
                    className="pl-7"
                  />
                </div>
                {formData.category !== 'patrocinio' && formData.category !== 'otros' && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setFormData({ ...formData, amount: '960' })}
                      className="whitespace-nowrap"
                    >
                      $960
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setFormData({ ...formData, amount: '2000' })}
                      className="whitespace-nowrap"
                    >
                      $2,000
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Fecha */}
            <div>
              <Label htmlFor="payment_date">Fecha de Pago *</Label>
              <Input
                id="payment_date"
                type="date"
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                required
              />
            </div>

            {/* Método de Pago */}
            <div>
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

            {/* Banco (si es transferencia) */}
            {formData.payment_method === 'transferencia' && (
              <div>
                <Label htmlFor="bank_name">Banco</Label>
                <Select
                  value={formData.bank_name}
                  onValueChange={(value) => setFormData({ ...formData, bank_name: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona banco" />
                  </SelectTrigger>
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

            {/* Número de Referencia */}
            {(formData.payment_method === 'tarjeta' || formData.payment_method === 'transferencia') && (
              <div>
                <Label htmlFor="reference_number">Número de Referencia</Label>
                <Input
                  id="reference_number"
                  value={formData.reference_number}
                  onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                  placeholder="Número de comprobante"
                />
              </div>
            )}

            {/* Notas */}
            <div className="md:col-span-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Información adicional..."
                rows={3}
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700"
              disabled={isLoading}
            >
              {isLoading ? 'Guardando...' : payment ? 'Actualizar' : 'Registrar'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}