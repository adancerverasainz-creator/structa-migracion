import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Plus, CheckCircle, AlertCircle, X, Save, Trash2, Search, Edit, Users, Clock, Globe } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '../lib/formatCurrency';
import { logAudit } from '../lib/auditLogger';
import TournamentAttendees from './TournamentAttendees';
import OrphanPaymentsReconciliation from './OrphanPaymentsReconciliation';
import { getTotalPaidForAttendee, isAttendeeBecado, buildDebtorsList, getPaidAttendeeIds, getTotalCollected, getIncomeByPaymentMethod, findOrphanPayments } from '@/lib/tournamentBalance';


export default function TournamentPayments({ tournament, players, payments: allPayments, onBack }) {
  const [activeTab, setActiveTab] = useState('asistentes');
  const [showForm, setShowForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [paymentSearchTerm, setPaymentSearchTerm] = useState('');
  const registrationFee = tournament?.registration_fee || 0;

  const resetForm = () => ({
    player_id: '',
    external_attendee_id: '',
    external_name: '',
    amount: registrationFee,
    paid_amount: registrationFee,
    fee_type: 'completo',
    payment_date: format(new Date(), 'yyyy-MM-dd'),
    payment_method: 'efectivo',
    bank_name: '',
    reference_number: '',
    notes: '',
    status: 'pagado',
  });

  const [formData, setFormData] = useState(resetForm);

  const queryClient = useQueryClient();

  const { data: tournamentPayments = [] } = useQuery({
    queryKey: ['tournamentPayments', tournament?.id],
    queryFn: () => base44.entities.TournamentPayment.filter({ tournament_id: tournament?.id }),
    enabled: !!tournament?.id,
    staleTime: 0,
  });

  const { data: attendees = [] } = useQuery({
    queryKey: ['tournamentAttendees', tournament?.id],
    queryFn: () => base44.entities.TournamentAttendee.filter({ tournament_id: tournament?.id }),
    enabled: !!tournament?.id,
  });

  const payments = tournamentPayments;
  const activePlayers = players.filter(p => p.status === 'activo');

  // Jugadores internos asistentes (para el selector de jugadores en formularios)
  const attendeePlayers = attendees
    .filter(a => !a.is_external && a.player_id)
    .map(a => players.find(p => p.id === a.player_id))
    .filter(Boolean);

  // ID de jugadores con pago completo (fuente: módulo centralizado)
  const paidPlayerIds = getPaidAttendeeIds(attendees, payments, tournament?.id, registrationFee);

  // Morosos: calculados por el módulo centralizado
  const debtors = buildDebtorsList(attendees, payments, players, tournament?.id, registrationFee);

  // Pagos huérfanos
  const orphanCount = findOrphanPayments(payments, tournament?.id).length;

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.TournamentPayment.create(data),
    onSuccess: (created, data) => {
      const playerName = players.find(p => p.id === data.player_id)?.full_name || data.player_id;
      logAudit({
        action: 'CREACIÓN',
        module: 'Torneos',
        entityType: 'TournamentPayment',
        entityId: created.id,
        entityName: `${playerName} — ${tournament?.name} — ${formatCurrency(data.amount)}`,
        newValue: data,
        monetaryDiff: data.amount,
        details: `Pago de torneo registrado. Torneo: ${tournament?.name}. Método: ${data.payment_method}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['tournamentPayments'] });
      setShowForm(false);
      setEditingPayment(null);
      setFormData(resetForm());
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TournamentPayment.update(id, data),
    onSuccess: (_, { id, data }) => {
      const playerName = players.find(p => p.id === data.player_id)?.full_name || data.player_id;
      logAudit({
        action: 'MODIFICACIÓN',
        module: 'Torneos',
        entityType: 'TournamentPayment',
        entityId: id,
        entityName: `${playerName} — ${tournament?.name} — ${formatCurrency(data.amount)}`,
        previousValue: editingPayment,
        newValue: data,
        monetaryDiff: data.amount - (editingPayment?.amount || 0),
        details: `Pago de torneo modificado. Torneo: ${tournament?.name}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['tournamentPayments'] });
      queryClient.refetchQueries({ queryKey: ['tournamentPayments'] });
      setShowForm(false);
      setEditingPayment(null);
      setFormData(resetForm());
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id }) => base44.entities.TournamentPayment.delete(id),
    onSuccess: (_, { id, payment }) => {
      const playerName = players.find(p => p.id === payment.player_id)?.full_name || payment.player_id;
      logAudit({
        action: 'ELIMINACIÓN',
        module: 'Torneos',
        entityType: 'TournamentPayment',
        entityId: id,
        entityName: `${playerName} — ${tournament?.name} — ${formatCurrency(payment.amount)}`,
        previousValue: payment,
        monetaryDiff: -(payment.amount || 0),
        details: `Pago de torneo eliminado. Torneo: ${tournament?.name}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['tournamentPayments'] });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const amount = registrationFee;
    const paidAmount = parseFloat(formData.paid_amount) || 0;
    const isBecado = formData.fee_type === 'becado';
    const finalPaid = isBecado ? 0 : paidAmount;
    const status = isBecado ? 'pagado' : finalPaid >= amount ? 'pagado' : finalPaid > 0 ? 'abono' : 'pendiente';
    const paymentData = {
      ...formData,
      tournament_id: tournament?.id,
      amount: isBecado ? 0 : amount,
      paid_amount: finalPaid,
      status,
      payment_date: formData.payment_date ? formData.payment_date.split('T')[0] : format(new Date(), 'yyyy-MM-dd'),
    };
    
    if (editingPayment && editingPayment.id) {
      updateMutation.mutate({ id: editingPayment.id, data: paymentData });
    } else {
      createMutation.mutate(paymentData);
    }
  };

  const handleEdit = (payment) => {
    setEditingPayment(payment);
    const paidAmt = payment.paid_amount ?? payment.amount ?? 0;
    const feeType = paidAmt === 0 ? 'becado' : paidAmt === registrationFee / 2 ? 'mitad' : paidAmt >= registrationFee ? 'completo' : 'custom';
    setFormData({
      player_id: payment.player_id,
      amount: payment.amount.toString(),
      paid_amount: paidAmt,
      fee_type: feeType,
      payment_date: payment.payment_date ? payment.payment_date.split('T')[0] : format(new Date(), 'yyyy-MM-dd'),
      payment_method: payment.payment_method,
      bank_name: payment.bank_name || '',
      reference_number: payment.reference_number || '',
      notes: payment.notes || '',
      status: payment.status || 'pagado',
    });
    setShowForm(true);
  };

  const handleRegisterPaymentForPlayer = (player) => {
    setEditingPayment(null);
    setFormData({ ...resetForm(), player_id: player.id });
    setActiveTab('pagos');
    setShowForm(true);
  };

  const handleRegisterExternalPayment = (externalAttendee) => {
    setEditingPayment(null);
    setFormData({ ...resetForm(), player_id: '', external_attendee_id: externalAttendee.id, external_name: externalAttendee.name });
    setActiveTab('pagos');
    setShowForm(true);
  };

  const getPlayerName = (playerId, externalName) => {
    if (externalName) return `${externalName} (Externo)`;
    const player = players.find(p => p.id === playerId);
    return player?.full_name || 'Desconocido';
  };

  const formatSafeDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString + 'T00:00:00');
      if (isNaN(date.getTime())) return '';
      return format(date, 'dd/MM/yyyy');
    } catch {
      return '';
    }
  };

  const effectivePaid = (p) => (p.paid_amount !== null && p.paid_amount !== undefined) ? p.paid_amount : (p.amount ?? 0);

  const totalCollected = getTotalCollected(payments);

  // Ingresos por método de pago (fuente: módulo centralizado)
  const incomeByMethod = getIncomeByPaymentMethod(payments);
  const { efectivo: cashData, tarjeta: cardData, transferencia: transferData } = incomeByMethod;

  const totalCash = cashData.total;
  const totalCard = cardData.total;
  const totalTransfer = transferData.total;

  // Ingresos por banco
  const byBank = transferData.byBank || {};
  const totalBBVA = (byBank['BBVA'] || {}).total || 0;
  const totalMP = (byBank['MP'] || {}).total || 0;
  const totalNU = (byBank['NU'] || {}).total || 0;
  const totalOpenBank = (byBank['OpenBank'] || {}).total || 0;

  const cashPayments = payments.filter(p => p.payment_method === 'efectivo');
  const cardPayments = payments.filter(p => p.payment_method === 'tarjeta');
  const transferPayments = payments.filter(p => p.payment_method === 'transferencia');
  const bbvaPayments = transferPayments.filter(p => p.bank_name === 'BBVA');
  const mpPayments = transferPayments.filter(p => p.bank_name === 'MP');
  const nuPayments = transferPayments.filter(p => p.bank_name === 'NU');
  const openBankPayments = transferPayments.filter(p => p.bank_name === 'OpenBank');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{tournament?.name}</h1>
          {tournament?.date && (
            <p className="text-gray-600">
              {format(
                new Date(tournament.date.includes('T') ? tournament.date : tournament.date + 'T00:00:00'), 
                "d 'de' MMMM, yyyy", 
                { locale: es }
              )}
            </p>
          )}
        </div>
        <Button onClick={() => {
          setEditingPayment(null);
          setFormData(resetForm());
          setActiveTab('pagos');
          setShowForm(true);
        }} className="bg-purple-600 hover:bg-purple-700">
          <Plus className="w-4 h-4 mr-2" />
          Registrar Pago
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="asistentes" className="flex items-center gap-2">
            <Users className="w-4 h-4" /> Asistentes
          </TabsTrigger>
          <TabsTrigger value="pagos" className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> Pagos
          </TabsTrigger>
          <TabsTrigger value="morosos" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Morosos
            {debtors.length > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{debtors.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="huerfanos" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Huérfanos
            {orphanCount > 0 && (
              <span className="ml-1 bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{orphanCount}</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="asistentes">
          <TournamentAttendees
            tournament={tournament}
            players={players}
            payments={payments}
            onRegisterPayment={handleRegisterPaymentForPlayer}
            onRegisterExternalPayment={handleRegisterExternalPayment}
          />
        </TabsContent>

        <TabsContent value="pagos" className="space-y-6">

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-2 border-purple-200">
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Pagos Completos</p>
            <p className="text-3xl font-bold text-purple-600">{paidPlayerIds.size}</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-green-200">
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Total Recaudado</p>
            <p className="text-3xl font-bold text-green-600">{formatCurrency(totalCollected)}</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-blue-200">
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Cuota por Asistente</p>
            <p className="text-3xl font-bold text-blue-600">{formatCurrency(tournament?.registration_fee || 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-orange-200">
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Total Esperado</p>
            <p className="text-3xl font-bold text-orange-600">{formatCurrency(attendees.length * (tournament?.registration_fee || 0))}</p>
          </CardContent>
        </Card>
      </div>

      {/* Ingresos por Método de Pago */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle>Ingresos por Método de Pago</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-gray-600 mb-1">Efectivo</p>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalCash)}</p>
              <p className="text-xs text-gray-500 mt-1">{cashPayments.length} pagos</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <p className="text-sm text-gray-600 mb-1">Tarjeta</p>
              <p className="text-2xl font-bold text-purple-600">{formatCurrency(totalCard)}</p>
              <p className="text-xs text-gray-500 mt-1">{cardPayments.length} pagos</p>
            </div>
            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <p className="text-sm text-gray-600 mb-1">BBVA</p>
              <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalBBVA)}</p>
              <p className="text-xs text-gray-500 mt-1">{bbvaPayments.length} pagos</p>
            </div>
            <div className="p-4 bg-cyan-50 rounded-lg border border-cyan-200">
              <p className="text-sm text-gray-600 mb-1">MP</p>
              <p className="text-2xl font-bold text-cyan-600">{formatCurrency(totalMP)}</p>
              <p className="text-xs text-gray-500 mt-1">{mpPayments.length} pagos</p>
            </div>
            <div className="p-4 bg-violet-50 rounded-lg border border-violet-200">
              <p className="text-sm text-gray-600 mb-1">NU</p>
              <p className="text-2xl font-bold text-violet-600">{formatCurrency(totalNU)}</p>
              <p className="text-xs text-gray-500 mt-1">{nuPayments.length} pagos</p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
              <p className="text-sm text-gray-600 mb-1">OpenBank</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalOpenBank)}</p>
              <p className="text-xs text-gray-500 mt-1">{openBankPayments.length} pagos</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      {showForm && (
        <Card className="shadow-lg border-2 border-purple-200">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{editingPayment ? 'Editar Pago de Inscripción' : 'Registrar Pago de Inscripción'}</span>
              <Button variant="ghost" size="icon" onClick={() => {
                setShowForm(false);
                setEditingPayment(null);
              }}>
                <X className="w-5 h-5" />
              </Button>
            </CardTitle>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                   <Label>Jugador *</Label>
                   {formData.external_attendee_id ? (
                     <div className="p-3 bg-blue-50 border border-blue-200 rounded-md flex items-center gap-2">
                       <Globe className="w-4 h-4 text-blue-600" />
                       <span className="font-medium text-blue-800">{formData.external_name}</span>
                       <Badge className="bg-blue-100 text-blue-700 border border-blue-300 text-xs">Externo</Badge>
                     </div>
                   ) : attendeePlayers.length === 0 ? (
                     <p className="text-sm text-orange-600 border border-orange-200 bg-orange-50 rounded-md px-3 py-2">
                       No hay asistentes registrados para este torneo. Agrégalos primero en la pestaña "Asistentes".
                     </p>
                   ) : (
                     <Select
                       value={formData.player_id}
                       onValueChange={(value) => setFormData({ ...formData, player_id: value })}
                       required
                     >
                       <SelectTrigger>
                         <SelectValue placeholder="Seleccionar jugador asistente..." />
                       </SelectTrigger>
                       <SelectContent>
                         {attendeePlayers.map((player) => (
                           <SelectItem key={player.id} value={player.id}>
                             <span>{player.full_name}</span>
                             {paidPlayerIds.has(player.id) && (
                               <span className="ml-2 text-xs text-green-600">✓ Inscrito</span>
                             )}
                           </SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                   )}
                 </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Tipo de cuota *</Label>
                  <div className="flex gap-2">
                    {[
                      { value: 'completo', label: '💰 Completo', desc: formatCurrency(registrationFee), color: 'green' },
                      { value: 'mitad', label: '½ 50%', desc: formatCurrency(registrationFee / 2), color: 'orange' },
                      { value: 'becado', label: '🎓 Becado', desc: '$0.00', color: 'blue' },
                    ].map(({ value, label, desc, color }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          const paidAmt = value === 'completo' ? registrationFee : value === 'mitad' ? registrationFee / 2 : 0;
                          setFormData({ ...formData, fee_type: value, paid_amount: paidAmt });
                        }}
                        className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                          formData.fee_type === value
                            ? color === 'green' ? 'bg-green-600 border-green-600 text-white'
                            : color === 'orange' ? 'bg-orange-500 border-orange-500 text-white'
                            : 'bg-blue-600 border-blue-600 text-white'
                            : 'border-gray-300 text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        <div>{label}</div>
                        <div className="text-xs font-normal opacity-80">{desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cuota del torneo</Label>
                  <Input
                    type="number"
                    value={registrationFee}
                    disabled
                    className="bg-gray-100 text-gray-600"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Monto a pagar / abonar *</Label>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.paid_amount}
                    onChange={(e) => setFormData({ ...formData, paid_amount: e.target.value, fee_type: 'custom' })}
                    disabled={formData.fee_type === 'becado'}
                    className={formData.fee_type === 'becado' ? 'bg-blue-50 text-blue-600 font-bold' : ''}
                  />
                  {formData.fee_type === 'becado' && (
                    <p className="text-xs text-blue-600 font-medium">🎓 Jugador becado — se registrará como pagado ($0.00)</p>
                  )}
                  {formData.fee_type !== 'becado' && parseFloat(formData.paid_amount) > 0 && parseFloat(formData.paid_amount) < registrationFee && (
                    <p className="text-xs text-orange-600 font-medium">
                      Abono parcial — Pendiente: {formatCurrency(registrationFee - parseFloat(formData.paid_amount))}
                    </p>
                  )}
                  {formData.fee_type !== 'becado' && parseFloat(formData.paid_amount) >= registrationFee && (
                    <p className="text-xs text-green-600 font-medium">✓ Pago completo</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Fecha de Pago * (DD/MM/YYYY)</Label>
                  <Input
                    type="date"
                    value={formData.payment_date}
                    onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Método de Pago *</Label>
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
                  <>
                    <div className="space-y-2">
                      <Label>Banco *</Label>
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
                          <Label>Referencia</Label>
                          <Input
                          value={formData.reference_number}
                          onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                          />
                          </div>
                          </>
                          )}
                {formData.payment_method === 'tarjeta' && (
                  <div className="space-y-2">
                    <Label>Referencia</Label>
                    <Input
                      value={formData.reference_number}
                      onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                    />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Notas adicionales..."
                  rows={3}
                />
              </div>
            </CardContent>
            <div className="px-6 pb-6 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => {
                setShowForm(false);
                setEditingPayment(null);
              }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="bg-purple-600 hover:bg-purple-700">
                <Save className="w-4 h-4 mr-2" />
                {editingPayment ? 'Actualizar' : 'Guardar'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Payments List */}
      <Card>
        <CardHeader>
          <CardTitle>Pagos Registrados</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Buscador de pagos */}
          {payments.length > 0 && (
            <div className="mb-4 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar por nombre de jugador..."
                value={paymentSearchTerm}
                onChange={(e) => setPaymentSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          )}
          
          {payments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No hay pagos registrados para este torneo</p>
            </div>
          ) : (
            <div className="space-y-3">
              {payments
                .filter((payment) => {
                  if (!paymentSearchTerm) return true;
                  const playerName = getPlayerName(payment.player_id).toLowerCase();
                  return playerName.includes(paymentSearchTerm.toLowerCase());
                })
                .map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span className="font-semibold text-gray-900">{getPlayerName(payment.player_id, payment.external_name)}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                      {payment.payment_date && formatSafeDate(payment.payment_date) && (
                        <span>{formatSafeDate(payment.payment_date)}</span>
                      )}
                      <Badge variant="outline">{payment.payment_method}</Badge>
                      {payment.status === 'abono' && <Badge className="bg-orange-100 text-orange-700 border-orange-300 border">Abono</Badge>}
                      {payment.status === 'pagado' && payment.amount === 0 && <Badge className="bg-blue-100 text-blue-700 border-blue-300 border">🎓 Becado</Badge>}
                      {payment.status === 'pagado' && payment.amount > 0 && <Badge className="bg-green-100 text-green-700 border-green-300 border">Pagado</Badge>}
                      {payment.payment_method === 'transferencia' && payment.bank_name && <span>Banco: {payment.bank_name}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xl font-bold text-green-600">{formatCurrency(effectivePaid(payment))}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-blue-600 hover:bg-blue-50"
                      onClick={() => handleEdit(payment)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => {
                        if (confirm('¿Eliminar este pago?')) {
                          deleteMutation.mutate({ id: payment.id, payment });
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

        </TabsContent>

        {/* Morosos Tab */}
        <TabsContent value="morosos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5" />
                Asistentes con pago pendiente ({debtors.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {debtors.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
                  <p className="font-medium text-green-600">¡Todos los asistentes han pagado!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {debtors.map(({ attendeeId, name, isExternal, totalPaid, debt, player }) => (
                    <div key={attendeeId} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900">{name}</p>
                          {isExternal && <Badge className="bg-blue-100 text-blue-700 border-blue-300 text-xs">Externo</Badge>}
                        </div>
                        {player?.category && <p className="text-xs text-gray-500">{player.category}</p>}
                        <div className="flex flex-wrap gap-3 mt-1 text-sm">
                          <span className="text-green-700">Abonado: <strong>{formatCurrency(totalPaid)}</strong></span>
                          <span className="text-red-700">Pendiente: <strong>{formatCurrency(debt)}</strong></span>
                          <span className="text-gray-500">Cuota: {formatCurrency(registrationFee)}</span>
                        </div>
                        {totalPaid > 0 && (
                          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: `${Math.min(100, (totalPaid / registrationFee) * 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700 shrink-0"
                        onClick={() => {
                          if (isExternal) {
                            handleRegisterExternalPayment({ id: attendeeId, name });
                          } else {
                            handleRegisterPaymentForPlayer(player);
                          }
                        }}
                      >
                        Registrar abono
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Huérfanos Tab */}
        <TabsContent value="huerfanos">
          <OrphanPaymentsReconciliation
            tournamentId={tournament?.id}
            tournamentPayments={payments}
            attendees={attendees}
            players={players}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}