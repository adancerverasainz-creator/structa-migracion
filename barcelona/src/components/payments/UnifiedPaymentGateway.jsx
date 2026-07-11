import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Save, DollarSign, Trophy, ShoppingBag, Calendar, ClipboardList, Wallet, Calculator, Receipt, AlertCircle, CheckCircle2, ArrowLeftRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '../lib/formatCurrency';
import { calculateIVA, calculateSuggestedSurcharge } from '../../lib/financeEngine';

/**
 * UnifiedPaymentGateway — Motor de Procesamiento de Pagos del ERP
 * ────────────────────────────────────────────────────────────────
 * Punto único de entrada para TODOS los tipos de pago del sistema.
 * 
 * Configuraciones soportadas:
 *   - mensualidad: monto, mes, recargos, factura
 *   - inscripcion / reinscripcion: monto, temporada, factura
 *   - uniformes: monto, artículos (si aplica), factura
 *   - torneo: monto, info del torneo, factura
 *   - pago_general: distribución automática entre múltiples deudas
 */

const SURCHARGE_OPTIONS = [0, 50, 100, 200];
const amountsByType = {
  mensualidad: [2000, 1700, 1300, 1200, 1100, 1080, 960, 900, 800, 600, 400, 300, 0],
  inscripcion: [2100, 1890, 1300, 650],
  reinscripcion: [1800, 1620],
};
const uniformItems = [
  { id: 'playera_porra', label: 'Playera porra', price: 300 },
  { id: 'playera_jugador', label: 'Playera jugador', price: 310 },
  { id: 'short_juego', label: 'Short juego blanco', price: 210 },
  { id: 'playera_entrenamiento', label: 'Playera entrenamiento', price: 280 },
  { id: 'calcetas_verdes', label: 'Calcetas verdes', price: 60 },
  { id: 'calcetas_negras', label: 'Calcetas negras', price: 65 },
  { id: 'short_negro', label: 'Short negro entrenamiento', price: 195 },
  { id: 'kit_completo', label: 'Kit completo', price: 2200 },
];
const PAYMENT_METHODS = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta', label: 'Tarjeta Bancaria' },
  { value: 'transferencia', label: 'Transferencia' },
];
const BANKS = ['BBVA', 'MP', 'NU', 'OpenBank', 'MercadoPagoBIA'];

export default function UnifiedPaymentGateway({ config, onSubmit, onCancel, isLoading }) {
  const { type, player, debtInfo } = config;
  const {
    pendingAmount = 0,
    month = '',
    existingPaymentId = null,
    tournamentId = null,
    registrationFee = 0,
    totalPaid = 0,
    tournamentName = '',
    payment_type: itemPaymentType = 'mensualidad',
  } = debtInfo || {};

  // ── State ──
  const [amount, setAmount] = useState(pendingAmount || '');
  const [surcharge, setSurcharge] = useState(0);
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [bankName, setBankName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [requiresInvoice, setRequiresInvoice] = useState(false);

  // ── Uniforms state ──
  const [selectedUniformItems, setSelectedUniformItems] = useState({});
  const [montoRecibido, setMontoRecibido] = useState('');

  const totalUniforme = uniformItems.reduce((sum, i) => sum + i.price * (selectedUniformItems[i.id] || 0), 0);
  const hasUniformItems = Object.keys(selectedUniformItems).length > 0;
  const montoRecibidoNum = parseFloat(montoRecibido) || 0;
  const cambioUniforme = montoRecibidoNum > totalUniforme ? montoRecibidoNum - totalUniforme : 0;
  const pendienteUniforme = montoRecibidoNum < totalUniforme ? totalUniforme - montoRecibidoNum : 0;

  const addUniformItem = (item) => {
    setSelectedUniformItems(prev => {
      const updated = { ...prev, [item.id]: (prev[item.id] || 0) + 1 };
      const total = uniformItems.reduce((sum, i) => sum + i.price * (updated[i.id] || 0), 0);
      const autoNotes = uniformItems.filter(i => updated[i.id] > 0).map(i => `${i.label}${updated[i.id] > 1 ? ` x${updated[i.id]}` : ''}`).join(', ');
      setAmount(total);
      setNotes(autoNotes);
      return updated;
    });
  };

  const removeUniformItem = (item) => {
    setSelectedUniformItems(prev => {
      if (!prev[item.id]) return prev;
      const updated = { ...prev, [item.id]: prev[item.id] - 1 };
      if (updated[item.id] === 0) delete updated[item.id];
      const total = uniformItems.reduce((sum, i) => sum + i.price * (updated[i.id] || 0), 0);
      const autoNotes = uniformItems.filter(i => updated[i.id] > 0).map(i => `${i.label}${updated[i.id] > 1 ? ` x${updated[i.id]}` : ''}`).join(', ');
      setAmount(total);
      setNotes(autoNotes);
      return updated;
    });
  };

  // Auto-calculate suggested surcharge for mensualidad
  useEffect(() => {
    if ((type || itemPaymentType) === 'mensualidad' && month) {
      const { suggestedSurcharge, isLate, monthsLate } = calculateSuggestedSurcharge(month, paymentDate);
      // Only auto-set if surcharge hasn't been manually changed
      if (isLate && surcharge === 0) {
        setSurcharge(suggestedSurcharge);
      }
    }
  }, [month, paymentDate, type, itemPaymentType]);

  // ── Derivations ──
  const baseAmount = parseFloat(amount) || 0;
  const isMensualidad = (type || itemPaymentType) === 'mensualidad';
  const isTorneo = type === 'torneo';
  const isUniformes = (type || itemPaymentType) === 'uniformes';
  
  const { suggestedSurcharge, isLate, monthsLate } = 
    isMensualidad ? calculateSuggestedSurcharge(month, paymentDate) : { suggestedSurcharge: 0, isLate: false, monthsLate: 0 };

  const effectiveAmount = isUniformes ? (montoRecibidoNum > 0 ? Math.min(montoRecibidoNum, totalUniforme) : totalUniforme) : baseAmount;
  const subtotal = isTorneo ? baseAmount : (isUniformes ? effectiveAmount : (baseAmount + surcharge));
  const { iva, total } = calculateIVA(subtotal, requiresInvoice);

  const isValid = isUniformes ? (totalUniforme > 0) : (baseAmount > 0 && !isNaN(baseAmount));
  const isFullyPaid = isTorneo 
    ? ((totalPaid + total) >= registrationFee)
    : isUniformes
      ? (pendienteUniforme <= 0)
      : (baseAmount >= pendingAmount);
  const isPartial = isUniformes ? (montoRecibidoNum > 0 && pendienteUniforme > 0) : (baseAmount > 0 && !isFullyPaid);

  // ── Labels ──
  const typeLabel = {
    mensualidad: 'Mensualidad',
    uniformes: 'Uniformes',
    inscripcion: 'Inscripción',
    reinscripcion: 'Reinscripción',
    torneo: 'Torneo',
  }[type || itemPaymentType] || (type || itemPaymentType);

  // Color variants (hardcoded for Tailwind purging)
  const colors = isTorneo ? {
    border: 'border-purple-200',
    bg: 'bg-purple-50',
    text: 'text-purple-600',
    btn: 'bg-purple-600 hover:bg-purple-700',
    btnOutline: 'bg-purple-600 hover:bg-purple-700',
    ring: 'text-purple-600 focus:ring-purple-500',
  } : isUniformes ? {
    border: 'border-yellow-200',
    bg: 'bg-yellow-50',
    text: 'text-yellow-600',
    btn: 'bg-yellow-600 hover:bg-yellow-700',
    btnOutline: 'bg-yellow-600 hover:bg-yellow-700',
    ring: 'text-yellow-600 focus:ring-yellow-500',
  } : {
    border: 'border-green-200',
    bg: 'bg-green-50',
    text: 'text-green-600',
    btn: 'bg-green-600 hover:bg-green-700',
    btnOutline: 'bg-green-600 hover:bg-green-700',
    ring: 'text-green-600 focus:ring-green-500',
  };

  // ── Submit ──
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isValid) return;

    // Build auto-notes
    let autoNote = notes || '';
    if (isMensualidad && surcharge > 0 && !autoNote.includes('Recargo')) {
      autoNote = autoNote ? `${autoNote} | Recargo: ${formatCurrency(surcharge)}` : `Recargo: ${formatCurrency(surcharge)}`;
    }
    if (requiresInvoice && !autoNote.includes('IVA')) {
      autoNote = autoNote ? `${autoNote} | IVA 16% incluido: ${formatCurrency(iva)}` : `IVA 16% incluido: ${formatCurrency(iva)}`;
    }

    if (isTorneo) {
      const remaining = registrationFee - (totalPaid + total);
      if (!autoNote) {
        autoNote = remaining > 0
          ? `Abono a torneo ${tournamentName} — quedan ${formatCurrency(remaining)} pendientes`
          : `Pago completo torneo ${tournamentName}`;
      }
      onSubmit({
        type: 'tournament',
        player_id: player.id,
        tournament_id: tournamentId,
        amount: registrationFee,
        paid_amount: total,
        payment_date: paymentDate + 'T12:00:00',
        payment_method: paymentMethod,
        bank_name: bankName,
        reference_number: referenceNumber,
        notes: autoNote,
        status: remaining <= 0 ? 'pagado' : 'abono',
      });
    } else if (isUniformes) {
      const pagoReal = montoRecibidoNum > 0 ? Math.min(montoRecibidoNum, totalUniforme) : totalUniforme;
      const esParcial = pendienteUniforme > 0;
      const uniformNote = autoNote + (esParcial ? ` | Pendiente: $${pendienteUniforme}` : '');
      onSubmit({
        type: 'regular',
        player_id: player.id,
        amount: pagoReal,
        surcharge: 0,
        payment_date: paymentDate + 'T12:00:00',
        month: 'uniformes',
        payment_method: paymentMethod,
        bank_name: bankName,
        reference_number: referenceNumber,
        notes: uniformNote,
        status: esParcial ? 'pendiente' : 'pagado',
        payment_type: 'uniformes',
        existingPaymentId: existingPaymentId || null,
      });
    } else {
      const remaining = pendingAmount - baseAmount;

      onSubmit({
        type: 'regular',
        player_id: player.id,
        amount: total,
        surcharge,
        payment_date: paymentDate + 'T12:00:00',
        month: month || '',
        payment_method: paymentMethod,
        bank_name: bankName,
        reference_number: referenceNumber,
        notes: autoNote,
        status: remaining <= 0 ? 'pagado' : 'pendiente',
        payment_type: itemPaymentType || type || 'mensualidad',
        existingPaymentId: existingPaymentId || null,
      });
    }
  };

  // ── Render ──
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className={`w-full max-w-md shadow-2xl border-2 ${colors.border} max-h-[90vh] overflow-y-auto`}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              {isTorneo ? <Trophy className={`w-5 h-5 ${colors.text}`} /> : isUniformes ? <ShoppingBag className={`w-5 h-5 ${colors.text}`} /> : <DollarSign className={`w-5 h-5 ${colors.text}`} />}
              {isTorneo ? 'Registrar Pago — Torneo' : isUniformes ? 'Registrar Venta — Uniformes' : 'Registrar Abono'}
            </span>
            <Button variant="ghost" size="icon" onClick={onCancel}><X className="w-5 h-5" /></Button>
          </CardTitle>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {/* Player + Debt Info */}
            <div className={`p-3 ${colors.bg} rounded-lg border ${colors.border}`}>
              <p className="font-semibold text-gray-900">{player.full_name}</p>
              <p className="text-sm text-gray-500">{player.parent_name} · {player.category || ''}</p>
              <div className="flex justify-between mt-2 text-sm">
                <span className="text-gray-600">
                  {isTorneo ? (
                    <span className="flex items-center gap-1">
                      <Trophy className="w-3.5 h-3.5 text-purple-500" />
                      {tournamentName}
                    </span>
                  ) : isUniformes ? (
                    <span className="flex items-center gap-1">
                      <ShoppingBag className="w-3.5 h-3.5 text-yellow-600" />
                      Uniformes {existingPaymentId ? '(Pendiente)' : '(Nueva venta)'}
                    </span>
                  ) : (
                    `${typeLabel} — ${month}`
                  )}
                </span>
                {isTorneo ? (
                  <span className="font-bold text-purple-600">
                    Cuota: {formatCurrency(registrationFee)}{totalPaid > 0 ? ` · Pagado: ${formatCurrency(totalPaid)}` : ''}
                  </span>
                ) : isUniformes && existingPaymentId ? (
                  <span className="font-bold text-red-600">Adeuda: {formatCurrency(pendingAmount)}</span>
                ) : !isUniformes ? (
                  <span className="font-bold text-red-600">Adeuda: {formatCurrency(pendingAmount)}</span>
                ) : null}
              </div>
              {isTorneo && (
                <div className="mt-1 text-right">
                  <span className="text-sm font-bold text-purple-600">Adeuda: {formatCurrency(registrationFee - totalPaid)}</span>
                </div>
              )}
            </div>

            {/* Amount / Uniform Grid */}
            <div className="space-y-2">
              <Label>{isUniformes ? 'Artículos *' : 'Monto a abonar *'}</Label>
              {isUniformes ? (
                <div className="space-y-4">
                  {/* Grid de artículos */}
                  <div className="grid grid-cols-2 gap-2">
                    {uniformItems.map((item) => {
                      const qty = selectedUniformItems[item.id] || 0;
                      return (
                        <div key={item.id} className={`flex flex-col rounded-xl border-2 overflow-hidden transition-all ${
                          qty > 0 ? 'border-yellow-500 shadow-md' : 'border-gray-200'
                        }`}>
                          <button
                            type="button"
                            onClick={() => addUniformItem(item)}
                            className={`flex flex-col items-start px-3 py-2.5 text-sm font-medium transition-colors w-full ${
                              qty > 0 ? 'bg-yellow-600 text-white' : 'bg-white text-gray-700 hover:bg-yellow-50'
                            }`}
                          >
                            <span className="leading-tight">{item.label}</span>
                            <span className={`text-base font-bold mt-0.5 ${qty > 0 ? 'text-white' : 'text-yellow-700'}`}>{formatCurrency(item.price)}</span>
                          </button>
                          {qty > 0 && (
                            <div className="flex items-center justify-between bg-yellow-700 px-3 py-1">
                              <button type="button" onClick={() => removeUniformItem(item)} className="text-white font-bold text-lg leading-none hover:text-red-300">−</button>
                              <span className="text-white font-bold text-sm">x{qty}</span>
                              <button type="button" onClick={() => addUniformItem(item)} className="text-white font-bold text-lg leading-none hover:text-yellow-200">+</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Panel de cobro — solo aparece si hay artículos seleccionados */}
                  {hasUniformItems && (
                    <div className="rounded-2xl border-2 border-gray-200 overflow-hidden shadow-sm">
                      {/* Encabezado */}
                      <div className="bg-gray-800 px-4 py-3 flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 text-white" />
                        <span className="text-white font-semibold text-sm tracking-wide">Resumen de venta</span>
                      </div>

                      {/* Artículos seleccionados */}
                      <div className="bg-white px-4 py-3 space-y-1.5">
                        {uniformItems.filter(i => selectedUniformItems[i.id] > 0).map(i => (
                          <div key={i.id} className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">• {i.label} {selectedUniformItems[i.id] > 1 ? <span className="font-bold">x{selectedUniformItems[i.id]}</span> : ''}</span>
                            <span className="font-medium text-gray-800">{formatCurrency(i.price * selectedUniformItems[i.id])}</span>
                          </div>
                        ))}
                      </div>

                      {/* Total */}
                      <div className="border-t-2 border-dashed border-gray-200 px-4 py-3 bg-gray-50 flex justify-between items-center">
                        <span className="text-sm font-semibold text-gray-700">TOTAL A COBRAR</span>
                        <span className="text-xl font-bold text-gray-900">{formatCurrency(totalUniforme)}</span>
                      </div>

                      {/* Campo monto recibido */}
                      <div className="border-t border-gray-200 px-4 py-3 bg-white space-y-2">
                       <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Monto recibido del cliente</Label>
                       <div className="relative">
                         <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">$</span>
                          <Input
                            type="number"
                            min="0"
                            placeholder="0.00"
                            value={montoRecibido}
                            onChange={e => setMontoRecibido(e.target.value)}
                            onWheel={e => e.currentTarget.blur()}
                            className="pl-7 text-xl font-bold h-12 border-2 focus:border-yellow-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>
                      </div>

                      {/* Resultado del cobro */}
                      {montoRecibidoNum > 0 && (
                        <div className="border-t-2 border-dashed border-gray-200 px-4 py-3">
                          {pendienteUniforme > 0 ? (
                            <div className="flex items-start gap-3 p-3 bg-red-50 rounded-xl border border-red-200">
                              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-red-700">Pago incompleto</p>
                                <p className="text-xs text-red-500 mt-0.5">El saldo pendiente se registrará en morosos</p>
                                <div className="flex justify-between items-center mt-2">
                                  <span className="text-xs text-red-600 font-medium">Faltante</span>
                                  <span className="text-lg font-bold text-red-700">{formatCurrency(pendienteUniforme)}</span>
                                </div>
                              </div>
                            </div>
                          ) : cambioUniforme > 0 ? (
                            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-200">
                              <div className="flex items-center gap-2">
                                <ArrowLeftRight className="w-4 h-4 text-blue-500" />
                                <span className="text-sm font-semibold text-blue-700">Cambio a entregar</span>
                              </div>
                              <span className="text-xl font-bold text-blue-700">{formatCurrency(cambioUniforme)}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl border border-green-200">
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                              <span className="text-sm font-semibold text-green-700">Pago exacto — ¡Completo!</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex gap-2 mb-2 flex-wrap">
                    {isTorneo ? (
                      <>
                        <Button type="button" size="sm"
                          variant={baseAmount === (registrationFee - totalPaid) ? 'default' : 'outline'}
                          className={baseAmount === (registrationFee - totalPaid) ? colors.btnOutline : ''}
                          onClick={() => setAmount(registrationFee - totalPaid)}>
                          Total ({formatCurrency(registrationFee - totalPaid)})
                        </Button>
                        <Button type="button" size="sm" variant="outline"
                          onClick={() => setAmount(Math.floor((registrationFee - totalPaid) / 2))}>
                          Mitad ({formatCurrency(Math.floor((registrationFee - totalPaid) / 2))})
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button type="button" size="sm"
                          variant={baseAmount === pendingAmount ? 'default' : 'outline'}
                          className={baseAmount === pendingAmount ? colors.btnOutline : ''}
                          onClick={() => setAmount(pendingAmount)}>
                          Total ({formatCurrency(pendingAmount)})
                        </Button>
                        {pendingAmount > 0 && (
                          <Button type="button" size="sm" variant="outline"
                            onClick={() => setAmount(Math.floor(pendingAmount / 2))}>
                            Mitad ({formatCurrency(Math.floor(pendingAmount / 2))})
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                  {((amountsByType[itemPaymentType || type] || amountsByType.mensualidad).length > 0) && (
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
                      {(amountsByType[itemPaymentType || type] || amountsByType.mensualidad).map((value) => (
                        <Button
                          key={value}
                          type="button"
                          variant={baseAmount === value ? "default" : "outline"}
                          size="sm"
                          onClick={() => setAmount(value)}
                          className={`text-xs ${baseAmount === value ? colors.btnOutline : ''}`}
                        >
                          {formatCurrency(value)}
                        </Button>
                      ))}
                    </div>
                  )}
                  <Input
                    type="number"
                    min="1"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="font-bold text-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    required
                  />
                  {isPartial && (
                    <p className="text-xs text-orange-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Abono parcial — quedará pendiente
                    </p>
                  )}
                  {isFullyPaid && baseAmount > 0 && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Pago completo
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Surcharge — only for mensualidad */}
            {isMensualidad && (
              <div className="space-y-2">
                <Label>
                  Recargos
                  {isLate && (
                    <Badge className="ml-2 bg-orange-100 text-orange-700 text-xs">
                      {monthsLate} {monthsLate === 1 ? 'mes' : 'meses'} de atraso
                    </Badge>
                  )}
                </Label>
                <div className="flex gap-2">
                  {SURCHARGE_OPTIONS.map((value) => (
                    <Button
                      key={value}
                      type="button"
                      variant={surcharge === value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSurcharge(value)}
                      className={surcharge === value ? 'bg-orange-600 hover:bg-orange-700' : ''}
                    >
                      {formatCurrency(value)}
                    </Button>
                  ))}
                </div>
                {surcharge > 0 && (
                  <p className="text-sm font-semibold text-orange-600">
                    Recargo: {formatCurrency(surcharge)}
                    {isLate && suggestedSurcharge === surcharge && ' (Sugerido automático)'}
                  </p>
                )}
              </div>
            )}

            {/* Date */}
            <div className="space-y-2">
              <Label>Fecha *</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                required
              />
            </div>

            {/* Invoice */}
            <div className="space-y-3 p-3 bg-gray-50 rounded-lg border">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requiresInvoice}
                  onChange={e => setRequiresInvoice(e.target.checked)}
                  className={`w-4 h-4 rounded border-gray-300 ${colors.ring}`}
                />
                <Receipt className={`w-4 h-4 ${colors.text}`} />
                <span className="text-sm font-medium">¿Requiere factura?</span>
              </label>
              {requiresInvoice && (
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
                    <span className={`font-bold ${colors.text}`}>{formatCurrency(total)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label>Método de pago *</Label>
              <Select value={paymentMethod} onValueChange={v => { setPaymentMethod(v); setBankName(''); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {paymentMethod === 'transferencia' && (
              <div className="space-y-2">
                <Label>Banco *</Label>
                <Select value={bankName} onValueChange={setBankName}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar banco" /></SelectTrigger>
                  <SelectContent>
                    {BANKS.map(b => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(paymentMethod === 'tarjeta' || paymentMethod === 'transferencia') && (
              <div className="space-y-2">
                <Label>Referencia</Label>
                <Input value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} placeholder="Número de referencia" />
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notas</Label>
              <textarea
                className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-600 ${isUniformes ? 'bg-gray-50 text-gray-600' : ''}`}
                rows="2"
                value={notes}
                onChange={e => !isUniformes && setNotes(e.target.value)}
                placeholder={isUniformes ? 'Se llena automáticamente con los artículos seleccionados' : 'Agregar notas sobre este abono...'}
                readOnly={isUniformes}
              />
            </div>
          </CardContent>

          <CardFooter className="flex justify-between border-t pt-4">
            <div>
              {baseAmount > 0 && (
                <span className={`text-sm font-semibold ${isFullyPaid ? 'text-green-600' : 'text-orange-600'}`}>
                  {isUniformes ? (isFullyPaid ? 'Pago completo' : 'Pago parcial') : (isFullyPaid ? 'Liquida la deuda' : 'Abono parcial')}
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>Cancelar</Button>
              <Button type="submit" disabled={isLoading || !isValid} className={colors.btn}>
                <Save className="w-4 h-4 mr-2" />
                Guardar {isTorneo ? 'Pago' : isUniformes ? 'Venta' : 'Abono'}
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}