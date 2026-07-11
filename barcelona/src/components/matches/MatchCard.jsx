import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, MapPin, Calendar, Clock, Users } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function MatchCard({ match, onEdit, onDelete, onViewDetails }) {
  const statusColors = {
    programado: 'bg-blue-100 text-blue-800',
    en_curso: 'bg-yellow-100 text-yellow-800',
    finalizado: 'bg-green-100 text-green-800',
    cancelado: 'bg-red-100 text-red-800',
  };

  const statusLabels = {
    programado: 'Programado',
    en_curso: 'En Curso',
    finalizado: 'Finalizado',
    cancelado: 'Cancelado',
  };

  const getResult = () => {
    if (match.status === 'finalizado') {
      if (match.home_goals > match.away_goals) return 'Victoria';
      if (match.home_goals < match.away_goals) return 'Derrota';
      return 'Empate';
    }
    return null;
  };

  const result = getResult();
  const resultColors = {
    'Victoria': 'bg-green-100 text-green-800 border-green-300',
    'Derrota': 'bg-red-100 text-red-800 border-red-300',
    'Empate': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  };

  return (
    <Card className="hover:shadow-xl transition-all border-2 border-blue-200">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <Badge className={statusColors[match.status]}>
              {statusLabels[match.status]}
            </Badge>
            {match.category && (
              <Badge variant="outline" className="ml-2">{match.category}</Badge>
            )}
          </div>
        </div>

        {/* Score Display */}
        <div className="mb-4">
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
            <div className="flex-1 text-center">
              <p className="text-sm text-gray-600 mb-1">Local</p>
              <p className="font-bold text-gray-900">{match.home_team}</p>
            </div>
            <div className="px-6">
              <div className="text-3xl font-bold text-blue-600">
                {match.home_goals} - {match.away_goals}
              </div>
            </div>
            <div className="flex-1 text-center">
              <p className="text-sm text-gray-600 mb-1">Visitante</p>
              <p className="font-bold text-gray-900">{match.away_team}</p>
            </div>
          </div>
          {result && (
            <div className="mt-2">
              <Badge className={`${resultColors[result]} border w-full justify-center py-1`}>
                {result}
              </Badge>
            </div>
          )}
        </div>

        <div className="space-y-2 mb-4 text-sm">
          <div className="flex items-center gap-2 text-gray-700">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>{format(new Date(match.date), "d 'de' MMMM, yyyy", { locale: es })}</span>
          </div>
          {match.time && (
            <div className="flex items-center gap-2 text-gray-700">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>{match.time}</span>
            </div>
          )}
          {match.location && (
            <div className="flex items-center gap-2 text-gray-700">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span>{match.location}</span>
            </div>
          )}
          {match.notes && (
            <p className="text-gray-600 text-xs mt-2 line-clamp-2">{match.notes}</p>
          )}
        </div>

        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full border-blue-600 text-blue-600 hover:bg-blue-50"
            onClick={onViewDetails}
          >
            <Users className="w-4 h-4 mr-2" />
            Gestionar Jugadores
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onEdit(match)}
            >
              <Edit className="w-4 h-4 mr-1" />
              Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => onDelete(match)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}