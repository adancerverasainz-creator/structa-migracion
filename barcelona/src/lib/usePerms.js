import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Hook de permisos granulares — espejo frontend de has_perm() en la BD.
 * El RLS es la barrera real; esto solo OCULTA acciones que el rol no puede
 * ejecutar, para que la UI no ofrezca botones destinados a fallar.
 * Recursos válidos: payments, expenses, fondos, cxp, tournaments, summercamp,
 * players, programs, prospectos, condonaciones.
 */
export function usePerms(resource) {
  const { data: me } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me() });
  const { data: rolePerms = [] } = useQuery({
    queryKey: ['rolePermissions'],
    queryFn: () => base44.entities.RolePermission.list(null, 1000),
  });
  const { data: userPerms = [] } = useQuery({
    queryKey: ['userPermissionsAll'],
    queryFn: () => base44.entities.UserPermission.list(null, 1000).catch(() => []),
  });

  const can = (action) => {
    if (!me) return false;
    if (me.role === 'admin') return true;
    const override = userPerms.find(up => up.user_id === me.id && up.resource === resource && up.action === action);
    if (override) return !!override.allowed;
    return rolePerms.some(rp => rp.role === me.role && rp.resource === resource && rp.action === action);
  };

  return {
    can,
    canCreate: can('create'),
    canUpdate: can('update'),
    canDelete: can('delete'),
    role: me?.role || null,
    isAdmin: me?.role === 'admin',
  };
}
