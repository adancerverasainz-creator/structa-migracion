import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, MapPin, Calendar, DollarSign, Users } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '../lib/formatCurrency';

export default function TournamentCard({ tournament, tournamentPayments, players, onEdit, onDelete, onViewPayments, isAdmin }) {
  const payments = tournamentPayments.filter(p => p.tournament_id === tournament.id);
  const paidPlayers = new Set(payments.filter(p => p.status === 'pagado').map(p => p.player_id));
  const totalCollected = payments.reduce((sum, p) => sum + (p.paid_amount ?? p.amount ?? 0), 0);

  const statusColors = {
    proximo: 'bg-blue-100 text-blue-800',
    en_curso: 'bg-green-100 text-green-800',
    finalizado: 'bg-gray-100 text-gray-800',
  };

  const statusLabels = {
    proximo: 'Próximo',
    en_curso: 'En Curso',
    finalizado: 'Finalizado',
  };

  return (
    <Card className="hover:shadow-xl transition-all border-2 border-purple-200">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900 mb-2">{tournament.name}</h3>
            <Badge className={statusColors[tournament.status]}>
              {statusLabels[tournament.status]}
            </Badge>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Calendar className="w-4 h-4 text-purple-600" />
            <span>
              {tournament.date ? 
                format(new Date(tournament.date.includes('T') ? tournament.date : tournament.date + 'T00:00:00'), 'dd/MM/yyyy')
                : 'Sin fecha'}
            </span>
          </div>
          
          {tournament.location && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <MapPin className="w-4 h-4 text-purple-600" />
              <span>{tournament.location}</span>
            </div>
          )}

          {tournament.category && (
            <div className="text-sm text-gray-600">
              <span className="font-medium">Categoría:</span> {tournament.category}
            </div>
          )}

          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="w-4 h-4 text-green-600" />
            <span className="font-semibold text-green-600">
              Inscripción: {formatCurrency(tournament.registration_fee || 0)}
            </span>
          </div>

          {tournament.description && (
            <p className="text-sm text-gray-600 line-clamp-2">{tournament.description}</p>
          )}

          <div className="bg-purple-50 p-3 rounded-lg space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-600" />
                <span className="font-medium">Jugadores inscritos:</span>
              </div>
              <span className="font-bold text-purple-600">{paidPlayers.size}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700">Total recaudado:</span>
              <span className="font-bold text-green-600">{formatCurrency(totalCollected)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full border-purple-600 text-purple-600 hover:bg-purple-50"
            onClick={(e) => {
              e.stopPropagation();
              onViewPayments(tournament);
            }}
          >
            <Users className="w-4 h-4 mr-2" />
            Gestionar Pagos
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onEdit(tournament)}
            >
              <Edit className="w-4 h-4 mr-1" />
              Editar
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => onDelete(tournament)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}