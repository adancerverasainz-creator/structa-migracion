import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Save, DollarSign, Calculator, Wallet, AlertCircle, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '../lib/formatCurrency';

export default function PagoGeneralModal({ player, debts, onConfirm, onCancel, isLoading }) {
  const [totalReceived, setTotalReceived] = useState('');
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [bankName, setBankName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [requiresInvoice, setRequiresInvoice] = useState(false);

  // Build flat list of all debt items with section context
  const allDebtItems = useMemo(() => {
    const items = [];
    debts.sections.forEach(section => {
      section.items.forEach((item, idx) => {
        if (item.pending > 0) {
          items.push({
            sectionId: section.id,
            sectionTitle: section.title,
            ...item,
          });
        }
      });
    });
    return items;
  }, [debts]);

  // Allocation state: how much to pay for each debt item
  const [allocations, setAllocations] = useState({});

  // Auto-distribute when totalReceived changes (smallest debts first)
  useEffect(() => {
    const received = parseFloat(totalReceived) || 0;
    if (received <= 0) {
      setAllocations({});
      return;
    }

    // Sort by pending amount (smallest first)
    const sorted = [...allDebtItems].sort((a, b) => a.pending - b.pending);
    const newAllocs = {};
    let remaining = received;

    for (const item of sorted) {
      const key = `${item.sectionId}-${item.label}`;
      if (remaining <= 0) {
        newAllocs[key] = 0;
      } else if (remaining >= item.pending) {
        newAllocs[key] = item.pending;
        remaining -= item.pending;
      } else {
        newAllocs[key] = remaining;
        remaining = 0;
      }
    }

    setAllocations(newAllocs);
  }, [totalReceived, allDebtItems]);

  const totalAllocated = Object.values(allocations).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
  const totalPending = allDebtItems.reduce((sum, i) => sum + i.pending, 0);
  const remainingToAllocate = Math.max(0, (parseFloat(totalReceived) || 0) - totalAllocated);
  const exceedsPending = totalAllocated > totalPending;

  const handleAllocationChange = (key, value) => {
    setAllocations(prev => ({ ...prev, [key]: parseFloat(value) || 0 }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const received = parseFloat(totalReceived) || 0;
    if (received <= 0) return;

    // Build payment records for each allocation > 0
    const payments = [];
    for (const item of allDebtItems) {
      const key = `${item.sectionId}-${item.label}`;
      const alloc = parseFloat(allocations[key]) || 0;
      if (alloc <= 0) continue;

      const remaining = item.pending - alloc;

      const ivaMultiplier = requiresInvoice ? 1.16 : 1;
      const totalAlloc = alloc * ivaMultiplier;
      const ivaForItem = alloc * 0.16 * (requiresInvoice ? 1 : 0);
      
      let itemNote = notes;
      if (!itemNote) {
        if (item.isTournament) {
          itemNote = remaining > 0
            ? `Abono a torneo ${item.tournament_name} — quedan ${formatCurrency(remaining)} pendientes`
            : `Pago completo torneo ${item.tournament_name}`;
        } else {
          itemNote = remaining > 0 ? `Pendiente: $${remaining.toFixed(0)}` : 'Pago total';
        }
      }
      if (requiresInvoice && ivaForItem > 0) {
        itemNote = itemNote + ` | IVA 16% incluido: ${formatCurrency(ivaForItem)}`;
      }

      if (item.isTournament) {
        payments.push({
          type: 'tournament',
          player_id: player.id,
          tournament_id: item.tournament_id,
          amount: item.registration_fee,
          paid_amount: totalAlloc,
          payment_date: paymentDate + 'T12:00:00',
          payment_method: paymentMethod,
          bank_name: bankName || '',
          reference_number: referenceNumber || '',
          notes: itemNote,
          status: remaining <= 0 ? 'pagado' : 'abono',
        });
      } else {
        const isUniformes = item.payment_type === 'uniformes';
        payments.push({
          type: 'regular',
          player_id: player.id,
          amount: totalAlloc,
          surcharge: 0,
          payment_date: paymentDate + 'T12:00:00',
          month: isUniformes ? 'uniformes' : (item.month || ''),
          payment_method: paymentMethod,
          bank_name: bankName || '',
          reference_number: referenceNumber || '',
          notes: itemNote,
          status: remaining <= 0 ? 'pagado' : 'pendiente',
          payment_type: item.payment_type || 'mensualidad',
          existingPaymentId: item.existingPaymentId || null,
        });
      }
    }

    if (payments.length === 0) return;
    const ivaTotal = requiresInvoice ? totalAllocated * 0.16 : 0;
    onConfirm({
      payments,
      summary: {
        totalReceived: received,
        totalAllocated,
        remaining: remainingToAllocate,
        requiresInvoice,
        ivaTotal,
      }
    });
  };

  if (!debts || allDebtItems.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">Este jugador no tiene deudas pendientes.</p>
            <Button variant="outline" onClick={onCancel} className="mt-4">Cerrar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-2xl border-2 border-blue-300 max-h-[90vh] overflow-y-auto">
        <CardHeader className="sticky top-0 bg-white z-10 border-b">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-blue-600" />
              Pago General — Distribuir Monto
            </span>
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <X className="w-5 h-5" />
            </Button>
          </CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-5 pt-4">
            {/* Player Info */}
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="font-semibold text-gray-900">{player.full_name}</p>
              <p className="text-sm text-gray-600">{player.parent_name} · {player.category || ''}</p>
              <div className="flex justify-between mt-2 text-sm">
                <span className="text-gray-600">Deuda total: {formatCurrency(totalPending)}</span>
              </div>
            </div>

            {/* Amount Received */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-2">
                <Label className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  {requiresInvoice ? 'Subtotal (sin IVA) *' : 'Monto recibido del padre *'}
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={totalReceived}
                  onChange={e => setTotalReceived(e.target.value)}
                  placeholder="Ej: 2000"
                  className="text-lg font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  required
                />
                <div className="flex gap-2">
                  {[500, 1000, 2000, 3000, 5000].map(n => (
                    <Button
                      key={n}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => setTotalReceived(String(n))}
                    >
                      ${n}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Fecha *</Label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Payment Method */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Método de pago *</Label>
                <Select value={paymentMethod} onValueChange={v => { setPaymentMethod(v); setBankName(''); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="tarjeta">Tarjeta Bancaria</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {paymentMethod === 'transferencia' && (
                <div className="space-y-2">
                  <Label>Banco *</Label>
                  <Select value={bankName} onValueChange={setBankName}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar banco" /></SelectTrigger>
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
            </div>

            {/* ¿Requiere factura? */}
            <div className="space-y-3 p-3 bg-gray-50 rounded-lg border">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requiresInvoice}
                  onChange={e => setRequiresInvoice(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <Receipt className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium">¿Requiere factura?</span>
              </label>
              {requiresInvoice && (() => {
                const subtotal = parseFloat(totalReceived) || 0;
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
                      <span className="font-semibold text-gray-800">Total a pagar</span>
                      <span className="font-bold text-blue-600">{formatCurrency(total)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {(paymentMethod === 'tarjeta' || paymentMethod === 'transferencia') && (
              <div className="space-y-2">
                <Label>Referencia</Label>
                <Input
                  value={referenceNumber}
                  onChange={e => setReferenceNumber(e.target.value)}
                  placeholder="Número de referencia"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Notas generales</Label>
              <Input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Notas opcionales para todos los pagos..."
              />
            </div>

            {/* Distribution Summary */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium">Distribución automática</span>
                <Badge variant="outline" className="text-xs">Menor deuda primero</Badge>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-600">
                  Asignado: <strong className="text-blue-600">{formatCurrency(totalAllocated)}</strong>
                </span>
                {remainingToAllocate > 0 && (
                  <span className="text-orange-600">
                    Sin asignar: <strong>{formatCurrency(remainingToAllocate)}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Debt Items with Allocation */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                Desglose de deudas y asignación
              </Label>
              {allDebtItems.map((item) => {
                const key = `${item.sectionId}-${item.label}`;
                const alloc = parseFloat(allocations[key]) || 0;
                const isFullyPaid = alloc >= item.pending;
                const isPartial = alloc > 0 && alloc < item.pending;
                return (
                  <div
                    key={key}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                      isFullyPaid ? 'bg-green-50 border-green-200' :
                      isPartial ? 'bg-orange-50 border-orange-200' :
                      'bg-white border-gray-200'
                    }`}
                  >
                    <Badge variant="outline" className="text-xs shrink-0 w-24 justify-center">
                      {item.sectionTitle}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.label}</p>
                      <p className="text-xs text-gray-500">Adeuda: {formatCurrency(item.pending)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-400">$</span>
                      <Input
                        type="number"
                        min="0"
                        max={item.pending}
                        value={allocations[key] ?? 0}
                        onChange={e => handleAllocationChange(key, e.target.value)}
                        className="w-24 text-sm text-right font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-xs text-blue-600 h-7 px-2"
                        onClick={() => handleAllocationChange(key, item.pending)}
                      >
                        Total
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Warning */}
            {exceedsPending && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <p className="text-sm text-red-700">
                  La distribución asignada (${totalAllocated.toFixed(0)}) supera la deuda total (${totalPending.toFixed(0)}). Revisa las cantidades.
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between border-t pt-4">
            <div className="text-sm text-gray-500">
              {totalAllocated > 0 && (
                <span>Se crearán registros de pago individuales para cada asignación</span>
              )}
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isLoading || totalAllocated <= 0 || exceedsPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Save className="w-4 h-4 mr-2" />
                Registrar {formatCurrency(requiresInvoice ? totalAllocated * 1.16 : totalAllocated)} en {Object.values(allocations).filter(v => parseFloat(v) > 0).length} pagos
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}