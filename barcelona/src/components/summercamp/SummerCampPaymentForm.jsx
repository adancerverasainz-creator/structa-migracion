import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { X, Save, User, CreditCard, Tag, Calendar, Shirt, CheckSquare, Square } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '../lib/formatCurrency';

const WEEK_PRICE = 1200;
const UNIFORM_PRICE = 950;

export default function SummerCampPaymentForm({
  payment,
  players = [],
  externalPlayers = [],
  type = 'semana',
  onSubmit,
  onCancel,
  isLoading,
}) {
  const isEditing = !!payment?.id;

  // Participant state — unified
  // participantType: 'club' | 'external'
  const [participantType, setParticipantType] = useState(() => {
    if (payment?.external_player_id) return 'external';
    return 'club';
  });
  const [selectedPlayerId, setSelectedPlayerId] = useState(payment?.player_id || '');
  const [selectedExternalId, setSelectedExternalId] = useState(payment?.external_player_id || '');

  // Payment concept
  const [paymentType, setPaymentType] = useState(type === 'mes_completo' ? 'semana' : type);

  // Weeks — multi-select (only for 'semana')
  const [selectedWeeks, setSelectedWeeks] = useState(() => {
    if (isEditing && payment?.week_number) return [payment.week_number];
    if (type === 'mes_completo') return [1, 2, 3, 4];
    return [1];
  });

  const toggleWeek = (w) => {
    setSelectedWeeks(prev =>
      prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w].sort()
    );
  };

  // Financial
  const baseUnitPrice = paymentType === 'uniforme' ? UNIFORM_PRICE : WEEK_PRICE;
  const weekCount = paymentType === 'semana' ? Math.max(selectedWeeks.length, 1) : 1;
  const baseTotal = baseUnitPrice * weekCount;

  const [discount, setDiscount] = useState(parseFloat(payment?.discount) || 0);
  const [discountReason, setDiscountReason] = useState(payment?.discount_reason || '');
  const finalAmount = Math.max(0, baseTotal - (parseFloat(discount) || 0));

  // Other fields
  const [paymentDate, setPaymentDate] = useState(
    payment?.payment_date ? payment.payment_date.slice(0, 10) : format(new Date(), 'yyyy-MM-dd')
  );
  const [paymentMethod, setPaymentMethod] = useState(payment?.payment_method || 'efectivo');
  const [bankName, setBankName] = useState(payment?.bank_name || '');
  const [referenceNumber, setReferenceNumber] = useState(payment?.reference_number || '');
  const [status, setStatus] = useState(payment?.status || 'pagado');
  const [notes, setNotes] = useState(payment?.notes || '');

  const isTransfer = paymentMethod === 'transferencia';

  // Resolve participant name
  const getPlayerName = () => {
    if (participantType === 'external') {
      const ext = externalPlayers.find(e => e.id === selectedExternalId);
      return ext?.full_name || '';
    }
    const p = players.find(p => p.id === selectedPlayerId);
    return p?.full_name || '';
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const playerName = getPlayerName();
    const disc = parseFloat(discount) || 0;

    if (paymentType === 'semana' && selectedWeeks.length > 1 && !isEditing) {
      // Multiple weeks — create one record per week, discount on first week only
      const perWeekDiscount = disc; // applied only to first
      selectedWeeks.forEach((w, idx) => {
        const weekDisc = idx === 0 ? perWeekDiscount : 0;
        const weekAmount = Math.max(0, WEEK_PRICE - weekDisc);
        const isLast = idx === selectedWeeks.length - 1;
        onSubmit({
          player_id: participantType === 'club' ? selectedPlayerId : '',
          external_player_id: participantType === 'external' ? selectedExternalId : '',
          player_name: playerName,
          payment_type: 'semana',
          week_number: w,
          base_amount: WEEK_PRICE,
          discount: weekDisc,
          discount_reason: idx === 0 && weekDisc > 0 ? (discountReason || 'Múltiples semanas') : '',
          amount: weekAmount,
          payment_date: paymentDate,
          payment_method: paymentMethod,
          bank_name: bankName,
          reference_number: referenceNumber,
          status,
          notes: `${selectedWeeks.length === 4 ? 'Mes completo — ' : ''}${notes}`.trim(),
        }, isLast);
      });
    } else {
      onSubmit({
        player_id: participantType === 'club' ? selectedPlayerId : '',
        external_player_id: participantType === 'external' ? selectedExternalId : '',
        player_name: playerName,
        payment_type: paymentType,
        week_number: paymentType === 'semana' ? selectedWeeks[0] : null,
        base_amount: baseTotal,
        discount: disc,
        discount_reason: discountReason,
        amount: finalAmount,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        bank_name: bankName,
        reference_number: referenceNumber,
        status,
        notes,
      }, true);
    }
  };

  const hasParticipant = participantType === 'club' ? !!selectedPlayerId : !!selectedExternalId;
  const hasWeeks = paymentType !== 'semana' || selectedWeeks.length > 0;
  const isMonthComplete = paymentType === 'semana' && selectedWeeks.length === 4;

  const headerColor =
    paymentType === 'uniforme'
      ? 'bg-gradient-to-r from-orange-600 to-amber-500'
      : isMonthComplete
      ? 'bg-gradient-to-r from-emerald-600 to-teal-500'
      : 'bg-gradient-to-r from-sky-700 to-blue-600';

  const submitColor =
    paymentType === 'uniforme'
      ? 'bg-orange-600 hover:bg-orange-700'
      : isMonthComplete
      ? 'bg-emerald-600 hover:bg-emerald-700'
      : 'bg-sky-600 hover:bg-sky-700';

  const submitLabel = isLoading
    ? 'Guardando...'
    : isEditing
    ? 'Actualizar'
    : paymentType === 'semana' && selectedWeeks.length > 1
    ? `Registrar ${selectedWeeks.length} semanas (${formatCurrency(finalAmount)})`
    : 'Registrar Pago';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl my-auto">

        {/* Header */}
        <div className={`rounded-t-2xl px-6 py-5 flex items-center justify-between ${headerColor}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              {paymentType === 'uniforme' ? <Shirt className="w-5 h-5 text-white" /> : <Calendar className="w-5 h-5 text-white" />}
            </div>
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">
                {isEditing
                  ? 'Editar Registro'
                  : paymentType === 'uniforme'
                  ? 'Pack de Uniformes'
                  : isMonthComplete
                  ? 'Mes Completo (4 semanas)'
                  : selectedWeeks.length > 1
                  ? `${selectedWeeks.length} Semanas`
                  : 'Pago de Semana'}
              </h2>
              <p className="text-white/70 text-sm">Summer Camp 2026</p>
            </div>
          </div>
          <button type="button" onClick={onCancel} className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5">

            {/* ─── PARTICIPANTE ─── */}
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <User className="w-3.5 h-3.5" /> Participante
              </h3>

              {/* Toggle club / externo */}
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setParticipantType('club')}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm font-semibold transition-all ${
                    participantType === 'club'
                      ? 'bg-sky-600 text-white border-sky-600 shadow'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-sky-300'
                  }`}
                >
                  🏟️ Jugador del Club
                </button>
                <button
                  type="button"
                  onClick={() => setParticipantType('external')}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm font-semibold transition-all ${
                    participantType === 'external'
                      ? 'bg-violet-600 text-white border-violet-600 shadow'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-violet-300'
                  }`}
                >
                  👤 Jugador Externo
                </button>
              </div>

              {participantType === 'club' ? (
                <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Seleccionar jugador del club..." />
                  </SelectTrigger>
                  <SelectContent>
                    {players.filter(p => p.status === 'activo').map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name} — {p.category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={selectedExternalId} onValueChange={setSelectedExternalId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Seleccionar jugador externo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {externalPlayers.map(e => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.full_name}{e.category ? ` — ${e.category}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="border-t border-gray-100" />

            {/* ─── CONCEPTO ─── */}
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Tag className="w-3.5 h-3.5" /> Concepto
              </h3>
              <div className="space-y-3">
                {/* Tipo de cobro */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentType('semana')}
                    className={`flex-1 py-2.5 px-3 rounded-lg border text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                      paymentType === 'semana'
                        ? 'bg-sky-50 border-sky-400 text-sky-700'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-sky-200'
                    }`}
                  >
                    <Calendar className="w-4 h-4" /> Semana(s)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentType('uniforme')}
                    className={`flex-1 py-2.5 px-3 rounded-lg border text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                      paymentType === 'uniforme'
                        ? 'bg-orange-50 border-orange-400 text-orange-700'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-orange-200'
                    }`}
                  >
                    <Shirt className="w-4 h-4" /> Uniformes
                  </button>
                </div>

                {/* Week selector */}
                {paymentType === 'semana' && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-2">
                      Selecciona las semanas a cobrar (puedes elegir varias):
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 2, 3, 4].map(w => {
                        const checked = selectedWeeks.includes(w);
                        return (
                          <button
                            key={w}
                            type="button"
                            onClick={() => !isEditing && toggleWeek(w)}
                            disabled={isEditing}
                            className={`relative flex flex-col items-center justify-center py-3 rounded-xl border-2 transition-all ${
                              checked
                                ? 'bg-sky-50 border-sky-500 text-sky-700 shadow-sm'
                                : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-sky-300'
                            } ${isEditing ? 'opacity-60 cursor-default' : 'cursor-pointer'}`}
                          >
                            {checked
                              ? <CheckSquare className="w-4 h-4 mb-1" />
                              : <Square className="w-4 h-4 mb-1" />}
                            <span className="text-xs font-bold">Sem. {w}</span>
                            <span className="text-xs mt-0.5 font-semibold">${WEEK_PRICE.toLocaleString()}</span>
                          </button>
                        );
                      })}
                    </div>
                    {isMonthComplete && (
                      <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-xs font-semibold">
                        ⭐ Mes completo — se generarán 4 registros separados
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-gray-100" />

            {/* ─── MONTO ─── */}
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5" /> Monto
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-gray-700">Precio Base</Label>
                  <div className="h-10 px-3 flex items-center bg-gray-50 border rounded-md text-gray-500 font-semibold text-sm">
                    {paymentType === 'semana'
                      ? `${selectedWeeks.length} × ${formatCurrency(WEEK_PRICE)} = ${formatCurrency(baseTotal)}`
                      : formatCurrency(UNIFORM_PRICE)}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-gray-700">Descuento</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">$</span>
                    <Input
                      type="number" min="0" step="0.01"
                      value={discount}
                      onChange={e => setDiscount(e.target.value)}
                      onWheel={e => e.currentTarget.blur()}
                      className="pl-7 h-10"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-gray-700">Total a Cobrar</Label>
                  <div className={`h-10 px-3 flex items-center rounded-md border-2 font-bold text-lg ${
                    parseFloat(discount) > 0
                      ? 'bg-green-50 border-green-300 text-green-700'
                      : 'bg-blue-50 border-blue-200 text-blue-700'
                  }`}>
                    {formatCurrency(finalAmount)}
                  </div>
                </div>
              </div>
              {parseFloat(discount) > 0 && (
                <div className="mt-3 space-y-1.5">
                  <Label className="text-sm font-semibold text-gray-700">Motivo del Descuento *</Label>
                  <Input
                    value={discountReason}
                    onChange={e => setDiscountReason(e.target.value)}
                    placeholder="Ej: Hermanos, beca, cortesía directiva..."
                    className="h-10"
                    required
                  />
                </div>
              )}
            </div>

            <div className="border-t border-gray-100" />

            {/* ─── PAGO ─── */}
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" /> Pago
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-gray-700">Fecha *</Label>
                  <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="h-10" required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-gray-700">Método *</Label>
                  <Select value={paymentMethod} onValueChange={v => { setPaymentMethod(v); setBankName(''); }}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="tarjeta">Tarjeta</SelectItem>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-gray-700">Estado</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pagado">Pagado</SelectItem>
                      <SelectItem value="pendiente">Pendiente</SelectItem>
                      <SelectItem value="parcial">Parcial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {isTransfer && (
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold text-gray-700">Banco</Label>
                    <Select value={bankName} onValueChange={setBankName}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
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
                {(isTransfer || paymentMethod === 'tarjeta') && (
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-sm font-semibold text-gray-700">Referencia / Comprobante</Label>
                    <Input value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} placeholder="N° folio o referencia" className="h-10" />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-gray-700">Notas</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones adicionales..." rows={2} />
            </div>

          </div>

          {/* Footer */}
          <div className="px-6 pb-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>Cancelar</Button>
            <Button
              type="submit"
              disabled={isLoading || !hasParticipant || !hasWeeks}
              className={`${submitColor} gap-2`}
            >
              <Save className="w-4 h-4" />
              {submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}