import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Shield, Users, DollarSign, Trophy } from 'lucide-react';
import { formatCurrency } from '@/components/lib/formatCurrency';
import TeamCard from '@/components/league/TeamCard';
import TeamForm from '@/components/league/TeamForm';
import TeamPayments from '@/components/league/TeamPayments';
import StandingsTable from '@/components/league/StandingsTable';
import ERPPageHeader from '@/components/layout/ERPPageHeader';

export default function Liga() {
  const queryClient = useQueryClient();
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [managingTeam, setManagingTeam] = useState(null);

  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list(),
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['leaguePayments'],
    queryFn: () => base44.entities.LeaguePayment.list('-payment_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Team.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setShowTeamForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Team.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setEditingTeam(null);
      setShowTeamForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Team.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teams'] }),
  });

  const handleSubmit = (data) => {
    if (editingTeam) {
      updateMutation.mutate({ id: editingTeam.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (team) => {
    setEditingTeam(team);
    setShowTeamForm(true);
    setManagingTeam(null);
  };

  const handleDelete = (team) => {
    if (confirm(`¿Eliminar el equipo "${team.name}"?`)) {
      deleteMutation.mutate(team.id);
    }
  };

  // KPIs
  const activeTeams = teams.filter(t => t.status === 'activo').length;
  const totalInscripciones = payments.filter(p => p.payment_type === 'inscripcion').reduce((s, p) => s + (p.amount || 0), 0);
  const totalArbitrajes = payments.filter(p => p.payment_type === 'arbitraje').reduce((s, p) => s + (p.amount || 0), 0);
  const totalRecaudado = payments.reduce((s, p) => s + (p.amount || 0), 0);

  // If managing a team's payments, show that sub-view
  if (managingTeam) {
    return (
      <TeamPayments
        team={managingTeam}
        onBack={() => setManagingTeam(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <ERPPageHeader
        icon={Shield}
        iconColor="text-blue-600"
        iconBg="bg-blue-50"
        title="Liga Fut 7"
        subtitle="Gestión de equipos, standings y pagos de la liga"
        breadcrumb={['BIA', 'Liga']}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => { setEditingTeam(null); setShowTeamForm(true); }}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" /> Equipo
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 gap-1.5"
              onClick={() => {
                if (teams.length > 0) {
                  setManagingTeam(teams[0]);
                } else {
                  alert('Primero registra un equipo para poder registrar pagos.');
                }
              }}
            >
              <Plus className="w-4 h-4" /> Registrar Pago
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-blue-500" />
              <p className="text-sm text-gray-500">Equipos Activos</p>
            </div>
            <p className="text-3xl font-bold text-blue-600">{activeTeams}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-green-500" />
              <p className="text-sm text-gray-500">Inscripciones</p>
            </div>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalInscripciones)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-orange-500" />
              <p className="text-sm text-gray-500">Arbitrajes</p>
            </div>
            <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalArbitrajes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-purple-500" />
              <p className="text-sm text-gray-500">Total Recaudado</p>
            </div>
            <p className="text-2xl font-bold text-purple-600">{formatCurrency(totalRecaudado)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Team Form */}
      {showTeamForm && (
        <TeamForm
          team={editingTeam}
          onSubmit={handleSubmit}
          onCancel={() => { setShowTeamForm(false); setEditingTeam(null); }}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* Tabs */}
      <Tabs defaultValue="standings">
        <TabsList>
          <TabsTrigger value="standings">Standings</TabsTrigger>
          <TabsTrigger value="pagos">Pagos</TabsTrigger>
          <TabsTrigger value="equipos">Equipos</TabsTrigger>
        </TabsList>

        <TabsContent value="standings" className="mt-4">
          {teamsLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : teams.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Trophy className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-600">No hay equipos registrados en la liga</h3>
                <p className="text-sm text-gray-400 mt-1">Registra el primer equipo para ver el standings</p>
              </CardContent>
            </Card>
          ) : (
            <StandingsTable teams={teams} />
          )}
        </TabsContent>

        <TabsContent value="pagos" className="mt-4">
          {paymentsLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : payments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-600">Sin pagos registrados</h3>
                <p className="text-gray-400 text-sm mt-1">Accede a un equipo para registrar sus pagos</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {payments.map(payment => {
                const team = teams.find(t => t.id === payment.team_id);
                return (
                  <Card key={payment.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{team?.name || '—'}</p>
                        <p className="text-sm text-gray-500">
                          {payment.payment_type === 'inscripcion' ? 'Inscripción' : `Arbitraje — Semana ${payment.week_number}`}
                          {' · '}{payment.payment_date}
                          {payment.payment_method && ` · ${payment.payment_method}`}
                        </p>
                      </div>
                      <p className="text-lg font-bold text-green-600">{formatCurrency(payment.amount)}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="equipos" className="mt-4">
          {teamsLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : teams.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-600">Sin equipos registrados</h3>
                <Button
                  onClick={() => { setEditingTeam(null); setShowTeamForm(true); }}
                  className="mt-4 bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" /> Registrar Primer Equipo
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map(team => (
                <TeamCard
                  key={team.id}
                  team={team}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onManagePayments={setManagingTeam}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
