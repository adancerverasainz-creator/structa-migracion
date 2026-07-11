import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle, Trophy, Search, Phone, Mail, PlusCircle } from 'lucide-react';
import { formatCurrency } from '../lib/formatCurrency';
import { getTotalPaidForAttendee } from '@/lib/tournamentBalance';

export default function TournamentDebtorsList({ players, onAbonarTorneo }) {
  const [selectedTournament, setSelectedTournament] = useState('all');
  const [search, setSearch] = useState('');

  const { data: tournaments = [] } = useQuery({
    queryKey: ['tournaments'],
    queryFn: () => base44.entities.Tournament.list('-date'),
  });

  const { data: attendees = [] } = useQuery({
    queryKey: ['tournamentAttendees'],
    queryFn: () => base44.entities.TournamentAttendee.list(),
  });

  const { data: tournamentPayments = [] } = useQuery({
    queryKey: ['tournamentPayments'],
    queryFn: () => base44.entities.TournamentPayment.list(),
  });

  // Build debtors list per tournament
  const tournamentsToShow = selectedTournament === 'all'
    ? tournaments
    : tournaments.filter(t => t.id === selectedTournament);

  const allDebtors = tournamentsToShow.flatMap(tournament => {
    const fee = tournament.registration_fee || 0;
    const tournamentAttendees = attendees.filter(a => a.tournament_id === tournament.id);
    const tPayments = tournamentPayments.filter(p => p.tournament_id === tournament.id);

    return tournamentAttendees
      .map(a => {
        const totalPaid = getTotalPaidForAttendee(a, tPayments, tournament.id);
        const debt = fee - totalPaid;
        if (debt <= 0) return null;

        if (a.is_external) {
          const name = a.external_name || 'Externo';
          return { player: { id: a.id, full_name: name, parent_name: 'Externo', parent_phone: '', parent_email: '', category: a.external_category }, tournament, totalPaid, debt, fee, isExternal: true };
        }

        const player = players.find(p => p.id === a.player_id);
        if (!player) return null;
        return { player, tournament, totalPaid, debt, fee, isExternal: false };
      })
      .filter(Boolean);
  });

  const filtered = search.trim()
    ? allDebtors.filter(d =>
        d.player.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        d.player.parent_name?.toLowerCase().includes(search.toLowerCase()) ||
        d.tournament.name?.toLowerCase().includes(search.toLowerCase())
      )
    : allDebtors;

  const totalDebt = filtered.reduce((sum, d) => sum + d.debt, 0);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={selectedTournament} onValueChange={setSelectedTournament}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Todos los torneos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los torneos</SelectItem>
            {tournaments.map(t => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar jugador, padre o torneo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Summary */}
      <Card className="bg-purple-50 border-2 border-purple-200">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-600 rounded-lg">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Morosos Torneos</p>
                <p className="text-3xl font-bold text-purple-600">{filtered.length}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Deuda Total</p>
              <p className="text-2xl font-bold text-purple-600">{formatCurrency(totalDebt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">¡Sin morosos!</h3>
            <p className="text-gray-600">Todos los asistentes han pagado sus torneos</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map(({ player, tournament, totalPaid, debt, fee, isExternal }, idx) => (
            <Card key={`${player.id}-${tournament.id}-${idx}`} className="border-2 border-purple-200 hover:shadow-lg transition-all">
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col md:flex-row justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-base font-bold text-gray-900">{player.full_name}</h3>
                      {isExternal && <Badge className="bg-blue-100 text-blue-700 border-blue-300 text-xs">Externo</Badge>}
                      {player.category && <Badge variant="outline">{player.category}</Badge>}
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <Trophy className="w-4 h-4 text-purple-500" />
                      <span className="text-sm font-medium text-purple-700">{tournament.name}</span>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg space-y-1">
                      <p className="font-semibold text-gray-800 text-sm">{player.parent_name}</p>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Phone className="w-4 h-4 text-blue-600" />
                          <a href={`tel:${player.parent_phone}`} className="hover:text-blue-600">{player.parent_phone}</a>
                        </div>
                        {player.parent_email && (
                          <div className="flex items-center gap-2 text-gray-600">
                            <Mail className="w-4 h-4 text-blue-600" />
                            <a href={`mailto:${player.parent_email}`} className="hover:text-blue-600">{player.parent_email}</a>
                          </div>
                        )}
                      </div>
                    </div>
                    {totalPaid > 0 && (
                      <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-purple-500 h-2 rounded-full"
                          style={{ width: `${Math.min(100, (totalPaid / fee) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end justify-center gap-1 shrink-0">
                    {totalPaid > 0 && (
                      <span className="text-xs text-green-600 font-medium">Abonado: {formatCurrency(totalPaid)}</span>
                    )}
                    <div className="flex items-center gap-2 bg-purple-100 px-3 py-1 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-purple-600" />
                      <span className="font-bold text-purple-700">Debe: {formatCurrency(debt)}</span>
                    </div>
                    <span className="text-xs text-gray-500">Cuota: {formatCurrency(fee)}</span>
                    {onAbonarTorneo && (
                      <Button
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700 gap-2 mt-1"
                        onClick={() => onAbonarTorneo({ player, tournament, debt, fee, totalPaid })}
                      >
                        <PlusCircle className="w-4 h-4" />
                        Abonar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}