import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Calendar, Edit, Trash2, DollarSign, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function TeamCard({ team, onEdit, onDelete, onManagePayments }) {
  return (
    <Card className="hover:shadow-xl transition-all duration-300 border-2 border-blue-100">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-xl text-blue-900 mb-2">{team.name}</CardTitle>
            <Badge variant={team.status === 'activo' ? 'default' : 'secondary'}>
              {team.status === 'activo' ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => onEdit(team)}>
              <Edit className="w-4 h-4 text-blue-600" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(team)}>
              <Trash2 className="w-4 h-4 text-red-600" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Users className="w-4 h-4" />
          <span>{team.player_count} jugadores</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="w-4 h-4" />
          <span>Inscrito: {format(new Date(team.registration_date), "d 'de' MMMM, yyyy", { locale: es })}</span>
        </div>

        {team.player_names && team.player_names.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs font-semibold text-gray-700 mb-2">Jugadores:</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {team.player_names.map((player, idx) => (
                <p key={idx} className="text-xs text-gray-600">• {player}</p>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2 mt-3">
          <Button 
            className="w-full bg-blue-600 hover:bg-blue-700" 
            onClick={() => onEdit(team)}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Actualizar Estadísticas
          </Button>
          <Button 
            className="w-full bg-green-600 hover:bg-green-700" 
            onClick={() => onManagePayments(team)}
          >
            <DollarSign className="w-4 h-4 mr-2" />
            Gestionar Pagos
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}