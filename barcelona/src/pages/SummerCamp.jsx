import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
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

const WEEK_PRICE = 1200;
const UNIFORM_PRICE = 950;

export default function SummerCamp() {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['summerCampPayments'] });
      setShowForm(false);
      setEditingPayment(null);
    },
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
    },
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

  const handleSubmit = (data, isLast = true) => {
    if (editingPayment?.id) {
      updateMutation.mutate({ id: editingPayment.id, data, prev: editingPayment });
    } else {
      // Para mes_completo se llama 4 veces; solo cerrar modal en el último
      base44.entities.SummerCampPayment.create(data).then(async (result) => {
        await logAudit({
          action: 'CREACIÓN', module: 'Summer Camp', entity_type: 'SummerCampPayment',
          entity_id: result.id,
          entity_name: `${data.player_name} - ${data.payment_type === 'semana' ? `Semana ${data.week_number}` : 'Uniformes'}`,
          newData: data,
          details: `Monto: ${formatCurrency(data.amount)}, Descuento: ${formatCurrency(data.discount || 0)}`,
        });
        if (isLast) {
          queryClient.invalidateQueries({ queryKey: ['summerCampPayments'] });
          setShowForm(false);
          setEditingPayment(null);
          setPayingExternalPlayer(null);
        }
      });
    }
  };

  const handleEdit = (p) => { setEditingPayment(p); setFormType(p.payment_type); setShowForm(true); };
  const handleDelete = (p) => { if (confirm('¿Eliminar este registro?')) deleteMutation.mutate(p); };
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
          payment={editingPayment}
          players={players}
          externalPlayers={externalPlayers}
          type={formType}
          onSubmit={handleSubmit}
          onCancel={() => { setShowForm(false); setEditingPayment(null); setPayingExternalPlayer(null); }}
          isLoading={createMutation.isPending || updateMutation.isPending}
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
          <SummerCampList payments={payments} players={players} isLoading={paymentsLoading || playersLoading} onEdit={handleEdit} onDelete={handleDelete} />
        </TabsContent>
        <TabsContent value="semana" className="mt-4">
          <SummerCampList payments={payments} players={players} isLoading={paymentsLoading} onEdit={handleEdit} onDelete={handleDelete} filterType="semana" />
        </TabsContent>
        <TabsContent value="uniforme" className="mt-4">
          <SummerCampList payments={payments} players={players} isLoading={paymentsLoading} onEdit={handleEdit} onDelete={handleDelete} filterType="uniforme" />
        </TabsContent>
        <TabsContent value="deudores" className="mt-4">
          <SummerCampDebtors payments={payments} players={players} onEdit={handleEdit} onDelete={handleDelete} />
        </TabsContent>
        <TabsContent value="externos" className="mt-4">
          <ExternalPlayersList
            players={externalPlayers}
            payments={payments}
            isLoading={externalLoading}
            onEdit={(p) => { setEditingExternal(p); setShowExternalForm(true); }}
            onDelete={(p) => { if (confirm('¿Eliminar este jugador externo?')) deleteExternalMutation.mutate(p); }}
            onRegisterPayment={(p) => { setPayingExternalPlayer(p); setFormType('semana'); setShowForm(true); }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}