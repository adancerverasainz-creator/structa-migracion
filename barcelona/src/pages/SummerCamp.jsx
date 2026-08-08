import React, { useState, useRef } from 'react';
import { confirmar } from '@/components/ui/confirmar';
import { usePerms } from '@/lib/usePerms';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44, supabase } from '@/api/base44Client';
import ERPPageHeader from '../components/layout/ERPPageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Sun, Calendar, TrendingUp, Users, Tag, AlertCircle, UserPlus, Shirt } from 'lucide-react';
import SummerCampPaymentForm from '../components/summercamp/SummerCampPaymentForm';
import SummerCampList from '../components/summercamp/SummerCampList';
import SummerCampDebtors from '../components/summercamp/SummerCampDebtors';
import ExternalPlayerForm from '../components/summercamp/ExternalPlayerForm';
import ExternalPlayersList from '../components/summercamp/ExternalPlayersList';
import { formatCurrency } from '../components/lib/formatCurrency';
import { logAudit } from '../components/lib/auditLogger';
import { toast } from 'sonner';

const WEEK_PRICE = 1200;
const UNIFORM_PRICE = 950;

export default function SummerCamp() {
  const { canDelete } = usePerms('summercamp');
  const { data: currentUser } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me() });
  const isAdmin = currentUser?.role === 'admin';
  const [reversarInfo, setReversarInfo] = useState(null);
  const [motivoReverso, setMotivoReverso] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('semana');
  const [editingPayment, setEditingPayment] = useState(null);
  const [showExternalForm, setShowExternalForm] = useState(false);
  const [editingExternal, setEditingExternal] = useState(null);
  const [payingExternalPlayer, setPayingExternalPlayer] = useState(null);
  const queryClient = useQueryClient();

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['summerCampPayments'],
    queryFn: () => base44.entities.SummerCampPayment.list('-payment_date'),
  });

  const { data: players = [], isLoading: playersLoading } = useQuery({
    queryKey: ['players'],
    queryFn: () => base44.entities.Player.list(),
  });

  const { data: clubSettings = [] } = useQuery({
    queryKey: ['clubSettings'],
    queryFn: () => base44.entities.ClubSetting.list(),
  });
  const weekPrice = clubSettings.find(cs => cs.key === 'fees')?.value?.summer_week || null;

  const { data: externalPlayers = [], isLoading: externalLoading } = useQuery({
    queryKey: ['summerCampExternalPlayers'],
    queryFn: () => base44.entities.SummerCampExternalPlayer.list(),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const result = await base44.entities.SummerCampPayment.create(data);
      await logAudit({
        action: 'CREACIÓN', module: 'Summer Camp', entity_type: 'SummerCampPayment',
        entity_id: result.id,
        entity_name: `${data.player_name} - ${data.payment_type === 'semana' ? `Semana ${data.week_number}` : 'Uniformes'}`,
        newData: data,
        details: `Monto: ${formatCurrency(data.amount)}, Descuento: ${formatCurrency(data.discount || 0)}`,
      });
      return result;
    },
    // El cierre del modal lo maneja handleSubmit (en multi-semana solo al último)
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['summerCampPayments'] }),
    onError: (err) => toast.error(`No se pudo registrar el pago: ${err?.message || 'error desconocido'}`),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, prev }) => {
      await logAudit({
        action: 'MODIFICACIÓN', module: 'Summer Camp', entity_type: 'SummerCampPayment',
        entity_id: id,
        entity_name: `${data.player_name} - ${data.payment_type === 'semana' ? `Semana ${data.week_number}` : 'Uniformes'}`,
        previousData: prev, newData: data,
        monetaryDiff: (data.amount || 0) - (prev?.amount || 0),
      });
      return base44.entities.SummerCampPayment.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['summerCampPayments'] });
      setShowForm(false);
      setEditingPayment(null);
      toast.success('Pago actualizado');
    },
    onError: (err) => toast.error(`No se pudo actualizar el pago: ${err?.message || 'error desconocido'}`),
  });

  // #80 Storno fase 2: reverso de pago Summer (solo admin)
  const reversarMutation = useMutation({
    mutationFn: async ({ payment, motivo }) => {
      const { data, error } = await supabase.rpc('reversar_pago_summer', { p_id: payment.id, p_motivo: motivo });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: async (newId, { payment, motivo }) => {
      await logAudit({
        action: 'REVERSO', module: 'Summer Camp', entity_type: 'SummerCampPayment',
        entity_id: newId, entity_name: payment.player_name || 'Pago Summer',
        previousValue: payment, monetaryDiff: -(payment.amount || 0),
        details: `Reverso (storno) del pago ${payment.id}. Motivo: ${motivo}`,
      });
      queryClient.invalidateQueries({ queryKey: ['summerCampPayments'] });
      queryClient.invalidateQueries({ queryKey: ['saldosPorCuenta'] });
      toast.success('Reverso registrado — el pago original queda anulado por contra-movimiento');
      setReversarInfo(null); setMotivoReverso('');
    },
    onError: (e) => toast.error(`No se pudo reversar: ${e.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (p) => {
      await logAudit({
        action: 'ELIMINACIÓN', module: 'Summer Camp', entity_type: 'SummerCampPayment',
        entity_id: p.id, entity_name: p.player_name || p.player_id,
        previousData: p, monetaryDiff: -(p.amount || 0),
      });
      return base44.entities.SummerCampPayment.delete(p.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['summerCampPayments'] }),
  });

  // ── Lote atómico (motor de integridad): el formulario entrega N registros
  // (multi-semana); se acumulan y se envían en UNA transacción al RPC
  // registrar_pagos_summer. Todo o nada — ya no pueden quedar semanas a medias.
  const batchRef = useRef([]);
  const batchMutation = useMutation({
    mutationFn: async (rows) => {
      const { data: ids, error } = await supabase.rpc('registrar_pagos_summer', {
        p_pagos: rows,
        p_op_key: globalThis.crypto?.randomUUID ? crypto.randomUUID() : null,
      });
      if (error) throw new Error(error.message);
      return ids;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['summerCampPayments'] }),
    onError: (err) => toast.error(`No se pudo registrar el pago: ${err?.message || 'error desconocido'}`),
  });

  const handleSubmit = async (data, isLast = true) => {
    if (editingPayment?.id) {
      updateMutation.mutate({ id: editingPayment.id, data, prev: editingPayment });
      return;
    }
    batchRef.current.push(data);
    if (!isLast) return;
    const rows = batchRef.current;
    batchRef.current = [];
    try {
      await batchMutation.mutateAsync(rows);
      setShowForm(false);
      setEditingPayment(null);
      setPayingExternalPlayer(null);
      toast.success(rows.length > 1 ? `${rows.length} pagos registrados` : 'Pago registrado');
    } catch {
      // onError ya mostró el toast; el modal queda abierto para reintentar
    }
  };

  const handleEdit = (p) => { setEditingPayment(p); setFormType(p.payment_type); setShowForm(true); };
  const handleDelete = (p) => { confirmar('¿Eliminar este registro?').then((ok) => ok && deleteMutation.mutate(p)); };
  const openNew = (type) => { setEditingPayment(null); setFormType(type); setShowForm(true); };

  // External players mutations
  const createExternalMutation = useMutation({
    mutationFn: async (data) => {
      const result = await base44.entities.SummerCampExternalPlayer.create(data);
      await logAudit({ action: 'CREACIÓN', module: 'Summer Camp', entity_type: 'SummerCampExternalPlayer', entity_id: result.id, entity_name: data.full_name, newData: data });
      return result;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['summerCampExternalPlayers'] }); setShowExternalForm(false); setEditingExternal(null); },
  });

  const updateExternalMutation = useMutation({
    mutationFn: async ({ id, data, prev }) => {
      await logAudit({ action: 'MODIFICACIÓN', module: 'Summer Camp', entity_type: 'SummerCampExternalPlayer', entity_id: id, entity_name: data.full_name, previousData: prev, newData: data });
      return base44.entities.SummerCampExternalPlayer.update(id, data);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['summerCampExternalPlayers'] }); setShowExternalForm(false); setEditingExternal(null); },
  });

  const deleteExternalMutation = useMutation({
    mutationFn: async (player) => {
      await logAudit({ action: 'ELIMINACIÓN', module: 'Summer Camp', entity_type: 'SummerCampExternalPlayer', entity_id: player.id, entity_name: player.full_name, previousData: player });
      return base44.entities.SummerCampExternalPlayer.delete(player.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['summerCampExternalPlayers'] }),
  });

  const handleExternalSubmit = (data) => {
    if (editingExternal?.id) {
      updateExternalMutation.mutate({ id: editingExternal.id, data, prev: editingExternal });
    } else {
      createExternalMutation.mutate(data);
    }
  };

  // KPIs
  const semanasPayments = payments.filter(p => p.payment_type === 'semana');
  const uniformePayments = payments.filter(p => p.payment_type === 'uniforme');
  const debtorPayments = payments.filter(p => p.status === 'pendiente' || p.status === 'parcial');
  const totalRecaudado = payments.filter(p => p.status === 'pagado').reduce((s, p) => s + (p.amount || 0), 0);
  const totalDescuentos = payments.reduce((s, p) => s + (p.discount || 0), 0);
  const participantes = new Set(payments.map(p => p.player_id)).size;
  const totalSemanas = semanasPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const totalUniformes = uniformePayments.reduce((s, p) => s + (p.amount || 0), 0);

  const weekStats = [1, 2, 3, 4].map(w => ({
    week: w,
    count: semanasPayments.filter(p => p.week_number === w).length,
    total: semanasPayments.filter(p => p.week_number === w).reduce((s, p) => s + (p.amount || 0), 0),
  }));

  return (
    <div className="space-y-5">
      {/* Modal Form unificado */}
      {showForm && (
        <SummerCampPaymentForm
          weekPrice={weekPrice}
          payment={editingPayment}
          players={players}
          externalPlayers={externalPlayers}
          type={formType}
          onSubmit={handleSubmit}
          onCancel={() => { setShowForm(false); setEditingPayment(null); setPayingExternalPlayer(null); }}
          isLoading={batchMutation.isPending || updateMutation.isPending}
        />
      )}
      {/* Modal externo */}
      {showExternalForm && (
        <ExternalPlayerForm
          player={editingExternal}
          onSubmit={handleExternalSubmit}
          onCancel={() => { setShowExternalForm(false); setEditingExternal(null); }}
          isLoading={createExternalMutation.isPending || updateExternalMutation.isPending}
        />
      )}

      <ERPPageHeader
        icon={Sun}
        iconColor="text-yellow-600"
        iconBg="bg-yellow-50"
        title="Summer Camp 2026"
        subtitle="Control de ingresos por semanas y uniformes"
        breadcrumb={['BIA', 'Summer Camp']}
        actions={
          <>
            <Button size="sm" onClick={() => openNew('semana')} className="bg-sky-600 hover:bg-sky-700 gap-1.5">
              <Calendar className="w-4 h-4" /> Nuevo Pago
            </Button>
            <Button size="sm" onClick={() => { setEditingExternal(null); setShowExternalForm(true); }} className="bg-violet-600 hover:bg-violet-700 gap-1.5">
              <UserPlus className="w-4 h-4" /> Registrar Externo
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Recaudado</span>
            </div>
            <p className="text-2xl font-bold text-emerald-700">{formatCurrency(totalRecaudado)}</p>
            {totalDescuentos > 0 && <p className="text-xs text-red-400 mt-1">Descuentos: -{formatCurrency(totalDescuentos)}</p>}
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-sky-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-sky-600" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Semanas</span>
            </div>
            <p className="text-2xl font-bold text-sky-700">{formatCurrency(totalSemanas)}</p>
            <p className="text-xs text-gray-400 mt-1">{semanasPayments.length} registros</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-orange-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Shirt className="w-4 h-4 text-orange-600" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Uniformes</span>
            </div>
            <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalUniformes)}</p>
            <p className="text-xs text-gray-400 mt-1">{uniformePayments.length} packs</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Participantes</span>
            </div>
            <p className="text-2xl font-bold text-purple-700">{participantes}</p>
            <p className="text-xs text-gray-400 mt-1">jugadores únicos</p>
          </CardContent>
        </Card>
      </div>

      {/* Resumen semanal */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-bold text-gray-600 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Tag className="w-3.5 h-3.5" /> Avance por Semana
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {weekStats.map(w => (
              <div key={w.week} className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-center">
                <p className="text-xs font-bold text-sky-600 uppercase mb-1">Semana {w.week}</p>
                <p className="text-xl font-bold text-sky-800">{formatCurrency(w.total)}</p>
                <p className="text-xs text-gray-500 mt-0.5">{w.count} pagos</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">Todos ({payments.length})</TabsTrigger>
          <TabsTrigger value="semana" className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4" /> Semanas ({semanasPayments.length})
          </TabsTrigger>
          <TabsTrigger value="uniforme" className="flex items-center gap-1.5">
            <Shirt className="w-4 h-4" /> Uniformes ({uniformePayments.length})
          </TabsTrigger>
          <TabsTrigger value="deudores" className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-red-500" />
            Morosos {debtorPayments.length > 0 && <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{debtorPayments.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="externos" className="flex items-center gap-1.5">
            <UserPlus className="w-4 h-4 text-violet-600" />
            Externos {externalPlayers.length > 0 && <span className="ml-1 bg-violet-500 text-white text-xs rounded-full px-1.5 py-0.5">{externalPlayers.length}</span>}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4">
          <SummerCampList payments={payments} players={players} isLoading={paymentsLoading || playersLoading} onEdit={handleEdit} onDelete={canDelete ? handleDelete : null} onReverse={isAdmin ? (p) => { setReversarInfo(p); setMotivoReverso(''); } : null} currentUserEmail={currentUser?.email} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="semana" className="mt-4">
          <SummerCampList payments={payments} players={players} isLoading={paymentsLoading} onEdit={handleEdit} onDelete={canDelete ? handleDelete : null} onReverse={isAdmin ? (p) => { setReversarInfo(p); setMotivoReverso(''); } : null} currentUserEmail={currentUser?.email} isAdmin={isAdmin} filterType="semana" />
        </TabsContent>
        <TabsContent value="uniforme" className="mt-4">
          <SummerCampList payments={payments} players={players} isLoading={paymentsLoading} onEdit={handleEdit} onDelete={canDelete ? handleDelete : null} onReverse={isAdmin ? (p) => { setReversarInfo(p); setMotivoReverso(''); } : null} currentUserEmail={currentUser?.email} isAdmin={isAdmin} filterType="uniforme" />
        </TabsContent>
        <TabsContent value="deudores" className="mt-4">
          <SummerCampDebtors payments={payments} players={players} onEdit={handleEdit} onDelete={canDelete ? handleDelete : null} onReverse={isAdmin ? (p) => { setReversarInfo(p); setMotivoReverso(''); } : null} currentUserEmail={currentUser?.email} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="externos" className="mt-4">
          <ExternalPlayersList
            players={externalPlayers}
            payments={payments}
            isLoading={externalLoading}
            onEdit={(p) => { setEditingExternal(p); setShowExternalForm(true); }}
            onDelete={(p) => { confirmar('¿Eliminar este jugador externo?').then((ok) => ok && deleteExternalMutation.mutate(p)); }}
            onRegisterPayment={(p) => { setPayingExternalPlayer(p); setFormType('semana'); setShowForm(true); }}
          />
        </TabsContent>
      </Tabs>

      {/* Modal Reversar Pago (storno #80) */}
      {reversarInfo && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Reversar pago (storno)</h3>
            <p className="text-sm text-gray-600">
              {reversarInfo.player_name || 'Pago Summer'} — {reversarInfo.payment_type === 'semana' ? `Semana ${reversarInfo.week_number}` : 'Uniformes'} — <span className="font-bold text-red-600">{formatCurrency(reversarInfo.amount)}</span>
            </p>
            <p className="text-xs text-gray-500">Se creará un contra-movimiento negativo ligado al original. El pago original no se modifica ni se borra.</p>
            <div>
              <label className="text-sm font-medium text-gray-700">Motivo del reverso (obligatorio)</label>
              <textarea className="mt-1 w-full border rounded-md p-2 text-sm" rows={3} value={motivoReverso}
                onChange={(e) => setMotivoReverso(e.target.value)}
                placeholder="Ej. Método de pago incorrecto: fue parte MP y parte efectivo" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setReversarInfo(null); setMotivoReverso(''); }}>Cancelar</Button>
              <Button className="bg-amber-600 hover:bg-amber-700"
                disabled={motivoReverso.trim().length < 5 || reversarMutation.isPending}
                onClick={() => reversarMutation.mutate({ payment: reversarInfo, motivo: motivoReverso.trim() })}>
                Reversar pago
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
