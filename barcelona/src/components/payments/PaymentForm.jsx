import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { X, Save, Search, ShoppingBag, CheckCircle2, AlertTriangle, ArrowLeftRight } from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '../lib/formatCurrency';
import TicketUniforme from './TicketUniforme';

export default function PaymentForm({ payment, players, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState(() => {
    if (payment) {
      return {
        ...payment,
        payment_date: payment.payment_date ? format(new Date(payment.payment_date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        amount: payment.amount || '',
        surcharge: payment.surcharge || 0,
        bank_name: payment.bank_name || '',
        reference_number: payment.reference_number || '',
        notes: payment.notes || '',
        payment_type: payment.payment_type || 'mensualidad',
      };
    }
    return {
      player_id: '',
      amount: '',
      surcharge: 0,
      payment_date: format(new Date(), 'yyyy-MM-dd'),
      month: format(new Date(), 'MMMM yyyy', { locale: es }),
      payment_method: 'efectivo',
      bank_name: '',
      reference_number: '',
      notes: '',
      status: 'pagado',
      payment_type: 'mensualidad',
    };
  });

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

  const [playerSearch, setPlayerSearch] = useState('');
  const [selectedUniformItems, setSelectedUniformItems] = useState({}); // { itemId: quantity }
  const [montoRecibido, setMontoRecibido] = useState('');
  const [ticketData, setTicketData] = useState(null);

  const addUniformItem = (item) => {
    setSelectedUniformItems(prev => {
      const updated = { ...prev, [item.id]: (prev[item.id] || 0) + 1 };
      const total = uniformItems.reduce((sum, i) => sum + i.price * (updated[i.id] || 0), 0);
      const notes = uniformItems.filter(i => updated[i.id] > 0).map(i => `${i.label}${updated[i.id] > 1 ? ` x${updated[i.id]}` : ''}`).join(', ');
      setFormData(fd => ({ ...fd, amount: total, notes }));
      return updated;
    });
  };

  const removeUniformItem = (item) => {
    setSelectedUniformItems(prev => {
      if (!prev[item.id]) return prev;
      const updated = { ...prev, [item.id]: prev[item.id] - 1 };
      if (updated[item.id] === 0) delete updated[item.id];
      const total = uniformItems.reduce((sum, i) => sum + i.price * (updated[i.id] || 0), 0);
      const notes = uniformItems.filter(i => updated[i.id] > 0).map(i => `${i.label}${updated[i.id] > 1 ? ` x${updated[i.id]}` : ''}`).join(', ');
      setFormData(fd => ({ ...fd, amount: total, notes }));
      return updated;
    });
  };

  // Generate 12 future months + current + 12 past months
  const monthOptions = Array.from({ length: 25 }, (_, i) => {
    const d = subMonths(new Date(), i - 12);
    return format(d, 'MMMM yyyy', { locale: es });
  }).reverse();

  // Generate season options: from 2025-2026 onwards + 3 future
  const currentYear = new Date().getFullYear();
  const startYear = 2025;
  const endYear = currentYear + 3;
  const seasonOptions = Array.from({ length: endYear - startYear + 1 }, (_, i) => {
    const y = startYear + i;
    return `${y}-${y + 1}`;
  });

  const isInscripcion = formData.payment_type === 'inscripcion' || formData.payment_type === 'reinscripcion';
  const isUniforme = formData.payment_type === 'uniformes';

  const totalUniforme = uniformItems.reduce((sum, i) => sum + i.price * (selectedUniformItems[i.id] || 0), 0);
  const hasItems = Object.keys(selectedUniformItems).length > 0;
  const montoRecibidoNum = parseFloat(montoRecibido) || 0;
  const cambio = montoRecibidoNum > totalUniforme ? montoRecibidoNum - totalUniforme : 0;
  const pendiente = montoRecibidoNum < totalUniforme ? totalUniforme - montoRecibidoNum : 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    const dateWithTime = formData.payment_date + 'T12:00:00';
    const currentMonth = format(new Date(), 'MMMM yyyy', { locale: es });
    if (isUniforme) {
      const pagoReal = montoRecibidoNum > 0 ? Math.min(montoRecibidoNum, totalUniforme) : totalUniforme;
      const esParcial = pendiente > 0;
      const player = players.find(p => p.id === formData.player_id);
      onSubmit({
        ...formData,
        payment_date: dateWithTime,
        amount: pagoReal,
        surcharge: 0,
        month: 'uniformes',
        status: esParcial ? 'pendiente' : 'pagado',
        notes: formData.notes + (esParcial ? ` | Pendiente: $${pendiente}` : ''),
      });
      setTicketData({
        playerName: player?.full_name || 'Jugador',
        parentName: player?.parent_name || '',
        category: player?.category || '',
        items: selectedUniformItems,
        total: totalUniforme,
        montoRecibido: montoRecibidoNum,
        cambio,
        pendiente,
        paymentMethod: formData.payment_method,
        paymentDate: dateWithTime,
        referenceNumber: formData.reference_number || '',
        bankName: formData.bank_name || '',
      });
    } else {
      const totalAmount = (parseFloat(formData.amount) || 0) + (parseFloat(formData.surcharge) || 0);
      onSubmit({
        ...formData,
        payment_date: dateWithTime,
        amount: totalAmount,
        surcharge: parseFloat(formData.surcharge) || 0,
      });
    }
  };

  const selectedPlayer = players.find(p => p.id === formData.player_id);

  // FIX 2026-07-15: también se puede cobrar a inactivos/baja (su deuda sigue viva); activos aparecen primero
  const filteredPlayers = [...players]
    .sort((a, b) => (a.status === 'activo' ? 0 : 1) - (b.status === 'activo' ? 0 : 1) || (a.full_name || '').localeCompare(b.full_name || ''))
    .filter(p => 
      playerSearch === '' || 
      p.full_name.toLowerCase().includes(playerSearch.toLowerCase()) ||
      p.parent_name?.toLowerCase().includes(playerSearch.toLowerCase())
    );

  return (
    <>
    {ticketData && (
      <TicketUniforme
        ticketData={ticketData}
        onClose={() => { setTicketData(null); }}
      />
    )}
    <Card className="shadow-lg border-2 border-green-200">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{payment ? 'Editar Pago' : 'Registrar Nuevo Pago'}</span>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-5 h-5" />
          </Button>
        </CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tipo de Pago */}
            <div className="space-y-2 md:col-span-2">
              <Label>Tipo de Pago *</Label>
              <div className="flex gap-2">
                {[
                  { value: 'mensualidad', label: 'Mensualidad' },
                  { value: 'inscripcion', label: 'Inscripción' },
                  { value: 'reinscripcion', label: 'Reinscripción' },
                  { value: 'uniformes', label: 'Uniformes' },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { setFormData({ ...formData, payment_type: value, amount: '' }); setSelectedUniformItems({}); setMontoRecibido(''); }}
                    className={`flex-1 py-2 px-4 rounded-lg border-2 text-sm font-medium transition-colors ${
                      formData.payment_type === value
                        ? 'bg-green-600 border-green-600 text-white'
                        : 'border-gray-300 text-gray-700 hover:border-green-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="player_id">Jugador *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar jugador..."
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  className="pl-9"
                />
                {playerSearch && filteredPlayers.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                    {filteredPlayers.map((player) => (
                      <button
                        key={player.id}
                        type="button"
                        onClick={() => {
                          setFormData({ 
                            ...formData, 
                            player_id: player.id,
                            amount: player.monthly_fee || formData.amount
                          });
                          setPlayerSearch('');
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors"
                      >
                        <div className="font-medium">
                          {player.full_name}
                          {player.status && player.status !== 'activo' && (
                            <span className="ml-2 text-xs font-semibold text-white bg-gray-600 rounded px-1.5 py-0.5">{player.status === 'baja' ? 'Baja' : 'Inactivo'}</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">{player.parent_name} - {formatCurrency(player.monthly_fee)}</div>
                      </button>
                    ))}
                  </div>
                )}
                {playerSearch && filteredPlayers.length === 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg p-3">
                    <p className="text-sm text-gray-500 text-center">No se encontraron jugadores</p>
                  </div>
                )}
              </div>
              {selectedPlayer && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm font-medium text-gray-900">{selectedPlayer.full_name}</p>
                  <p className="text-xs text-gray-600">{selectedPlayer.parent_name} - {formatCurrency(selectedPlayer.monthly_fee)}</p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>{isUniforme ? 'Artículos *' : 'Monto *'}</Label>
              {isUniforme ? (
                <div className="space-y-4">
                  {/* Grid de artículos */}
                  <div className="grid grid-cols-2 gap-2">
                    {uniformItems.map((item) => {
                      const qty = selectedUniformItems[item.id] || 0;
                      return (
                        <div key={item.id} className={`flex flex-col rounded-xl border-2 overflow-hidden transition-all ${
                          qty > 0 ? 'border-green-500 shadow-md' : 'border-gray-200'
                        }`}>
                          <button
                            type="button"
                            onClick={() => addUniformItem(item)}
                            className={`flex flex-col items-start px-3 py-2.5 text-sm font-medium transition-colors w-full ${
                              qty > 0 ? 'bg-green-600 text-white' : 'bg-white text-gray-700 hover:bg-green-50'
                            }`}
                          >
                            <span className="leading-tight">{item.label}</span>
                            <span className={`text-base font-bold mt-0.5 ${qty > 0 ? 'text-white' : 'text-green-700'}`}>{formatCurrency(item.price)}</span>
                          </button>
                          {qty > 0 && (
                            <div className="flex items-center justify-between bg-green-700 px-3 py-1">
                              <button type="button" onClick={() => removeUniformItem(item)} className="text-white font-bold text-lg leading-none hover:text-red-300">−</button>
                              <span className="text-white font-bold text-sm">x{qty}</span>
                              <button type="button" onClick={() => addUniformItem(item)} className="text-white font-bold text-lg leading-none hover:text-green-200">+</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Panel de cobro — solo aparece si hay artículos seleccionados */}
                  {hasItems && (
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
                            className="pl-7 text-xl font-bold h-12 border-2 focus:border-green-500"
                          />
                        </div>
                      </div>

                      {/* Resultado del cobro */}
                      {montoRecibidoNum > 0 && (
                        <div className="border-t-2 border-dashed border-gray-200 px-4 py-3">
                          {pendiente > 0 ? (
                            <div className="flex items-start gap-3 p-3 bg-red-50 rounded-xl border border-red-200">
                              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-red-700">Pago incompleto</p>
                                <p className="text-xs text-red-500 mt-0.5">El saldo pendiente se registrará en morosos</p>
                                <div className="flex justify-between items-center mt-2">
                                  <span className="text-xs text-red-600 font-medium">Faltante</span>
                                  <span className="text-lg font-bold text-red-700">{formatCurrency(pendiente)}</span>
                                </div>
                              </div>
                            </div>
                          ) : cambio > 0 ? (
                            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-200">
                              <div className="flex items-center gap-2">
                                <ArrowLeftRight className="w-4 h-4 text-blue-500" />
                                <span className="text-sm font-semibold text-blue-700">Cambio a entregar</span>
                              </div>
                              <span className="text-xl font-bold text-blue-700">{formatCurrency(cambio)}</span>
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
                  <div className="grid grid-cols-3 gap-2">
                    {(amountsByType[formData.payment_type] || amountsByType.mensualidad).map((value) => (
                      <Button
                        key={value}
                        type="button"
                        variant={formData.amount === value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFormData({ ...formData, amount: value })}
                        className={formData.amount === value ? "bg-green-600 hover:bg-green-700" : ""}
                      >
                        {formatCurrency(value)}
                      </Button>
                    ))}
                  </div>
                  {formData.amount !== '' && (
                    <p className="text-sm font-semibold text-green-600">Seleccionado: {formatCurrency(formData.amount)}</p>
                  )}
                </>
              )}
            </div>
            {!isUniforme && (
            <div className="space-y-2">
              <Label>Recargos</Label>
              <div className="grid grid-cols-2 gap-2">
                {[0, 100].map((value) => (
                  <Button
                    key={value}
                    type="button"
                    variant={formData.surcharge === value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormData({ ...formData, surcharge: value })}
                    className={formData.surcharge === value ? "bg-green-600 hover:bg-green-700" : ""}
                  >
                    {formatCurrency(value)}
                  </Button>
                ))}
              </div>
              {formData.surcharge > 0 && (
                <p className="text-sm font-semibold text-orange-600">Recargo: {formatCurrency(formData.surcharge)}</p>
              )}
            </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="payment_date">Fecha de Pago *</Label>
              <Input
                id="payment_date"
                type="date"
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                required
              />
            </div>
            {isInscripcion ? (
              <div className="space-y-2">
                <Label htmlFor="month">Temporada *</Label>
                <Select
                  value={formData.month}
                  onValueChange={(value) => setFormData({ ...formData, month: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar temporada" />
                  </SelectTrigger>
                  <SelectContent>
                    {seasonOptions.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : isUniforme ? null : (
              <div className="space-y-2">
                <Label htmlFor="month">Mes Correspondiente *</Label>
                <Select
                  value={formData.month}
                  onValueChange={(value) => setFormData({ ...formData, month: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar mes" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map(m => (
                      <SelectItem key={m} value={m}>
                        {m.charAt(0).toUpperCase() + m.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.month && formData.month !== format(new Date(), 'MMMM yyyy', { locale: es }) && (
                  <p className="text-xs text-orange-600 font-medium">⚠️ Pago de mes anterior: {formData.month.charAt(0).toUpperCase() + formData.month.slice(1)}</p>
                )}
              </div>
            )}
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
                  <SelectItem value="tarjeta">Tarjeta Bancaria</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.payment_method === 'transferencia' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="bank_name">Banco *</Label>
                  <Select
                    value={formData.bank_name}
                    onValueChange={(value) => setFormData({ ...formData, bank_name: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar banco" />
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
                <div className="space-y-2">
                  <Label htmlFor="reference_number">Referencia</Label>
                  <Input
                    id="reference_number"
                    value={formData.reference_number}
                    onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                    placeholder="Número de referencia"
                  />
                </div>
              </>
            )}
            {formData.payment_method === 'tarjeta' && (
              <div className="space-y-2">
                <Label htmlFor="reference_number">Referencia</Label>
                <Input
                  id="reference_number"
                  value={formData.reference_number}
                  onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                  placeholder="Número de referencia"
                />
              </div>
            )}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => !isUniforme && setFormData({ ...formData, notes: e.target.value })}
                placeholder={isUniforme ? "Se llena automáticamente con los artículos seleccionados" : "Notas adicionales..."}
                readOnly={isUniforme}
                className={isUniforme ? "bg-gray-50 text-gray-600" : ""}
                rows={3}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading} className="bg-green-600 hover:bg-green-700">
            <Save className="w-4 h-4 mr-2" />
            {payment ? 'Actualizar' : 'Guardar'}
          </Button>
        </CardFooter>
      </form>
    </Card>
    </>
  );
}