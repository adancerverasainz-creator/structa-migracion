import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Search, CreditCard, Calendar, User } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '../lib/formatCurrency';

export default function PaymentsList({ payments, players, isLoading, onEdit, onDelete }) {
  const [searchTerm, setSearchTerm] = useState('');

  const getPlayerName = (playerId) => {
    const player = players.find(p => p.id === playerId);
    return player?.full_name || 'Desconocido';
  };

  const getPaymentConcept = (payment) => {
    const typeLabels = {
      mensualidad: 'Mensualidad',
      inscripcion: 'Inscripción',
      reinscripcion: 'Reinscripción',
      uniformes: 'Uniformes',
    };
    const type = typeLabels[payment.payment_type] || payment.payment_type || 'Pago';
    if (payment.payment_type === 'mensualidad') {
      return `${type} ${payment.month}`;
    }
    if (payment.payment_type === 'uniformes') {
      return payment.notes
        ? `${type} — ${payment.notes}`
        : `${type}${payment.month && payment.month !== 'uniformes' ? ' — ' + payment.month : ''}`;
    }
    if (payment.payment_type === 'inscripcion' || payment.payment_type === 'reinscripcion') {
      return `${type}${payment.month ? ' — Temporada ' + payment.month : ''}`;
    }
    return payment.month ? `${type} ${payment.month}` : type;
  };

  const filteredPayments = payments.filter(payment => {
    const playerName = getPlayerName(payment.player_id);
    return playerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           payment.month?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const methodColors = {
    efectivo: 'bg-green-100 text-green-800',
    tarjeta: 'bg-blue-100 text-blue-800',
    transferencia: 'bg-purple-100 text-purple-800',
  };

  const methodLabels = {
    efectivo: 'Efectivo',
    tarjeta: 'Tarjeta',
    transferencia: 'Transferencia',
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              placeholder="Buscar por jugador o mes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Payments List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          <p className="mt-2 text-gray-600">Cargando pagos...</p>
        </div>
      ) : filteredPayments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CreditCard className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay pagos registrados</h3>
            <p className="text-gray-600">Los pagos aparecerán aquí una vez que sean registrados</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredPayments.map((payment) => (
            <Card key={payment.id} className="hover:shadow-lg transition-all border-2">
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <User className="w-4 h-4 text-blue-600" />
                          <h3 className="text-lg font-bold text-gray-900">
                            {getPlayerName(payment.player_id)}
                          </h3>
                        </div>
                        <p className="text-sm font-medium text-gray-700">{getPaymentConcept(payment)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-600">{formatCurrency(payment.amount)}</p>
                        <Badge className={methodColors[payment.payment_method]}>
                          {methodLabels[payment.payment_method]}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{format(new Date(payment.payment_date), 'dd/MM/yyyy')}</span>
                      </div>
                      {payment.bank_name && (
                        <div className="flex items-center gap-1">
                          <CreditCard className="w-4 h-4" />
                          <span>{payment.bank_name}</span>
                        </div>
                      )}
                      {payment.reference_number && (
                        <div className="text-xs">
                          <span className="text-gray-500">Ref:</span> {payment.reference_number}
                        </div>
                      )}
                    </div>

                    {payment.notes && (
                      <div className="bg-gray-50 p-2 rounded text-sm text-gray-700">
                        {payment.notes}
                      </div>
                    )}
                  </div>

                  <div className="flex md:flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(payment)}
                      className="flex-1 md:flex-none"
                    >
                      <Edit className="w-4 h-4 md:mr-0 mr-1" />
                      <span className="md:hidden">Editar</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-1 md:flex-none"
                      onClick={() => onDelete(payment)}
                    >
                      <Trash2 className="w-4 h-4 md:mr-0 mr-1" />
                      <span className="md:hidden">Eliminar</span>
                    </Button>
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