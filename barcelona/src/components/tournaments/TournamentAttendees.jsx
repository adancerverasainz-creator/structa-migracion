import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, UserPlus, UserMinus, CheckCircle2, AlertCircle, Users, Globe } from 'lucide-react';
import { formatCurrency } from '../lib/formatCurrency';

export default function TournamentAttendees({ tournament, players, payments, onRegisterPayment, onRegisterExternalPayment }) {
  const [search, setSearch] = useState('');
  const [addSearch, setAddSearch] = useState('');
  const [showExternalForm, setShowExternalForm] = useState(false);
  const [externalName, setExternalName] = useState('');
  const [externalCategory, setExternalCategory] = useState('');
  const queryClient = useQueryClient();

  const { data: attendees = [] } = useQuery({
    queryKey: ['tournamentAttendees', tournament?.id],
    queryFn: () => base44.entities.TournamentAttendee.filter({ tournament_id: tournament?.id }),
    enabled: !!tournament?.id,
  });

  const addMutation = useMutation({
    mutationFn: (data) => base44.entities.TournamentAttendee.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tournamentAttendees', tournament?.id] }),
  });

  const removeMutation = useMutation({
    mutationFn: (attendeeId) => base44.entities.TournamentAttendee.delete(attendeeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tournamentAttendees', tournament?.id] }),
  });

  const addExternal = () => {
    if (!externalName.trim()) return;
    addMutation.mutate({
      tournament_id: tournament.id,
      is_external: true,
      external_name: externalName.trim(),
      external_category: externalCategory.trim(),
    });
    setExternalName('');
    setExternalCategory('');
    setShowExternalForm(false);
  };

  const attendeePlayerIds = new Set(attendees.filter(a => !a.is_external).map(a => a.player_id));
  const paidPlayerIds = new Set(payments.filter(p => p.status === 'pagado').map(p => p.player_id));
  const activePlayers = players.filter(p => p.status === 'activo');

  const paidExternalIds = new Set(payments.filter(p => p.external_attendee_id && p.status === 'pagado').map(p => p.external_attendee_id));

  const attendeesList = attendees.map(a => {
    if (a.is_external) {
      return { ...a, displayName: a.external_name, displayCategory: a.external_category, paid: paidExternalIds.has(a.id), isExternal: true };
    }
    const player = players.find(p => p.id === a.player_id);
    return {
      ...a,
      player,
      displayName: player?.full_name,
      displayCategory: player?.category,
      paid: paidPlayerIds.has(a.player_id),
      isExternal: false,
    };
  }).filter(a => a.isExternal || a.player);

  const availablePlayers = activePlayers.filter(p => !attendeePlayerIds.has(p.id));
  const filteredAvailable = addSearch
    ? availablePlayers.filter(p =>
        p.full_name.toLowerCase().includes(addSearch.toLowerCase()) ||
        p.category?.toLowerCase().includes(addSearch.toLowerCase())
      )
    : availablePlayers;

  const filteredAttendees = search
    ? attendeesList.filter(a =>
        a.displayName?.toLowerCase().includes(search.toLowerCase()) ||
        a.displayCategory?.toLowerCase().includes(search.toLowerCase())
      )
    : attendeesList;

  const paidCount = attendeesList.filter(a => a.paid).length;
  const pendingCount = attendeesList.filter(a => !a.paid).length;

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-2 border-purple-200">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <Users className="w-8 h-8 text-purple-500" />
            <div>
              <p className="text-xs text-gray-500">Total asistentes</p>
              <p className="text-2xl font-bold text-purple-600">{attendeesList.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-green-200">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-xs text-gray-500">Pagaron</p>
              <p className="text-2xl font-bold text-green-600">{paidCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-red-200">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <div>
              <p className="text-xs text-gray-500">Sin pago</p>
              <p className="text-2xl font-bold text-red-600">{pendingCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lista de asistentes */}
        <Card>
          <CardContent className="pt-4">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" /> Asistentes al torneo
            </h3>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar asistente..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {filteredAttendees.length === 0 ? (
              <p className="text-center text-gray-500 py-6 text-sm">
                {attendeesList.length === 0 ? 'Aún no hay asistentes registrados' : 'Sin resultados'}
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredAttendees.map(a => (
                  <div key={a.id} className={`flex items-center justify-between p-3 rounded-lg border-2 ${a.paid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 text-sm truncate">{a.displayName}</p>
                        {a.isExternal && (
                          <Badge className="bg-blue-100 text-blue-700 border border-blue-300 text-xs flex items-center gap-1">
                            <Globe className="w-3 h-3" /> Externo
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {a.displayCategory && <span className="text-xs text-gray-500">{a.displayCategory}</span>}
                        {a.paid
                          ? <Badge className="bg-green-100 text-green-700 border-green-300 border text-xs">✓ Pagado</Badge>
                          : <Badge className="bg-red-100 text-red-700 border-red-300 border text-xs">Pendiente</Badge>
                        }
                      </div>
                    </div>
                    <div className="flex gap-2 ml-2">
                      {!a.isExternal && !a.paid && (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-xs px-2 h-7"
                          onClick={() => onRegisterPayment(a.player)}
                        >
                          Cobrar
                        </Button>
                      )}
                      {a.isExternal && !a.paid && (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-xs px-2 h-7"
                          onClick={() => onRegisterExternalPayment({ id: a.id, name: a.external_name, category: a.external_category })}
                        >
                          Cobrar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 w-7 p-0"
                        onClick={() => removeMutation.mutate(a.id)}
                        title="Quitar asistente"
                      >
                        <UserMinus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Panel derecho: agregar del club + externos */}
        <div className="space-y-4">
          {/* Agregar jugadores del club */}
          <Card>
            <CardContent className="pt-4">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Agregar jugadores del club
              </h3>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar jugador para agregar..."
                  value={addSearch}
                  onChange={e => setAddSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {filteredAvailable.length === 0 ? (
                <p className="text-center text-gray-500 py-4 text-sm">
                  {availablePlayers.length === 0 ? 'Todos los jugadores activos ya están agregados' : 'Sin resultados'}
                </p>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {filteredAvailable.map(player => (
                    <div key={player.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{player.full_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {player.category && <span className="text-xs text-gray-500">{player.category}</span>}
                          <span className="text-xs text-gray-400">{formatCurrency(player.monthly_fee)}/mes</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-purple-300 text-purple-700 hover:bg-purple-50 h-7 text-xs"
                        onClick={() => addMutation.mutate({ tournament_id: tournament.id, player_id: player.id, is_external: false })}
                        disabled={addMutation.isPending}
                      >
                        <UserPlus className="w-3 h-3 mr-1" />
                        Agregar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Agregar jugador externo */}
          <Card className="border-2 border-blue-200">
            <CardContent className="pt-4">
              <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                <Globe className="w-4 h-4" /> Agregar jugador externo
              </h3>
              {!showExternalForm ? (
                <Button
                  variant="outline"
                  className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
                  onClick={() => setShowExternalForm(true)}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Agregar externo al torneo
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-sm">Nombre completo *</Label>
                    <Input
                      placeholder="Nombre del jugador externo"
                      value={externalName}
                      onChange={e => setExternalName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">Categoría</Label>
                    <Input
                      placeholder="Ej: Sub 11, Sub 13..."
                      value={externalCategory}
                      onChange={e => setExternalCategory(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                      onClick={addExternal}
                      disabled={!externalName.trim() || addMutation.isPending}
                    >
                      Agregar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => { setShowExternalForm(false); setExternalName(''); setExternalCategory(''); }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}