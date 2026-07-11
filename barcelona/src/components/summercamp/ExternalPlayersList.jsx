import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Search, UserPlus, CreditCard, Phone, User } from 'lucide-react';

export default function ExternalPlayersList({ players, payments, isLoading, onEdit, onDelete, onRegisterPayment }) {
  const [search, setSearch] = useState('');

  const filtered = players.filter(p =>
    p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.parent_name?.toLowerCase().includes(search.toLowerCase())
  );

  const getPaymentCount = (playerId) =>
    payments.filter(p => p.external_player_id === playerId).length;

  const getTotalPaid = (playerId) =>
    payments.filter(p => p.external_player_id === playerId && p.status === 'pagado')
      .reduce((s, p) => s + (p.amount || 0), 0);

  if (isLoading) return <div className="text-center py-12 text-gray-400">Cargando...</div>;

  return (
    <div className="space-y-4">
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Buscar jugador externo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <UserPlus className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium">Sin jugadores externos</p>
          <p className="text-sm mt-1">Registra el primer jugador con el botón superior</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(player => {
            const payCount = getPaymentCount(player.id);
            const totalPaid = getTotalPaid(player.id);
            return (
              <div key={player.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-violet-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{player.full_name}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        {player.age && <span className="text-xs text-gray-500">{player.age} años</span>}
                        {player.category && (
                          <Badge variant="outline" className="text-xs border-violet-200 text-violet-700 bg-violet-50">
                            {player.category}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs border-orange-200 text-orange-600 bg-orange-50">
                          Externo
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-blue-600" onClick={() => onEdit(player)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-red-600" onClick={() => onDelete(player)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {player.parent_phone}
                    </span>
                    {payCount > 0 && (
                      <span className="text-green-600 font-medium">{payCount} pago{payCount > 1 ? 's' : ''} · ${totalPaid.toLocaleString()}</span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => onRegisterPayment(player)}
                    className="bg-sky-600 hover:bg-sky-700 gap-1.5 text-xs h-7 px-3"
                  >
                    <CreditCard className="w-3.5 h-3.5" /> Pago
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}