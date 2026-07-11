import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trophy, Search } from 'lucide-react';
import TournamentForm from '../components/tournaments/TournamentForm';
import TournamentCard from '../components/tournaments/TournamentCard';
import TournamentPayments from '../components/tournaments/TournamentPayments';
import ERPPageHeader from '../components/layout/ERPPageHeader';
import KPICard from '../components/layout/KPICard';

export default function Tournaments() {
  const [showForm, setShowForm] = useState(false);
  const [editingTournament, setEditingTournament] = useState(null);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(user => setCurrentUser(user)).catch(() => {});
  }, []);

  const { data: tournaments = [], isLoading } = useQuery({
    queryKey: ['tournaments'],
    queryFn: () => base44.entities.Tournament.list('-date'),
  });

  const { data: tournamentPayments = [] } = useQuery({
    queryKey: ['tournamentPayments'],
    queryFn: () => base44.entities.TournamentPayment.list(),
    staleTime: 0,
  });

  const { data: players = [] } = useQuery({
    queryKey: ['players'],
    queryFn: () => base44.entities.Player.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Tournament.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      setShowForm(false);
      setEditingTournament(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Tournament.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      setShowForm(false);
      setEditingTournament(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (tournament) => {
      const user = await base44.auth.me();
      await base44.entities.AuditLog.create({
        action: 'ELIMINACIÓN',
        module: 'Torneos',
        entity_type: 'Tournament',
        entity_id: tournament.id,
        entity_name: tournament.name,
        user_email: user.email,
        details: `Fecha: ${tournament.date}, Cuota: $${tournament.registration_fee}`
      });
      return base44.entities.Tournament.delete(tournament.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['tournamentPayments'] });
      queryClient.invalidateQueries({ queryKey: ['players'] });
      setSelectedTournament(null);
    },
  });

  const handleSubmit = (data) => {
    if (editingTournament) {
      updateMutation.mutate({ id: editingTournament.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (tournament) => {
    setEditingTournament(tournament);
    setShowForm(true);
  };

  const handleDelete = async (tournament) => {
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      alert('Solo administradores pueden eliminar torneos');
      return;
    }
    if (confirm('¿Estás seguro de eliminar este torneo?')) {
      deleteMutation.mutate(tournament);
    }
  };

  if (selectedTournament) {
    if (!selectedTournament || !players || !tournamentPayments) {
      return (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <p className="mt-2 text-gray-600">Cargando datos del torneo...</p>
        </div>
      );
    }
    
    return (
      <TournamentPayments
        tournament={selectedTournament}
        players={players}
        payments={tournamentPayments}
        onBack={() => setSelectedTournament(null)}
      />
    );
  }

  const proximos = tournaments.filter(t => t.status === 'proximo').length;
  const enCurso = tournaments.filter(t => t.status === 'en_curso').length;
  const finalizados = tournaments.filter(t => t.status === 'finalizado').length;

  return (
    <div className="space-y-5">
      <ERPPageHeader
        icon={Trophy}
        iconColor="text-purple-600"
        iconBg="bg-purple-50"
        title="Gestión de Torneos"
        subtitle="Administra copas, torneos y pagos de inscripción"
        breadcrumb={['BIA', 'Torneos']}
        actions={
          <Button size="sm" onClick={() => { setEditingTournament(null); setShowForm(true); }} className="bg-purple-600 hover:bg-purple-700 gap-1.5">
            <Plus className="w-4 h-4" /> Nuevo Torneo
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-4">
        <KPICard title="Total Torneos" value={tournaments.length} icon={Trophy} color="purple" />
        <KPICard title="Próximos" value={proximos} icon={Trophy} color="blue" />
        <KPICard title="Finalizados" value={finalizados} icon={Trophy} color="gray" />
      </div>

      {/* Form */}
      {showForm && (
        <TournamentForm
          tournament={editingTournament}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowForm(false);
            setEditingTournament(null);
          }}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* Search Bar */}
      {!showForm && tournaments.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            type="text"
            placeholder="Buscar torneo por nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      {/* Tournaments Grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <p className="mt-2 text-gray-600">Cargando torneos...</p>
        </div>
      ) : tournaments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Trophy className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay torneos</h3>
            <p className="text-gray-600 mb-4">Comienza agregando tu primer torneo</p>
            <Button onClick={() => setShowForm(true)} className="bg-purple-600 hover:bg-purple-700">
              <Plus className="w-4 h-4 mr-2" />
              Agregar Torneo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments
            .filter((tournament) => 
              tournament.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              tournament.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              tournament.location?.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .map((tournament) => (
              <TournamentCard
                key={tournament.id}
                tournament={tournament}
                tournamentPayments={tournamentPayments}
                players={players}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onViewPayments={() => setSelectedTournament(tournament)}
                isAdmin={currentUser?.role === 'admin'}
              />
            ))}
        </div>
      )}
    </div>
  );
}