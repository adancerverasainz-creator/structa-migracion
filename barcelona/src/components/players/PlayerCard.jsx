import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Phone, Mail, Calendar, DollarSign, CheckCircle, AlertCircle, GraduationCap } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function PlayerCard({ player, payments, onEdit, onDelete }) {
  const currentMonth = format(new Date(), 'MMMM yyyy', { locale: es });
  const now = new Date();
  
  // Only check payments if the player joined before or during the current month
  const joinDate = player.join_date ? new Date(player.join_date.split('T')[0] + 'T12:00:00') : null;
  const joinedBeforeOrDuringCurrentMonth = !joinDate || 
    (joinDate.getFullYear() < now.getFullYear()) ||
    (joinDate.getFullYear() === now.getFullYear() && joinDate.getMonth() <= now.getMonth());

  const hasPaymentThisMonth = joinedBeforeOrDuringCurrentMonth && payments.some(p => 
    p.player_id === player.id && 
    p.month?.toLowerCase().includes(format(now, 'MMMM', { locale: es }).toLowerCase())
  );

  return (
    <Card className={`hover:shadow-xl transition-all border-2 ${
      !joinedBeforeOrDuringCurrentMonth ? 'border-blue-200' : hasPaymentThisMonth ? 'border-green-200' : 'border-red-200'
    }`}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900">{player.full_name}</h3>
            <div className="flex items-center gap-2 mt-1">
              {player.status === 'activo' ? (
                <Badge className="bg-green-100 text-green-800">Activo</Badge>
              ) : player.status === 'baja' ? (
                <Badge className="bg-red-100 text-red-800">Baja</Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-800">Inactivo</Badge>
              )}
              {player.category && (
                <Badge variant="outline">{player.category}</Badge>
              )}
              {(player.scholarship && player.scholarship !== 'ninguna') && (
                <Badge className="bg-purple-100 text-purple-800 flex items-center gap-1">
                  <GraduationCap className="w-3 h-3" />
                  Beca {player.scholarship}
                </Badge>
              )}
            </div>
          </div>
          {!joinedBeforeOrDuringCurrentMonth ? null : hasPaymentThisMonth ? (
            <CheckCircle className="w-6 h-6 text-green-500" />
          ) : (
            <AlertCircle className="w-6 h-6 text-red-500" />
          )}
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <DollarSign className="w-4 h-4 text-blue-600" />
            <span className="font-semibold">Cuota: ${player.monthly_fee || 0}</span>
          </div>
          
          <div className="bg-gray-50 p-3 rounded-lg space-y-2">
            <p className="font-semibold text-gray-900 text-sm">{player.parent_name}</p>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Phone className="w-3 h-3" />
              <span>{player.parent_phone}</span>
            </div>
            {player.parent_email && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Mail className="w-3 h-3" />
                <span>{player.parent_email}</span>
              </div>
            )}
          </div>

          {player.birth_date && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Calendar className="w-3 h-3" />
              <span>Nacimiento: {player.birth_date.split('T')[0].split('-').reverse().join('/')}</span>
            </div>
          )}

          {player.join_date && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Calendar className="w-3 h-3" />
              <span>Ingreso: {player.join_date.split('T')[0].split('-').reverse().join('/')}</span>
            </div>
          )}

          {!hasPaymentThisMonth && player.status === 'activo' && joinedBeforeOrDuringCurrentMonth && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2">
              <p className="text-xs text-red-700 font-medium">Sin pago en {currentMonth}</p>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onEdit(player)}
          >
            <Edit className="w-4 h-4 mr-1" />
            Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => onDelete(player)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}