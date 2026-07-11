import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Plus, Save, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '../lib/formatCurrency';

export default function TeamPayments({ team, onBack }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    payment_type: 'inscripcion',
    amount: '4000',
    payment_date: format(new Date(), 'yyyy-MM-dd'),
    week_number: '',
    payment_method: 'efectivo',
    bank_name: '',
    reference_number: '',
    notes: '',
    status: 'pagado',
  });

  const queryClient = useQueryClient();

  const { data: payments = [] } = useQuery({
    queryKey: ['leaguePayments'],
    queryFn: () => base44.entities.LeaguePayment.list('-payment_date'),
  });

  const teamPayments = payments.filter(p => p.team_id === team.id);
  const registrationPayments = teamPayments.filter(p => p.payment_type === 'inscripcion');
  const refereePayments = teamPayments.filter(p => p.payment_type === 'arbitraje');

  const totalPaid = teamPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.LeaguePayment.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaguePayments'] });
      setShowForm(false);
      setFormData({
        payment_type: 'inscripcion',
        amount: '4000',
        payment_date: format(new Date(), 'yyyy-MM-dd'),
        week_number: '',
        payment_method: 'efectivo',
        bank_name: '',
        reference_number: '',
        notes: '',
        status: 'pagado',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.LeaguePayment.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaguePayments'] });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({
      ...formData,
      team_id: team.id,
      amount: parseFloat(formData.amount) || 0,
      week_number: formData.payment_type === 'arbitraje' ? parseInt(formData.week_number) : null,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{team.name}</h1>
          <p className="text-gray-600">Gestión de Pagos</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-green-600 hover:bg-green-700">
          <Plus className="w-4 h-4 mr-2" />
          Registrar Pago
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-2 border-blue-200">
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Pagos de Inscripción</p>
            <p className="text-3xl font-bold text-blue-600">{formatCurrency(registrationPayments.reduce((s, p) => s + (p.amount || 0), 0))}</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-orange-200">
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Pagos de Arbitraje</p>
            <p className="text-3xl font-bold text-orange-600">{formatCurrency(refereePayments.reduce((s, p) => s + (p.amount || 0), 0))}</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-green-200">
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Total Pagado</p>
            <p className="text-3xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Desglose por método de pago */}
      <Card>
        <CardHeader>
          <CardTitle>Ingresos por Método de Pago</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-gray-600 mb-1">Efectivo</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(teamPayments.filter(p => p.payment_method === 'efectivo').reduce((sum, p) => sum + (p.amount || 0), 0))}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {teamPayments.filter(p => p.payment_method === 'efectivo').length} pagos
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <p className="text-sm text-gray-600 mb-1">Tarjeta</p>
              <p className="text-2xl font-bold text-purple-600">
                {formatCurrency(teamPayments.filter(p => p.payment_method === 'tarjeta').reduce((sum, p) => sum + (p.amount || 0), 0))}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {teamPayments.filter(p => p.payment_method === 'tarjeta').length} pagos
              </p>
            </div>
            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <p className="text-sm text-gray-600 mb-1">BBVA</p>
              <p className="text-2xl font-bold text-emerald-600">
                {formatCurrency(teamPayments.filter(p => p.payment_method === 'transferencia' && p.bank_name === 'BBVA').reduce((sum, p) => sum + (p.amount || 0), 0))}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {teamPayments.filter(p => p.payment_method === 'transferencia' && p.bank_name === 'BBVA').length} pagos
              </p>
            </div>
            <div className="p-4 bg-cyan-50 rounded-lg border border-cyan-200">
              <p className="text-sm text-gray-600 mb-1">MP</p>
              <p className="text-2xl font-bold text-cyan-600">
                {formatCurrency(teamPayments.filter(p => p.payment_method === 'transferencia' && p.bank_name === 'MP').reduce((sum, p) => sum + (p.amount || 0), 0))}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {teamPayments.filter(p => p.payment_method === 'transferencia' && p.bank_name === 'MP').length} pagos
              </p>
            </div>
            <div className="p-4 bg-violet-50 rounded-lg border border-violet-200">
              <p className="text-sm text-gray-600 mb-1">NU</p>
              <p className="text-2xl font-bold text-violet-600">
                {formatCurrency(teamPayments.filter(p => p.payment_method === 'transferencia' && p.bank_name === 'NU').reduce((sum, p) => sum + (p.amount || 0), 0))}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {teamPayments.filter(p => p.payment_method === 'transferencia' && p.bank_name === 'NU').length} pagos
              </p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
              <p className="text-sm text-gray-600 mb-1">OpenBank</p>
              <p className="text-2xl font-bold text-orange-600">
                {formatCurrency(teamPayments.filter(p => p.payment_method === 'transferencia' && p.bank_name === 'OpenBank').reduce((sum, p) => sum + (p.amount || 0), 0))}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {teamPayments.filter(p => p.payment_method === 'transferencia' && p.bank_name === 'OpenBank').length} pagos
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {showForm && (
        <Card className="shadow-lg border-2 border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Registrar Pago</span>
              <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}>
                <X className="w-5 h-5" />
              </Button>
            </CardTitle>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Pago *</Label>
                  <Select
                    value={formData.payment_type}
                    onValueChange={(value) => setFormData({ 
                      ...formData, 
                      payment_type: value,
                      amount: value === 'inscripcion' ? '4000' : '450'
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inscripcion">Inscripción - $4,000</SelectItem>
                      <SelectItem value="arbitraje">Arbitraje - $450</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.payment_type === 'arbitraje' && (
                  <div className="space-y-2">
                    <Label>Semana *</Label>
                    <Input
                      type="number"
                      value={formData.week_number}
                      onChange={(e) => setFormData({ ...formData, week_number: e.target.value })}
                      placeholder="Número de semana"
                      required
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Monto *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha de Pago *</Label>
                  <Input
                    type="date"
                    value={formData.payment_date}
                    onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Método de Pago *</Label>
                  <Select
                    value={formData.payment_method}
                    onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="tarjeta">Tarjeta</SelectItem>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.payment_method === 'transferencia' && (
                  <>
                    <div className="space-y-2">
                      <Label>Banco *</Label>
                      <Select
                        value={formData.bank_name}
                        onValueChange={(value) => setFormData({ ...formData, bank_name: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar banco" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BBVA">BBVA</SelectItem>
                          <SelectItem value="MP">MP</SelectItem>
                          <SelectItem value="NU">NU</SelectItem>
                          <SelectItem value="OpenBank">OpenBank</SelectItem>
                          <SelectItem value="MercadoPagoBIA">Mercado Pago BIA</SelectItem>
                          </SelectContent>
                          </Select>
                          </div>
                          <div className="space-y-2">
                          <Label>Referencia</Label>
                          <Input
                          value={formData.reference_number}
                          onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                          />
                          </div>
                  </>
                )}
                {formData.payment_method === 'tarjeta' && (
                  <div className="space-y-2">
                    <Label>Referencia</Label>
                    <Input
                      value={formData.reference_number}
                      onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                    />
                  </div>
                )}
                <div className="space-y-2 md:col-span-2">
                  <Label>Notas</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                  />
                </div>
              </div>
            </CardContent>
            <div className="px-6 pb-6 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending} className="bg-green-600 hover:bg-green-700">
                <Save className="w-4 h-4 mr-2" />
                Guardar
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Historial de Pagos</CardTitle>
        </CardHeader>
        <CardContent>
          {teamPayments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No hay pagos registrados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {teamPayments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={payment.payment_type === 'inscripcion' ? 'default' : 'secondary'}>
                        {payment.payment_type === 'inscripcion' ? 'Inscripción' : `Arbitraje - Semana ${payment.week_number}`}
                      </Badge>
                      <Badge variant="outline">{payment.payment_method}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                      <span>{format(new Date(payment.payment_date), 'dd/MM/yyyy')}</span>
                      {payment.bank_name && <span>Banco: {payment.bank_name}</span>}
                      {payment.notes && <span>{payment.notes}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xl font-bold text-green-600">{formatCurrency(payment.amount)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm('¿Eliminar este pago?')) {
                          deleteMutation.mutate(payment.id);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}