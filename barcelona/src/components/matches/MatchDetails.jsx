import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, X, Save, Trash2, Target, Users, Award } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function MatchDetails({ match, players, onBack }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    player_id: '',
    participated: true,
    minutes_played: '',
    goals: 0,
    assists: 0,
    yellow_cards: 0,
    red_cards: 0,
    notes: '',
  });

  const queryClient = useQueryClient();

  const { data: matchPlayers = [] } = useQuery({
    queryKey: ['matchPlayers'],
    queryFn: () => base44.entities.MatchPlayer.list(),
  });

  const playersInMatch = matchPlayers.filter(mp => mp.match_id === match.id);
  const participatingPlayerIds = new Set(playersInMatch.map(mp => mp.player_id));

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.MatchPlayer.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matchPlayers'] });
      setShowForm(false);
      setFormData({
        player_id: '',
        participated: true,
        minutes_played: '',
        goals: 0,
        assists: 0,
        yellow_cards: 0,
        red_cards: 0,
        notes: '',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.MatchPlayer.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matchPlayers'] });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({
      ...formData,
      match_id: match.id,
      minutes_played: parseInt(formData.minutes_played) || 0,
      goals: parseInt(formData.goals) || 0,
      assists: parseInt(formData.assists) || 0,
      yellow_cards: parseInt(formData.yellow_cards) || 0,
      red_cards: parseInt(formData.red_cards) || 0,
    });
  };

  const getPlayerName = (playerId) => {
    const player = players.find(p => p.id === playerId);
    return player?.full_name || 'Desconocido';
  };

  const totalGoals = playersInMatch.reduce((sum, mp) => sum + (mp.goals || 0), 0);
  const totalAssists = playersInMatch.reduce((sum, mp) => sum + (mp.assists || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {match.home_team} vs {match.away_team}
          </h1>
          <p className="text-gray-600">{format(new Date(match.date), "d 'de' MMMM, yyyy", { locale: es })}</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Añadir Jugador
        </Button>
      </div>

      {/* Match Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-2 border-blue-200">
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Resultado</p>
            <p className="text-3xl font-bold text-blue-600">
              {match.home_goals} - {match.away_goals}
            </p>
          </CardContent>
        </Card>
        <Card className="border-2 border-green-200">
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Jugadores</p>
            <p className="text-3xl font-bold text-green-600">{playersInMatch.length}</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-purple-600" />
              <p className="text-sm text-gray-600">Goles</p>
            </div>
            <p className="text-3xl font-bold text-purple-600">{totalGoals}</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-orange-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-orange-600" />
              <p className="text-sm text-gray-600">Asistencias</p>
            </div>
            <p className="text-3xl font-bold text-orange-600">{totalAssists}</p>
          </CardContent>
        </Card>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="shadow-lg border-2 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Añadir Jugador al Partido</span>
              <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}>
                <X className="w-5 h-5" />
              </Button>
            </CardTitle>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>Jugador *</Label>
                  <Select
                    value={formData.player_id}
                    onValueChange={(value) => setFormData({ ...formData, player_id: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar jugador" />
                    </SelectTrigger>
                    <SelectContent>
                      {players.filter(p => p.status === 'activo').map((player) => (
                        <SelectItem key={player.id} value={player.id}>
                          {player.full_name} {participatingPlayerIds.has(player.id) ? '✓' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Minutos Jugados</Label>
                  <Input
                    type="number"
                    min="0"
                    max="120"
                    value={formData.minutes_played}
                    onChange={(e) => setFormData({ ...formData, minutes_played: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Goles</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.goals}
                    onChange={(e) => setFormData({ ...formData, goals: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Asistencias</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.assists}
                    onChange={(e) => setFormData({ ...formData, assists: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tarjetas Amarillas</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.yellow_cards}
                    onChange={(e) => setFormData({ ...formData, yellow_cards: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tarjetas Rojas</Label>
                  <Input
                    type="number"
                    min="0"
                    max="1"
                    value={formData.red_cards}
                    onChange={(e) => setFormData({ ...formData, red_cards: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
            <div className="px-6 pb-6 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                <Save className="w-4 h-4 mr-2" />
                Guardar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Players List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Jugadores en el Partido
          </CardTitle>
        </CardHeader>
        <CardContent>
          {playersInMatch.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No hay jugadores registrados para este partido</p>
            </div>
          ) : (
            <div className="space-y-3">
              {playersInMatch.map((mp) => (
                <div key={mp.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border hover:shadow-md transition-all">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-2">{getPlayerName(mp.player_id)}</h4>
                    <div className="flex flex-wrap gap-3 text-sm">
                      {mp.minutes_played > 0 && (
                        <Badge variant="outline" className="bg-blue-50">
                          {mp.minutes_played} min
                        </Badge>
                      )}
                      {mp.goals > 0 && (
                        <Badge className="bg-green-100 text-green-800">
                          <Target className="w-3 h-3 mr-1" />
                          {mp.goals} gol{mp.goals > 1 ? 'es' : ''}
                        </Badge>
                      )}
                      {mp.assists > 0 && (
                        <Badge className="bg-purple-100 text-purple-800">
                          <Award className="w-3 h-3 mr-1" />
                          {mp.assists} asist{mp.assists > 1 ? 's' : ''}
                        </Badge>
                      )}
                      {mp.yellow_cards > 0 && (
                        <Badge className="bg-yellow-100 text-yellow-800">
                          {mp.yellow_cards} TA
                        </Badge>
                      )}
                      {mp.red_cards > 0 && (
                        <Badge className="bg-red-100 text-red-800">
                          {mp.red_cards} TR
                        </Badge>
                      )}
                    </div>
                    {mp.notes && (
                      <p className="text-xs text-gray-600 mt-2">{mp.notes}</p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:bg-red-50 ml-4"
                    onClick={() => {
                      if (confirm('¿Eliminar este jugador del partido?')) {
                        deleteMutation.mutate(mp.id);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}