// Permisos — administración de la matriz de permisos (solo admin)
// Modelo SAP/Dynamics: matriz por rol + excepciones por usuario (la excepción gana).
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldCheck, ShieldAlert, RotateCcw, Loader2 } from 'lucide-react';
import ERPPageHeader from '@/components/layout/ERPPageHeader';
import { logAudit } from '../components/lib/auditLogger';
import { toast } from 'sonner';

const RESOURCES = [
  { key: 'players', label: 'Jugadores' },
  { key: 'payments', label: 'Pagos (mensualidades, generales, torneos, liga, summer)' },
  { key: 'expenses', label: 'Egresos' },
  { key: 'cxp', label: 'Cuentas por Pagar' },
  { key: 'fondos', label: 'Fondos (caja)' },
  { key: 'tournaments', label: 'Torneos y partidos' },
  { key: 'prospectos', label: 'Prospectos (pre-registros)' },
  { key: 'programs', label: 'Programas' },
  { key: 'summercamp', label: 'Summer Camp (externos)' },
  { key: 'condonaciones', label: 'Condonaciones de deuda', actions: ['create'] },
];
const ACTIONS = [
  { key: 'create', label: 'Crear' },
  { key: 'update', label: 'Editar' },
  { key: 'delete', label: 'Eliminar' },
];

export default function PermissionsPage() {
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState('');

  const { data: currentUser, isLoading: loadingMe } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me() });
  const { data: profiles = [] } = useQuery({ queryKey: ['profiles'], queryFn: () => base44.entities.Profile.list(null, 100) });
  const { data: rolePerms = [] } = useQuery({ queryKey: ['rolePermissions'], queryFn: () => base44.entities.RolePermission.list(null, 1000) });
  const { data: userPerms = [] } = useQuery({ queryKey: ['userPermissions'], queryFn: () => base44.entities.UserPermission.list(null, 2000) });

  const selectedUser = profiles.find(p => p.id === selectedUserId);

  const saveMutation = useMutation({
    mutationFn: async ({ user, resource, action, newAllowed, roleDefault, existingOverride }) => {
      if (existingOverride && newAllowed === roleDefault) {
        // La excepción vuelve a coincidir con el rol → se elimina (vuelve al default)
        await base44.entities.UserPermission.delete(existingOverride.id);
      } else if (existingOverride) {
        await base44.entities.UserPermission.update(existingOverride.id, { allowed: newAllowed, updated_by: currentUser?.email });
      } else {
        await base44.entities.UserPermission.create({ user_id: user.id, resource, action, allowed: newAllowed, updated_by: currentUser?.email });
      }
      await logAudit({
        action: 'PERMISOS', module: 'Permisos', entity_type: 'UserPermission',
        entity_id: user.id, entity_name: user.email,
        details: `${resource}.${action} → ${newAllowed ? 'PERMITIDO' : 'DENEGADO'} (default del rol ${user.role}: ${roleDefault ? 'permitido' : 'denegado'})`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userPermissions'] });
      toast.success('Permiso actualizado');
    },
    onError: (err) => toast.error(`No se pudo guardar: ${err?.message || ''}`),
  });

  if (loadingMe) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-purple-600" /></div>;
  }
  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <ShieldAlert className="w-16 h-16 text-red-400" />
        <h2 className="text-xl font-semibold text-gray-800">Acceso Restringido</h2>
        <p className="text-gray-500">Solo los administradores pueden gestionar permisos.</p>
      </div>
    );
  }

  const roleHas = (role, resource, action) =>
    rolePerms.some(rp => rp.role === role && rp.resource === resource && rp.action === action);
  const overrideFor = (userId, resource, action) =>
    userPerms.find(up => up.user_id === userId && up.resource === resource && up.action === action);

  return (
    <div className="space-y-6">
      <ERPPageHeader
        icon={ShieldCheck}
        iconColor="text-purple-600"
        iconBg="bg-purple-50"
        title="Permisos"
        subtitle="Matriz de permisos por módulo — rol base + excepciones por usuario"
        breadcrumb={['BIA', 'Permisos']}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Selecciona un usuario</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="max-w-md"><SelectValue placeholder="Elegir usuario..." /></SelectTrigger>
            <SelectContent>
              {profiles.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.full_name || p.email} — rol: {p.role}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedUser && (
            <p className="text-xs text-gray-500 mt-2">
              Sin excepciones, aplica el default del rol <Badge variant="outline">{selectedUser.role}</Badge>.
              Cada celda que cambies crea una excepción individual (morado) que queda registrada en Auditoría.
            </p>
          )}
        </CardContent>
      </Card>

      {selectedUser && (
        <Card>
          <CardContent className="pt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-semibold text-gray-700">Módulo</th>
                  {ACTIONS.map(a => <th key={a.key} className="text-center py-2 px-3 font-semibold text-gray-700">{a.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {RESOURCES.map(res => (
                  <tr key={res.key} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2.5 pr-4 text-gray-800">{res.label}</td>
                    {ACTIONS.map(act => {
                      const applicable = !res.actions || res.actions.includes(act.key);
                      if (!applicable) return <td key={act.key} className="text-center text-gray-300">—</td>;
                      const roleDefault = roleHas(selectedUser.role, res.key, act.key);
                      const override = overrideFor(selectedUser.id, res.key, act.key);
                      const effective = override ? override.allowed : roleDefault;
                      return (
                        <td key={act.key} className="text-center py-1.5 px-3">
                          <button
                            onClick={() => saveMutation.mutate({ user: selectedUser, resource: res.key, action: act.key, newAllowed: !effective, roleDefault, existingOverride: override })}
                            disabled={saveMutation.isPending}
                            className={`inline-flex items-center justify-center w-20 py-1 rounded-full text-xs font-semibold border transition-colors ${
                              effective
                                ? (override ? 'bg-purple-100 text-purple-700 border-purple-300' : 'bg-green-100 text-green-700 border-green-300')
                                : (override ? 'bg-purple-50 text-purple-500 border-purple-300 line-through' : 'bg-gray-100 text-gray-400 border-gray-200')
                            }`}
                            title={override ? 'Excepción individual — clic para cambiar' : `Default del rol ${selectedUser.role} — clic para crear excepción`}
                          >
                            {effective ? 'Sí' : 'No'}{override ? ' •' : ''}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between mt-4">
              <div className="flex gap-4 text-xs text-gray-500">
                <span><span className="inline-block w-3 h-3 rounded-full bg-green-100 border border-green-300 mr-1" />Default del rol</span>
                <span><span className="inline-block w-3 h-3 rounded-full bg-purple-100 border border-purple-300 mr-1" />Excepción individual (•)</span>
              </div>
              {userPerms.some(up => up.user_id === selectedUser.id) && (
                <Button
                  variant="outline" size="sm" className="gap-1.5 text-gray-600"
                  onClick={async () => {
                    const mine = userPerms.filter(up => up.user_id === selectedUser.id);
                    for (const up of mine) await base44.entities.UserPermission.delete(up.id);
                    await logAudit({ action: 'PERMISOS', module: 'Permisos', entity_type: 'UserPermission', entity_id: selectedUser.id, entity_name: selectedUser.email, details: `Se eliminaron ${mine.length} excepciones — vuelve a los defaults del rol ${selectedUser.role}` });
                    queryClient.invalidateQueries({ queryKey: ['userPermissions'] });
                    toast.success('Excepciones eliminadas — aplican los defaults del rol');
                  }}
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Restablecer al rol
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
