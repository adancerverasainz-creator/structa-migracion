import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, UserCheck, Trash2, Edit, Search, ClipboardList, ArrowRightCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '../components/lib/formatCurrency';
import PreRegistroForm from '../components/preregistro/PreRegistroForm';
import { logAudit } from '../components/lib/auditLogger';

export default function PreRegistro() {
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [search, setSearch] = useState('');
  const [transferringId, setTransferringId] = useState(null);
  const queryClient = useQueryClient();

  const { data: preregistros = [], isLoading } = useQuery({
    queryKey: ['preregistros'],
    queryFn: () => base44.entities.PreRegistro.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PreRegistro.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preregistros'] });
      setShowForm(false);
      setEditingRecord(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PreRegistro.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preregistros'] });
      setShowForm(false);
      setEditingRecord(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PreRegistro.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['preregistros'] }),
  });

  const handleSubmit = (data) => {
    if (editingRecord) {
      updateMutation.mutate({ id: editingRecord.id, data });
    } else {
      createMutation.mutate({ ...data, status: 'pendiente' });
    }
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    setShowForm(true);
  };

  const handleDelete = (record) => {
    if (confirm(`¿Eliminar el pre-registro de ${record.full_name}?`)) {
      deleteMutation.mutate(record.id);
    }
  };

  const handleTransfer = async (record) => {
    if (!confirm(`¿Inscribir a ${record.full_name} como jugador activo? Se creará su perfil en el módulo de Jugadores.`)) return;
    setTransferringId(record.id);
    try {
      // Crear jugador en el módulo Players
      const playerData = {
        full_name: record.full_name,
        birth_date: record.birth_date,
        join_date: record.join_date || format(new Date(), 'yyyy-MM-dd'),
        category: record.category,
        parent_name: record.parent_name,
        parent_phone: record.parent_phone,
        parent_email: record.parent_email,
        monthly_fee: record.monthly_fee,
        photo_url: record.photo_url,
        status: 'activo',
      };
      const newPlayer = await base44.entities.Player.create(playerData);

      // Marcar pre-registro como inscrito
      await base44.entities.PreRegistro.update(record.id, { status: 'inscrito' });

      await logAudit({
        action: 'CREACIÓN',
        module: 'Pre-Registro',
        entity_type: 'Player',
        entity_id: newPlayer.id,
        entity_name: record.full_name,
        newData: playerData,
        details: `Jugador trasladado desde Pre-Registro al módulo de Jugadores`,
      });

      queryClient.invalidateQueries({ queryKey: ['preregistros'] });
      queryClient.invalidateQueries({ queryKey: ['players'] });
    } catch (e) {
      alert('Error al trasladar el jugador: ' + e.message);
    } finally {
      setTransferringId(null);
    }
  };

  const pendientes = preregistros.filter(r => r.status === 'pendiente');
  const inscritos = preregistros.filter(r => r.status === 'inscrito');
  const cancelados = preregistros.filter(r => r.status === 'cancelado');

  const filtered = preregistros.filter(r => {
    const q = search.toLowerCase();
    return (
      r.full_name?.toLowerCase().includes(q) ||
      r.parent_name?.toLowerCase().includes(q) ||
      r.category?.toLowerCase().includes(q)
    );
  });

  const statusColor = {
    pendiente: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    inscrito: 'bg-green-100 text-green-700 border-green-300',
    cancelado: 'bg-gray-100 text-gray-500 border-gray-300',
  };

  const statusLabel = {
    pendiente: 'Pendiente',
    inscrito: 'Inscrito',
    cancelado: 'Cancelado',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <ClipboardList className="w-8 h-8 text-blue-600" />
            Pre-Registro
          </h1>
          <p className="text-gray-600 mt-1">Control de jugadores interesados antes de su inscripción oficial</p>
        </div>
        <Button onClick={() => { setEditingRecord(null); setShowForm(true); }} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Pre-Registro
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-2 border-yellow-200">
          <CardContent className="pt-5 pb-4">
            <p className="text-sm text-gray-600">Pendientes</p>
            <p className="text-3xl font-bold text-yellow-600">{pendientes.length}</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-green-200">
          <CardContent className="pt-5 pb-4">
            <p className="text-sm text-gray-600">Inscritos</p>
            <p className="text-3xl font-bold text-green-600">{inscritos.length}</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-gray-200">
          <CardContent className="pt-5 pb-4">
            <p className="text-sm text-gray-600">Cancelados</p>
            <p className="text-3xl font-bold text-gray-500">{cancelados.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Form */}
      {showForm && (
        <PreRegistroForm
          record={editingRecord}
          onSubmit={handleSubmit}
          onCancel={() => { setShowForm(false); setEditingRecord(null); }}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Buscar jugador, padre o categoría..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Cargando...</p>
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Sin pre-registros</h3>
            <p className="text-gray-600">Agrega el primero con el botón de arriba</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((record) => (
            <Card key={record.id} className={`border-2 hover:shadow-md transition-all ${record.status === 'inscrito' ? 'opacity-70' : ''}`}>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="text-lg font-bold text-gray-900">{record.full_name}</h3>
                      <Badge className={`border ${statusColor[record.status]}`}>
                        {statusLabel[record.status]}
                      </Badge>
                      {record.category && <Badge variant="outline">{record.category}</Badge>}
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p><span className="font-medium">Padre/Tutor:</span> {record.parent_name}</p>
                      <p><span className="font-medium">Teléfono:</span> {record.parent_phone}</p>
                      {record.parent_email && <p><span className="font-medium">Email:</span> {record.parent_email}</p>}
                      {record.join_date && (
                        <p><span className="font-medium">Fecha ingreso:</span> {format(new Date(record.join_date + 'T00:00:00'), "d 'de' MMMM yyyy", { locale: es })}</p>
                      )}
                      {record.notes && <p className="text-gray-500 italic">📝 {record.notes}</p>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end justify-between gap-3">
                    <p className="text-xl font-bold text-blue-600">{formatCurrency(record.monthly_fee)}<span className="text-xs text-gray-400 font-normal">/mes</span></p>
                    <div className="flex gap-2 flex-wrap justify-end">
                      {record.status === 'pendiente' && (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 gap-1"
                          onClick={() => handleTransfer(record)}
                          disabled={transferringId === record.id}
                        >
                          <ArrowRightCircle className="w-4 h-4" />
                          {transferringId === record.id ? 'Inscribiendo...' : 'Inscribir'}
                        </Button>
                      )}
                      {record.status === 'pendiente' && (
                        <Button size="sm" variant="outline" onClick={() => handleEdit(record)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => handleDelete(record)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
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