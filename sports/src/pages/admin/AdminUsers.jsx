import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import {
  Users, UserPlus, Pencil, Trash2, X, Trophy,
  CheckCircle2, Shield, ChevronDown, Mail, User,
} from 'lucide-react'

/* ─── constants ──────────────────────────────────────────── */
const ROLE_META = {
  admin:     { label: 'Administrador', color: 'bg-green-100 text-green-800 border-green-200' },
  editor:    { label: 'Editor',        color: 'bg-blue-100  text-blue-800  border-blue-200'  },
  visitante: { label: 'Visitante',     color: 'bg-gray-100  text-gray-600  border-gray-200'  },
  user:      { label: 'Usuario',       color: 'bg-gray-100  text-gray-600  border-gray-200'  },
}

const INVITE_EMPTY = { email: '', full_name: '', role: 'editor', tournament_ids: [] }

/* ─── helpers ────────────────────────────────────────────── */
function RoleBadge({ role }) {
  const m = ROLE_META[role] ?? ROLE_META.user
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${m.color}`}>
      {m.label}
    </span>
  )
}

function Avatar({ name, email }) {
  const initials = (name || email || '?').slice(0, 2).toUpperCase()
  return (
    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-semibold text-green-700">{initials}</span>
    </div>
  )
}

/* ─── modal skeleton ─────────────────────────────────────── */
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  )
}

/* ─── tournament multi-select ────────────────────────────── */
function TournamentSelect({ tournaments, selected, onChange }) {
  const [open, setOpen] = useState(false)
  const selectedNames = tournaments
    .filter(t => selected.includes(t.id))
    .map(t => t.name)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between border border-gray-300 rounded-lg px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
      >
        <span className={selectedNames.length ? 'text-gray-900' : 'text-gray-400'}>
          {selectedNames.length
            ? selectedNames.length === 1
              ? selectedNames[0]
              : `${selectedNames.length} torneos seleccionados`
            : 'Selecciona torneos…'}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {tournaments.length === 0 ? (
            <p className="text-xs text-gray-400 px-3 py-2">No hay torneos disponibles</p>
          ) : (
            tournaments.map(t => {
              const checked = selected.includes(t.id)
              return (
                <label key={t.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      onChange(checked ? selected.filter(id => id !== t.id) : [...selected, t.id])
                    }
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">{t.name}</span>
                  {t.season && <span className="text-xs text-gray-400">{t.season}</span>}
                </label>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

/* ─── main page ──────────────────────────────────────────── */
export default function AdminUsers() {
  const qc = useQueryClient()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editUser, setEditUser]   = useState(null)
  const [delUser,  setDelUser]    = useState(null)
  const [invite,   setInvite]     = useState(INVITE_EMPTY)
  const [editForm, setEditForm]   = useState({ role: 'editor', tournament_ids: [] })

  /* ── data ── */
  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id, email, full_name, role, created_at,
          tournament_admins ( tournament_id, tournaments ( id, name, season ) )
        `)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
  })

  const { data: tournaments = [] } = useQuery({
    queryKey: ['admin-tournaments-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tournaments')
        .select('id, name, season, status')
        .order('name')
      if (error) throw error
      return data
    },
  })

  /* ── invite mutation ── */
  const inviteMutation = useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await supabase.functions.invoke('invite-admin', {
        body: { action: 'invite', ...payload },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('Invitación enviada correctamente')
      setInviteOpen(false)
      setInvite(INVITE_EMPTY)
    },
    onError: (e) => toast.error(e.message || 'Error al enviar la invitación'),
  })

  /* ── edit role mutation ── */
  const editRoleMutation = useMutation({
    mutationFn: async ({ userId, role }) => {
      const { data, error } = await supabase.functions.invoke('invite-admin', {
        body: { action: 'update_role', user_id: userId, role },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: (e) => toast.error(e.message || 'Error al actualizar rol'),
  })

  /* ── edit tournament assignments ── */
  const editTournamentsMutation = useMutation({
    mutationFn: async ({ userId, tournamentIds, currentIds }) => {
      const toAdd = tournamentIds.filter(id => !currentIds.includes(id))
      const toRemove = currentIds.filter(id => !tournamentIds.includes(id))

      if (toRemove.length > 0) {
        const { error } = await supabase
          .from('tournament_admins')
          .delete()
          .eq('user_id', userId)
          .in('tournament_id', toRemove)
        if (error) throw error
      }
      if (toAdd.length > 0) {
        const { error } = await supabase
          .from('tournament_admins')
          .insert(toAdd.map(tid => ({ user_id: userId, tournament_id: tid })))
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('Usuario actualizado')
      setEditUser(null)
    },
    onError: (e) => toast.error(e.message || 'Error al actualizar torneos'),
  })

  /* ── delete mutation ── */
  const deleteMutation = useMutation({
    mutationFn: async (userId) => {
      const { data, error } = await supabase.functions.invoke('invite-admin', {
        body: { action: 'delete_user', user_id: userId },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('Usuario eliminado')
      setDelUser(null)
    },
    onError: (e) => toast.error(e.message || 'Error al eliminar usuario'),
  })

  /* ── open edit ── */
  function openEdit(u) {
    const assignedIds = (u.tournament_admins ?? []).map(ta => ta.tournament_id)
    setEditForm({ role: u.role, tournament_ids: assignedIds })
    setEditUser(u)
  }

  async function handleEditSave() {
    const currentIds = (editUser.tournament_admins ?? []).map(ta => ta.tournament_id)
    try {
      // Update role if changed
      if (editForm.role !== editUser.role) {
        await editRoleMutation.mutateAsync({ userId: editUser.id, role: editForm.role })
      }
      // Update tournament assignments
      await editTournamentsMutation.mutateAsync({
        userId: editUser.id,
        tournamentIds: editForm.tournament_ids,
        currentIds,
      })
    } catch (e) {
      // errors are already surfaced via onError toasts in each mutation
    }
  }

  /* ─────────────────────────────────── render ─────────────── */
  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {users.length} usuario{users.length !== 1 ? 's' : ''} registrado{users.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Invitar usuario
        </button>
      </div>

      {/* user list */}
      {loadingUsers ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No hay usuarios registrados.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <ul className="divide-y divide-gray-100">
            {users.map(u => {
              const assignedTournaments = (u.tournament_admins ?? [])
                .map(ta => ta.tournaments)
                .filter(Boolean)

              return (
                <li key={u.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  <Avatar name={u.full_name} email={u.email} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm truncate">
                        {u.full_name || u.email}
                      </span>
                      <RoleBadge role={u.role} />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{u.email}</p>

                    {assignedTournaments.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {assignedTournaments.map(t => (
                          <span
                            key={t.id}
                            className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full"
                          >
                            <Trophy className="w-2.5 h-2.5" />
                            {t.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {u.role === 'editor' && assignedTournaments.length === 0 && (
                      <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        Sin torneos asignados
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => openEdit(u)}
                      className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Editar usuario"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDelUser(u)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar usuario"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* ── INVITE MODAL ────────────────────────────────── */}
      {inviteOpen && (
        <Modal title="Invitar usuario" onClose={() => { setInviteOpen(false); setInvite(INVITE_EMPTY) }}>
          <div className="space-y-4">
            <Field label="Correo electrónico *">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  required
                  value={invite.email}
                  onChange={e => setInvite(f => ({ ...f, email: e.target.value }))}
                  placeholder="correo@ejemplo.com"
                  className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </Field>

            <Field label="Nombre completo">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={invite.full_name}
                  onChange={e => setInvite(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="Nombre del usuario"
                  className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </Field>

            <Field label="Rol">
              <select
                value={invite.role}
                onChange={e => setInvite(f => ({ ...f, role: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="editor">Editor – acceso a torneos asignados</option>
                <option value="admin">Administrador – acceso total</option>
              </select>
            </Field>

            {invite.role === 'editor' && (
              <Field label="Torneos asignados">
                <TournamentSelect
                  tournaments={tournaments}
                  selected={invite.tournament_ids}
                  onChange={ids => setInvite(f => ({ ...f, tournament_ids: ids }))}
                />
                <p className="text-xs text-gray-400 mt-1">
                  El editor solo verá y podrá gestionar los torneos seleccionados.
                </p>
              </Field>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setInviteOpen(false); setInvite(INVITE_EMPTY) }}
                className="flex-1 border border-gray-300 text-gray-700 font-medium py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!invite.email || inviteMutation.isPending}
                onClick={() => inviteMutation.mutate(invite)}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 rounded-lg text-sm transition-colors"
              >
                {inviteMutation.isPending ? 'Enviando…' : 'Enviar invitación'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── EDIT MODAL ──────────────────────────────────── */}
      {editUser && (
        <Modal title="Editar usuario" onClose={() => setEditUser(null)}>
          <div className="space-y-4">
            {/* user info */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Avatar name={editUser.full_name} email={editUser.email} />
              <div>
                <p className="text-sm font-semibold text-gray-800">{editUser.full_name || '—'}</p>
                <p className="text-xs text-gray-400">{editUser.email}</p>
              </div>
            </div>

            <Field label="Rol">
              <select
                value={editForm.role}
                onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="editor">Editor – acceso a torneos asignados</option>
                <option value="admin">Administrador – acceso total</option>
                <option value="visitante">Visitante – solo lectura</option>
              </select>
            </Field>

            {editForm.role === 'editor' && (
              <Field label="Torneos asignados">
                <TournamentSelect
                  tournaments={tournaments}
                  selected={editForm.tournament_ids}
                  onChange={ids => setEditForm(f => ({ ...f, tournament_ids: ids }))}
                />
              </Field>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditUser(null)}
                className="flex-1 border border-gray-300 text-gray-700 font-medium py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={editTournamentsMutation.isPending || editRoleMutation.isPending}
                onClick={handleEditSave}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 rounded-lg text-sm transition-colors"
              >
                {(editTournamentsMutation.isPending || editRoleMutation.isPending) ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── DELETE CONFIRM ───────────────────────────────── */}
      {delUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Eliminar usuario</h3>
            <p className="text-sm text-gray-600 mb-1">
              ¿Eliminar a <strong>{delUser.full_name || delUser.email}</strong>?
            </p>
            <p className="text-xs text-gray-400 mb-6">
              Se revocarán todos sus accesos. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDelUser(null)}
                className="flex-1 border border-gray-300 text-gray-700 font-medium py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteMutation.mutate(delUser.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-medium py-2 rounded-lg text-sm transition-colors"
              >
                {deleteMutation.isPending ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
