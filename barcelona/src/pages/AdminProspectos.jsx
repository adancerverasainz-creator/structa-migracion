import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Users, Search, ExternalLink, Link2, Plus, Copy, Pencil, Trash2, CheckCircle, Clock, XCircle, Zap } from 'lucide-react';
import ERPPageHeader from '@/components/layout/ERPPageHeader';
import { toast } from 'sonner';

const STATUS_LABELS = {
  pendiente: 'Nuevo',
  inscrito: 'Inscrito',
  cancelado: 'Descartado',
};

const STATUS_COLORS = {
  pendiente: 'bg-blue-100 text-blue-800 border-blue-200',
  inscrito: 'bg-green-100 text-green-800 border-green-200',
  cancelado: 'bg-gray-100 text-gray-600 border-gray-200',
};

const PROGRAM_STATUS_LABELS = { activo: 'Activo', pausado: 'Pausado', cerrado: 'Cerrado' };
const PROGRAM_STATUS_COLORS = {
  activo: 'bg-green-100 text-green-800 border-green-200',
  pausado: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  cerrado: 'bg-gray-100 text-gray-600 border-gray-200',
};
const PROGRAM_STATUS_ICONS = { activo: CheckCircle, pausado: Clock, cerrado: XCircle };

const EMPTY_PROGRAM = { name: '', description: '', link: '', status: 'activo', start_date: '', end_date: '' };

const APP_ID = '69829604916b5b78a01842a3';
const generateFormLink = (programId) => `https://forms.structa.mx/registro?app=${APP_ID}&token=${programId}`;



export default function AdminProspectos() {
  const queryClient = useQueryClient();
  // Permisos granulares (matriz role_permissions en BD — patrón recurso × acción)
  const { data: currentUser } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me() });
  const { data: rolePerms = [] } = useQuery({ queryKey: ['rolePermissions'], queryFn: () => base44.entities.RolePermission.list(null, 1000) });
  const myPerms = new Set(rolePerms.filter(rp => rp.role === currentUser?.role && rp.resource === 'programs').map(rp => rp.action));
  const canCreatePrograms = myPerms.has('create');
  const canUpdatePrograms = myPerms.has('update');
  const canDeletePrograms = myPerms.has('delete');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showProgramForm, setShowProgramForm] = useState(false);
  const [editingProgram, setEditingProgram] = useState(null);
  const [programForm, setProgramForm] = useState(EMPTY_PROGRAM);
  const [copiedId, setCopiedId] = useState(null);

  const { data: preregistros = [], isLoading } = useQuery({
    queryKey: ['preRegistros'],
    queryFn: () => base44.entities.PreRegistro.list('-created_date'),
  });

  const { data: programs = [], isLoading: loadingPrograms } = useQuery({
    queryKey: ['programs'],
    queryFn: () => base44.entities.Program.list('-created_date'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PreRegistro.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['preRegistros'] }),
  });

  const createProgramMutation = useMutation({
    mutationFn: (data) => base44.entities.Program.create(data),
    onSuccess: async (newProgram) => {
      // Auto-generate and save the forms link
      try {
        const generatedLink = generateFormLink(newProgram.id);
        await base44.entities.Program.update(newProgram.id, { link: generatedLink });
      } catch (_) {}
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      closeProgramForm();
      toast.success('Programa creado con su link de formulario');
    },
    onError: (err) => {
      const msg = String(err?.message || '');
      toast.error(msg.includes('row-level security') || msg.includes('policy')
        ? 'No tienes permisos para crear programas — pide a un administrador que eleve tu rol'
        : `No se pudo guardar el programa: ${msg}`);
    },
  });

  const updateProgramMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Program.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['programs'] }); closeProgramForm(); toast.success('Programa actualizado'); },
    onError: (err) => toast.error(`No se pudo actualizar el programa: ${err?.message || ''}`),
  });

  const deleteProgramMutation = useMutation({
    mutationFn: (id) => base44.entities.Program.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['programs'] }),
    onError: (err) => toast.error(`No se pudo eliminar el programa: ${err?.message || ''}`),
  });

  const handleStatusChange = (id, newStatus) => {
    updateMutation.mutate({ id, data: { status: newStatus } });
  };

  const openNewProgram = () => { setProgramForm(EMPTY_PROGRAM); setEditingProgram(null); setShowProgramForm(true); };
  const openEditProgram = (p) => { setProgramForm({ name: p.name || '', description: p.description || '', link: p.link || '', status: p.status || 'activo', start_date: p.start_date || '', end_date: p.end_date || '' }); setEditingProgram(p); setShowProgramForm(true); };
  const closeProgramForm = () => { setShowProgramForm(false); setEditingProgram(null); setProgramForm(EMPTY_PROGRAM); };

  const handleSaveProgram = () => {
    if (!programForm.name.trim()) return;
    if (editingProgram) {
      updateProgramMutation.mutate({ id: editingProgram.id, data: programForm });
    } else {
      createProgramMutation.mutate(programForm);
    }
  };

  const handleCopyLink = (id, link) => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = preregistros.filter(p => {
    const matchSearch = search === '' ||
      p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.parent_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.parent_phone?.includes(search) ||
      p.parent_email?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const countNew = preregistros.filter(p => p.status === 'pendiente').length;
  const countInscrito = preregistros.filter(p => p.status === 'inscrito').length;
  const countCancelado = preregistros.filter(p => p.status === 'cancelado').length;

  return (
    <div className="space-y-6">
      <ERPPageHeader
        icon={Users}
        iconColor="text-rose-600"
        iconBg="bg-rose-50"
        title="Prospectos"
        subtitle="Gestión de pre-registros y leads del club"
        breadcrumb={['BIA', 'Prospectos']}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-blue-200 bg-blue-50/40">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-blue-600">Nuevos</p>
            <p className="text-3xl font-bold text-blue-700">{countNew}</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50/40">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-yellow-600">Contactados</p>
            <p className="text-3xl font-bold text-yellow-700">0</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50/40">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-green-600">Inscritos</p>
            <p className="text-3xl font-bold text-green-700">{countInscrito}</p>
          </CardContent>
        </Card>
        <Card className="border-gray-200 bg-gray-50/40">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-gray-500">Descartados</p>
            <p className="text-3xl font-bold text-gray-600">{countCancelado}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="prospectos">
        <TabsList>
          <TabsTrigger value="prospectos" className="flex items-center gap-1.5">
            <Users className="w-4 h-4" /> Prospectos ({preregistros.length})
          </TabsTrigger>
          <TabsTrigger value="programas" className="flex items-center gap-1.5">
            <Link2 className="w-4 h-4" /> Programas ({programs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="prospectos" className="mt-4 space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar por jugador, padre, teléfono, email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pendiente">Nuevos</SelectItem>
                <SelectItem value="inscrito">Inscritos</SelectItem>
                <SelectItem value="cancelado">Descartados</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="all">
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todos los programas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los programas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600" />
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="flex justify-center mb-3">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-12 h-12 text-gray-300">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-600">Sin prospectos</h3>
                <p className="text-gray-400 text-sm mt-1">
                  {search || filterStatus !== 'all'
                    ? 'No se encontraron resultados con los filtros aplicados.'
                    : 'Crea un programa, comparte el link y los registros aparecerán aquí en tiempo real.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map(p => (
                <Card key={p.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-semibold text-gray-900">{p.full_name}</h3>
                          <Badge className={`text-xs ${STATUS_COLORS[p.status] || 'bg-gray-100 text-gray-600'}`}>
                            {STATUS_LABELS[p.status] || p.status}
                          </Badge>
                          {p.program_name && (
                            <Badge variant="outline" className="text-xs text-rose-600 border-rose-200">{p.program_name}</Badge>
                          )}
                          {p.category && (
                            <Badge variant="outline" className="text-xs">{p.category}</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                          {p.parent_name && <span>👤 {p.parent_name}</span>}
                          {p.parent_phone && <span>📱 {p.parent_phone}</span>}
                          {p.parent_email && <span>✉️ {p.parent_email}</span>}
                          {p.birth_date && <span>🎂 {p.birth_date}</span>}
                          {p.monthly_fee && <span>💰 ${p.monthly_fee}/mes</span>}
                        </div>
                        {p.notes && (
                          <p className="text-xs text-gray-400 mt-1 truncate">{p.notes}</p>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        <Select
                          value={p.status}
                          onValueChange={(val) => handleStatusChange(p.id, val)}
                        >
                          <SelectTrigger className="w-36 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendiente">Nuevo</SelectItem>
                            <SelectItem value="inscrito">Inscrito</SelectItem>
                            <SelectItem value="cancelado">Descartado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="programas" className="mt-4 space-y-4">
          <div className="flex justify-end items-center gap-3">
            {!canCreatePrograms && (
              <p className="text-xs text-gray-500">Tu rol no tiene permiso para crear programas.</p>
            )}
            <Button onClick={openNewProgram} disabled={!canCreatePrograms} className="bg-rose-600 hover:bg-rose-700 text-white gap-2">
              <Plus className="w-4 h-4" /> Nuevo programa
            </Button>
          </div>

          {loadingPrograms ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600" />
            </div>
          ) : programs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Link2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-600">Sin programas activos</h3>
                <p className="text-gray-400 text-sm mt-1 max-w-sm mx-auto">
                  Crea un programa, asígnale el link del formulario y compártelo para capturar prospectos.
                </p>
                <Button className="mt-4 bg-rose-600 hover:bg-rose-700 text-white gap-2" onClick={openNewProgram}>
                  <Plus className="w-4 h-4" /> Nuevo programa
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {programs.map(p => {
                const StatusIcon = PROGRAM_STATUS_ICONS[p.status] || CheckCircle;
                return (
                  <Card key={p.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">{p.name}</h3>
                          {p.description && <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{p.description}</p>}
                        </div>
                        <Badge className={`text-xs shrink-0 flex items-center gap-1 ${PROGRAM_STATUS_COLORS[p.status]}`}>
                          <StatusIcon className="w-3 h-3" />
                          {PROGRAM_STATUS_LABELS[p.status]}
                        </Badge>
                      </div>

                      {p.link && (
                        <div className="flex items-center gap-2 bg-gray-50 rounded-md px-3 py-2">
                          <Link2 className="w-4 h-4 text-gray-400 shrink-0" />
                          <span className="text-xs text-gray-600 truncate flex-1">{p.link}</span>
                          <button
                            onClick={() => handleCopyLink(p.id, p.link)}
                            className="text-xs text-rose-600 hover:text-rose-700 shrink-0 flex items-center gap-1"
                          >
                            {copiedId === p.id ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {copiedId === p.id ? 'Copiado' : 'Copiar'}
                          </button>
                          <button
                            onClick={() => window.open(p.link.startsWith('http') ? p.link : `https://${p.link}`, '_blank')}
                            className="text-gray-400 hover:text-gray-600 shrink-0"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {(p.start_date || p.end_date) && (
                        <p className="text-xs text-gray-400">
                          {p.start_date && <>Inicio: {p.start_date}</>}
                          {p.start_date && p.end_date && ' · '}
                          {p.end_date && <>Cierre: {p.end_date}</>}
                        </p>
                      )}

                      <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
                        {canUpdatePrograms && (
                          <Button variant="ghost" size="sm" onClick={() => openEditProgram(p)} className="text-gray-500 hover:text-gray-700 gap-1">
                            <Pencil className="w-3.5 h-3.5" /> Editar
                          </Button>
                        )}
                        {canDeletePrograms && (
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => deleteProgramMutation.mutate(p.id)}
                            className="text-red-400 hover:text-red-600 gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Eliminar
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

      {/* Modal Nuevo / Editar Programa */}
      <Dialog open={showProgramForm} onOpenChange={closeProgramForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProgram ? 'Editar programa' : 'Nuevo programa'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="prog-name">Nombre del programa <span className="text-red-500">*</span></Label>
              <Input
                id="prog-name"
                placeholder="Ej: Pruebas Sub-10 Verano 2026"
                value={programForm.name}
                onChange={e => setProgramForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prog-desc">Descripción</Label>
              <Textarea
                id="prog-desc"
                placeholder="Describe el objetivo del programa..."
                rows={2}
                value={programForm.description}
                onChange={e => setProgramForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            {/* Link field */}
            {editingProgram && editingProgram.link ? (
              <div className="space-y-1.5">
                <Label>Link del formulario (auto-generado)</Label>
                <div className="flex items-center gap-2 bg-gray-50 rounded-md px-3 py-2 border border-gray-200">
                  <Link2 className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-xs text-gray-600 truncate flex-1">{editingProgram.link}</span>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(editingProgram.link); }}
                    className="text-xs text-rose-600 hover:text-rose-700 shrink-0 flex items-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copiar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
                <Zap className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-700">
                  El link al formulario de <strong>forms.structa.mx</strong> se generará automáticamente al guardar el programa.
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Fecha inicio</Label>
                <Input type="date" value={programForm.start_date} onChange={e => setProgramForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha cierre</Label>
                <Input type="date" value={programForm.end_date} onChange={e => setProgramForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={programForm.status} onValueChange={v => setProgramForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="pausado">Pausado</SelectItem>
                  <SelectItem value="cerrado">Cerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeProgramForm}>Cancelar</Button>
            <Button
              onClick={handleSaveProgram}
              disabled={!programForm.name.trim() || createProgramMutation.isPending || updateProgramMutation.isPending}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {(createProgramMutation.isPending || updateProgramMutation.isPending) ? 'Guardando...' : editingProgram ? 'Guardar cambios' : 'Crear programa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </Tabs>
    </div>
  );
}
