import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Users, AlertCircle, CheckCircle, XCircle, FileDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PlayerForm from '../components/players/PlayerForm';
import PlayerCard from '../components/players/PlayerCard';
import { logAudit } from '../components/lib/auditLogger';
import ERPPageHeader from '../components/layout/ERPPageHeader';
import KPICard from '../components/layout/KPICard';

export default function Players() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryExport, setCategoryExport] = useState('todas');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [feeFilter, setFeeFilter] = useState('todos');
  const [showForm, setShowForm] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const queryClient = useQueryClient();

  const { data: players = [], isLoading } = useQuery({
    queryKey: ['players'],
    queryFn: () => base44.entities.Player.list('-created_date'),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['payments'],
    queryFn: () => base44.entities.Payment.list(),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const result = await base44.entities.Player.create(data);
      await logAudit({
        action: 'CREACIÓN', module: 'Jugadores', entity_type: 'Player',
        entity_id: result.id, entity_name: data.full_name,
        newData: data,
        details: `Categoría: ${data.category}, Cuota: $${data.monthly_fee}`
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      setShowForm(false);
      setEditingPlayer(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, prev }) => {
      await logAudit({
        action: 'MODIFICACIÓN', module: 'Jugadores', entity_type: 'Player',
        entity_id: id, entity_name: data.full_name,
        previousData: prev, newData: data,
        monetaryDiff: (data.monthly_fee || 0) - (prev?.monthly_fee || 0),
        details: `Cuota anterior: $${prev?.monthly_fee} → Nueva: $${data.monthly_fee}`
      });
      return base44.entities.Player.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      setShowForm(false);
      setEditingPlayer(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (player) => {
      await logAudit({
        action: 'ELIMINACIÓN', module: 'Jugadores', entity_type: 'Player',
        entity_id: player.id, entity_name: player.full_name,
        previousData: player,
        details: `Categoría: ${player.category}, Cuota: $${player.monthly_fee}`
      });
      return base44.entities.Player.delete(player.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
    },
  });

  const handleSubmit = (data) => {
    if (editingPlayer) {
      updateMutation.mutate({ id: editingPlayer.id, data, prev: editingPlayer });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (player) => {
    setEditingPlayer(player);
    setShowForm(true);
  };

  const handleDelete = (player) => {
    if (confirm('¿Estás seguro de eliminar este jugador?')) {
      deleteMutation.mutate(player);
    }
  };

  const filteredPlayers = players.filter(player => {
    const matchesSearch = player.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.parent_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'todos' || player.status === statusFilter;
    const matchesFee = feeFilter === 'todos' || 
      (feeFilter === 'sin_cuota' && (player.monthly_fee === 0 || !player.monthly_fee)) ||
      (feeFilter !== 'todos' && feeFilter !== 'sin_cuota' && player.monthly_fee === parseInt(feeFilter));
    return matchesSearch && matchesStatus && matchesFee;
  });

  const activePlayers = players.filter(p => p.status === 'activo');
  const inactivePlayers = players.filter(p => p.status === 'inactivo');
  const bajaPlayers = players.filter(p => p.status === 'baja');

  // Obtener todas las cuotas únicas
  const uniqueFees = Array.from(new Set(players.map(p => p.monthly_fee || 0)))
    .filter(fee => fee > 0)
    .sort((a, b) => a - b);

  const allCategories = Array.from(new Set(players.map(p => p.category).filter(Boolean))).sort();

  const getPlayersForExport = () => {
    if (categoryExport === 'todas') return players;
    return players.filter(p => p.category === categoryExport);
  };

  const exportXLSX = () => {
    const data = getPlayersForExport();
    const label = categoryExport === 'todas' ? 'Todos' : categoryExport;
    const wsData = [
      [`Barcelona Inter Academy - Jugadores - ${label}`],
      [`Total: ${data.length} jugadores`],
      [],
      ['Nombre', 'Categoría', 'Estatus', 'Fecha Nacimiento', 'Fecha Ingreso', 'Cuota Mensual', 'Padre/Tutor', 'Teléfono', 'Email'],
      ...data.map(p => [
        p.full_name,
        p.category || '-',
        p.status,
        p.birth_date || '-',
        p.join_date || '-',
        p.monthly_fee || 0,
        p.parent_name,
        p.parent_phone,
        p.parent_email || '-',
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Jugadores');
    XLSX.writeFile(wb, `jugadores_${label.replace(/ /g, '_')}.xlsx`);
  };

  const exportPDF = () => {
    const data = getPlayersForExport();
    const label = categoryExport === 'todas' ? 'Todos' : categoryExport;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(16);
    doc.setTextColor(165, 0, 68);
    doc.text('Barcelona Inter Academy', 14, 18);
    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.text(`Jugadores - ${label}`, 14, 27);
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`Total: ${data.length} jugadores`, 14, 34);
    const cols = ['Nombre', 'Categoría', 'Estatus', 'Cuota', 'Padre/Tutor', 'Teléfono'];
    const colWidths = [40, 22, 18, 18, 45, 32];
    let y = 44;
    doc.setFillColor(165, 0, 68);
    doc.rect(14, y, pageWidth - 28, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    let x = 16;
    cols.forEach((col, i) => { doc.text(col, x, y + 5.5); x += colWidths[i]; });
    y += 8;
    data.forEach((p, idx) => {
      if (y > 270) { doc.addPage(); y = 20; }
      if (idx % 2 === 0) { doc.setFillColor(245, 245, 255); doc.rect(14, y, pageWidth - 28, 8, 'F'); }
      doc.setTextColor(40, 40, 40);
      x = 16;
      const row = [p.full_name, p.category || '-', p.status, `$${p.monthly_fee || 0}`, p.parent_name, p.parent_phone];
      row.forEach((val, i) => {
        const text = doc.splitTextToSize(String(val || '-'), colWidths[i] - 2)[0];
        doc.text(text, x, y + 5.5);
        x += colWidths[i];
      });
      y += 8;
    });
    doc.save(`jugadores_${label.replace(/ /g, '_')}.pdf`);
  };

  return (
    <div className="space-y-5">
      <ERPPageHeader
        icon={Users}
        iconColor="text-blue-600"
        iconBg="bg-blue-50"
        title="Gestión de Jugadores"
        subtitle="Administra la información de todos los jugadores del club"
        breadcrumb={['BIA', 'Jugadores']}
        actions={
          <>
            <Select value={categoryExport} onValueChange={setCategoryExport}>
              <SelectTrigger className="w-36 h-9 text-sm">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportXLSX} size="sm" className="gap-1.5 border-green-300 text-green-700 hover:bg-green-50">
              <FileDown className="w-4 h-4" /> Excel
            </Button>
            <Button variant="outline" onClick={exportPDF} size="sm" className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50">
              <FileDown className="w-4 h-4" /> PDF
            </Button>
            <Button size="sm" onClick={() => { setEditingPlayer(null); setShowForm(true); }} className="bg-blue-600 hover:bg-blue-700 gap-1.5">
              <Plus className="w-4 h-4" /> Nuevo Jugador
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Jugadores" value={players.length} icon={Users} color="blue" />
        <KPICard title="Activos" value={activePlayers.length} icon={CheckCircle} color="green" />
        <KPICard title="Inactivos" value={inactivePlayers.length} icon={AlertCircle} color="gray" />
        <KPICard title="Baja" value={bajaPlayers.length} icon={XCircle} color="red" />
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Buscar por nombre de jugador o padre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por estatus" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estatus</SelectItem>
                <SelectItem value="activo">Activos</SelectItem>
                <SelectItem value="inactivo">Inactivos</SelectItem>
                <SelectItem value="baja">Baja</SelectItem>
              </SelectContent>
            </Select>
            <Select value={feeFilter} onValueChange={setFeeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por cuota" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas las cuotas ({players.length})</SelectItem>
                <SelectItem value="sin_cuota">Sin cuota ($0) ({players.filter(p => !p.monthly_fee || p.monthly_fee === 0).length})</SelectItem>
                {uniqueFees.map(fee => {
                  const count = players.filter(p => p.monthly_fee === fee).length;
                  return (
                    <SelectItem key={fee} value={fee.toString()}>
                      ${fee.toLocaleString('es-MX')} ({count})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      {showForm && (
        <PlayerForm
          player={editingPlayer}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowForm(false);
            setEditingPlayer(null);
          }}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* Players Grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Cargando jugadores...</p>
        </div>
      ) : filteredPlayers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay jugadores</h3>
            <p className="text-gray-600 mb-4">Comienza agregando tu primer jugador</p>
            <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Agregar Jugador
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlayers.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              payments={payments}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}