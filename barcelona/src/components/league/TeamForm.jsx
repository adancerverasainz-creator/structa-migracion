import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Save, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

export default function TeamForm({ team, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState(team || {
    name: '',
    registration_date: format(new Date(), 'yyyy-MM-dd'),
    player_count: '',
    player_names: [''],
    status: 'activo',
    matches_played: 0,
    matches_won: 0,
    matches_tied: 0,
    matches_lost: 0,
    goals_for: 0,
    goals_against: 0,
    points: 0,
    top_scorer: '',
    top_scorer_goals: 0,
    fouls: 0,
    yellow_cards: 0,
    red_cards: 0,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      player_count: parseInt(formData.player_count) || 0,
      player_names: formData.player_names.filter(name => name.trim() !== ''),
      matches_played: parseInt(formData.matches_played) || 0,
      matches_won: parseInt(formData.matches_won) || 0,
      matches_tied: parseInt(formData.matches_tied) || 0,
      matches_lost: parseInt(formData.matches_lost) || 0,
      goals_for: parseInt(formData.goals_for) || 0,
      goals_against: parseInt(formData.goals_against) || 0,
      points: parseInt(formData.points) || 0,
      top_scorer_goals: parseInt(formData.top_scorer_goals) || 0,
      fouls: parseInt(formData.fouls) || 0,
      yellow_cards: parseInt(formData.yellow_cards) || 0,
      red_cards: parseInt(formData.red_cards) || 0,
    });
  };

  const addPlayer = () => {
    setFormData({ ...formData, player_names: [...formData.player_names, ''] });
  };

  const removePlayer = (index) => {
    const newPlayers = formData.player_names.filter((_, i) => i !== index);
    setFormData({ ...formData, player_names: newPlayers });
  };

  const updatePlayer = (index, value) => {
    const newPlayers = [...formData.player_names];
    newPlayers[index] = value;
    setFormData({ ...formData, player_names: newPlayers });
  };

  return (
    <Card className="shadow-lg border-2 border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{team ? 'Editar Equipo' : 'Registrar Nuevo Equipo'}</span>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-5 h-5" />
          </Button>
        </CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del Equipo *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registration_date">Fecha de Inscripción *</Label>
              <Input
                id="registration_date"
                type="date"
                value={formData.registration_date}
                onChange={(e) => setFormData({ ...formData, registration_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="player_count">Cantidad de Jugadores *</Label>
              <Input
                id="player_count"
                type="number"
                value={formData.player_count}
                onChange={(e) => setFormData({ ...formData, player_count: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Jugadores del Equipo</Label>
              <Button type="button" size="sm" onClick={addPlayer} variant="outline">
                <Plus className="w-4 h-4 mr-1" />
                Agregar Jugador
              </Button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {formData.player_names.map((player, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder={`Jugador ${index + 1}`}
                    value={player}
                    onChange={(e) => updatePlayer(index, e.target.value)}
                  />
                  {formData.player_names.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removePlayer(index)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <h3 className="font-semibold text-lg mb-4 text-gray-900">Estadísticas del Equipo</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="matches_played">Partidos Jugados</Label>
                <Input
                  id="matches_played"
                  type="number"
                  value={formData.matches_played}
                  onChange={(e) => setFormData({ ...formData, matches_played: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="matches_won">Ganados</Label>
                <Input
                  id="matches_won"
                  type="number"
                  value={formData.matches_won}
                  onChange={(e) => setFormData({ ...formData, matches_won: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="matches_tied">Empatados</Label>
                <Input
                  id="matches_tied"
                  type="number"
                  value={formData.matches_tied}
                  onChange={(e) => setFormData({ ...formData, matches_tied: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="matches_lost">Perdidos</Label>
                <Input
                  id="matches_lost"
                  type="number"
                  value={formData.matches_lost}
                  onChange={(e) => setFormData({ ...formData, matches_lost: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goals_for">Goles a Favor</Label>
                <Input
                  id="goals_for"
                  type="number"
                  value={formData.goals_for}
                  onChange={(e) => setFormData({ ...formData, goals_for: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goals_against">Goles en Contra</Label>
                <Input
                  id="goals_against"
                  type="number"
                  value={formData.goals_against}
                  onChange={(e) => setFormData({ ...formData, goals_against: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="points">Puntos</Label>
                <Input
                  id="points"
                  type="number"
                  value={formData.points}
                  onChange={(e) => setFormData({ ...formData, points: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fouls">Faltas</Label>
                <Input
                  id="fouls"
                  type="number"
                  value={formData.fouls}
                  onChange={(e) => setFormData({ ...formData, fouls: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="top_scorer">Goleador del Equipo</Label>
                <Input
                  id="top_scorer"
                  value={formData.top_scorer}
                  onChange={(e) => setFormData({ ...formData, top_scorer: e.target.value })}
                  placeholder="Nombre del goleador"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="top_scorer_goals">Goles del Goleador</Label>
                <Input
                  id="top_scorer_goals"
                  type="number"
                  value={formData.top_scorer_goals}
                  onChange={(e) => setFormData({ ...formData, top_scorer_goals: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="yellow_cards">Tarjetas Amarillas</Label>
                <Input
                  id="yellow_cards"
                  type="number"
                  value={formData.yellow_cards}
                  onChange={(e) => setFormData({ ...formData, yellow_cards: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="red_cards">Tarjetas Rojas</Label>
                <Input
                  id="red_cards"
                  type="number"
                  value={formData.red_cards}
                  onChange={(e) => setFormData({ ...formData, red_cards: e.target.value })}
                />
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" />
            {team ? 'Actualizar' : 'Guardar'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}