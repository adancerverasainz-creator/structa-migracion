import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Link2, UserCheck, ExternalLink, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/components/lib/formatCurrency';
import { findOrphanPayments, suggestOrphanMatches } from '@/lib/tournamentBalance';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function OrphanPaymentsReconciliation({ tournamentId, tournamentPayments, attendees, players }) {
  const queryClient = useQueryClient();
  const [selectedMatches, setSelectedMatches] = useState({});
  const [linking, setLinking] = useState({});

  // Pagos huérfanos + sugerencias
  const orphans = findOrphanPayments(tournamentPayments, tournamentId);
  const suggestions = suggestOrphanMatches(orphans, attendees, players);

  if (orphans.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCheck className="w-5 h-5 text-green-600" />
            Reconciliación de Pagos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <AlertDescription className="text-green-700">
              No hay pagos huérfanos en este torneo. Todos los pagos están correctamente vinculados.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const handleSelectMatch = (paymentId, attendeeId, isExternal) => {
    setSelectedMatches(prev => ({
      ...prev,
      [paymentId]: { attendeeId, isExternal }
    }));
  };

  const handleLink = async (paymentId, payment) => {
    const match = selectedMatches[paymentId];
    if (!match) {
      toast.error('Selecciona un jugador para vincular');
      return;
    }

    setLinking(prev => ({ ...prev, [paymentId]: true }));
    try {
      const updateData = match.isExternal
        ? { external_attendee_id: match.attendeeId }
        : { player_id: match.attendeeId };

      await base44.entities.TournamentPayment.update(paymentId, updateData);
      await base44.entities.AuditLog.create({
        action: 'MODIFICACIÓN',
        module: 'Torneos',
        entity_type: 'TournamentPayment',
        entity_id: paymentId,
        entity_name: `Pago huérfano vinculado (${formatCurrency(payment.paid_amount ?? payment.amount)})`,
        user_email: (await base44.auth.me())?.email || 'admin',
        details: `Vinculado a ${match.isExternal ? 'asistente externo' : 'jugador'} ID: ${match.attendeeId}\nNombre original: ${payment.external_name || 'N/A'}`,
      });

      toast.success('Pago vinculado correctamente');
      queryClient.invalidateQueries({ queryKey: ['tournamentPayments'] });
    } catch (error) {
      toast.error('Error al vincular el pago');
    } finally {
      setLinking(prev => ({ ...prev, [paymentId]: false }));
    }
  };

  const formatSafeDate = (dateString) => {
    if (!dateString) return '';
    try {
      const clean = String(dateString).split('T')[0];
      const date = new Date(clean + 'T00:00:00');
      if (isNaN(date.getTime())) return '';
      return format(date, 'dd/MM/yyyy');
    } catch {
      return '';
    }
  };

  return (
    <Card className="border-orange-200">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertCircle className="w-5 h-5 text-orange-600" />
          Pagos Huérfanos ({orphans.length})
        </CardTitle>
        <CardDescription>
          Estos pagos no tienen jugador asignado. Selecciona el jugador correcto para cada pago y haz clic en "Vincular".
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {suggestions.map(({ payment, candidates }) => (
          <div key={payment.id} className="border rounded-lg p-4 bg-orange-50/50 space-y-3">
            {/* Info del pago huérfano */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-orange-700 border-orange-300 bg-orange-100">
                    Huérfano
                  </Badge>
                  <span className="font-semibold text-gray-800">
                    {payment.external_name || 'Sin nombre'}
                  </span>
                </div>
                <div className="flex gap-3 mt-1 text-xs text-gray-500">
                  <span>{formatCurrency(payment.paid_amount ?? payment.amount)}</span>
                  {payment.payment_date && <span>{formatSafeDate(payment.payment_date)}</span>}
                  <span>{payment.payment_method}</span>
                  {payment.reference_number && <span>Ref: {payment.reference_number}</span>}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => handleLink(payment.id, payment)}
                disabled={!selectedMatches[payment.id] || linking[payment.id]}
                className="shrink-0 bg-orange-600 hover:bg-orange-700"
              >
                {linking[payment.id] ? (
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Vinculando...
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Link2 className="w-3.5 h-3.5" />
                    Vincular
                  </span>
                )}
              </Button>
            </div>

            {/* Selector de match */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Vincular a:</label>
              <Select
                value={selectedMatches[payment.id]?.attendeeId || ''}
                onValueChange={(value) => {
                  // El value puede ser "player_xxx" o "external_xxx"
                  const [type, id] = value.split('|');
                  handleSelectMatch(payment.id, id, type === 'external');
                }}
              >
                <SelectTrigger className="border-orange-200 bg-white">
                  <SelectValue placeholder="Selecciona el jugador..." />
                </SelectTrigger>
                <SelectContent>
                  {candidates.length === 0 && (
                    <div className="px-2 py-4 text-center text-sm text-gray-500">
                      No se encontraron coincidencias automáticas. Selecciona un jugador de la lista general.
                    </div>
                  )}
                  {candidates.map(({ attendee, player, score, matchType }) => {
                    const isExternal = attendee.is_external;
                    const label = isExternal
                      ? `${attendee.external_name || 'Externo'} (externo)`
                      : `${player?.full_name || 'Desconocido'} • ${player?.category || ''}`;
                    const matchLabel = matchType === 'exacta' || matchType === 'exacta_externo'
                      ? 'Coincidencia exacta'
                      : 'Coincidencia parcial';
                    
                    return (
                      <SelectItem
                        key={`${isExternal ? 'ext' : 'ply'}-${attendee.id}`}
                        value={`${isExternal ? 'external' : 'player'}|${attendee.id}`}
                      >
                        <div className="flex items-center gap-2">
                          {isExternal ? (
                            <ExternalLink className="w-3.5 h-3.5 text-purple-500" />
                          ) : (
                            <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                          )}
                          <span>{label}</span>
                          <Badge variant="secondary" className="text-xs ml-1">
                            {score}% {matchLabel}
                          </Badge>
                        </div>
                      </SelectItem>
                    );
                  })}

                  {/* Separador + lista general de attendees */}
                  {candidates.length > 0 && (
                    <div className="border-t pt-1 mt-1">
                      <p className="px-2 py-1 text-xs text-gray-400 font-medium">Todos los asistentes</p>
                    </div>
                  )}

                  {/* Mostrar todos los attendees del torneo como opción */}
                  {attendees.map(a => {
                    const isExternal = a.is_external;
                    if (isExternal) {
                      const label = a.external_name || 'Externo (sin nombre)';
                      const alreadyShown = candidates.some(c => c.attendee.id === a.id);
                      if (alreadyShown) return null;
                      return (
                        <SelectItem key={`ext-${a.id}`} value={`external|${a.id}`}>
                          <div className="flex items-center gap-2">
                            <ExternalLink className="w-3.5 h-3.5 text-purple-500" />
                            <span>{label} (externo)</span>
                          </div>
                        </SelectItem>
                      );
                    }
                    const player = players.find(p => p.id === a.player_id);
                    if (!player) return null;
                    const alreadyShown = candidates.some(c => c.attendee.id === a.id);
                    if (alreadyShown) return null;
                    return (
                      <SelectItem key={`ply-${a.id}`} value={`player|${a.id}`}>
                        <div className="flex items-center gap-2">
                          <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                          <span>{player.full_name} • {player.category || ''}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}