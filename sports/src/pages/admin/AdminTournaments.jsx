import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/utils'
import { Trophy, Plus, Pencil, Trash2, ChevronRight, X, Calendar, Users } from 'lucide-react'
import { toast } from 'sonner'

const STATUS_LABEL = { active: 'En curso', draft: 'Próximo', finished: 'Finalizado' }
const STATUS_COLOR = {
  active: 'bg-green-100 text-green-800',
  draft: 'bg-blue-100 text-blue-800',
  finished: 'bg-gray-100 text-gray-600',
}

const EMPTY_FORM = {
  name: '',
  season: '',
  status: 'draft',
  start_date: '',
  end_date: '',
  description: '',
  points_win: 3,
  points_draw: 1,
  points_loss: 0,
  yellows_for_suspension: 3,
}

export default function AdminTournaments() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null) // null | 'create' | { id, ...tournament }
  const [deleting, setDeleting] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const { data: tournaments = [], isLoading } = useQuery({
    queryKey: ['admin-tournaments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*, teams(count)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (values) => {
      if (modal === 'create') {
        const { error } = await supabase.from('tournaments').insert(values)
        if (error) throw error
      } else {
        const { error } = await supabase.from('tournaments').update(values).eq('id', modal.id)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-tournaments'] })
      toast.success(modal === 'create' ? 'Torneo creado' : 'Torneo actualizado')
      setModal(null)
    },
    onError: () => toast.error('Error al guardar'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('tournaments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-tournaments'] })
      toast.success('Torneo eliminado')
      setDeleting(null)
    },
    onError: () => toast.error('Error al eliminar'),
  })

  function openCreate() {
    setForm(EMPTY_FORM)
    setModal('create')
  }

  function openEdit(t) {
    setForm({
      name: t.name || '',
      season: t.season || '',
      status: t.status || 'draft',
      start_date: t.start_date || '',
      end_date: t.end_date || '',
      description: t.description || '',
      points_win: t.points_win ?? 3,
      points_draw: t.points_draw ?? 1,
      points_loss: t.points_loss ?? 0,
      yellows_for_suspension: t.yellows_for_suspension ?? 3,
    })
    setModal(t)
  }

  function handleSubmit(e) {
    e.preventDefault()
    const clean = {
      ...form,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      description: form.description || null,
      season: form.season || null,
    }
    saveMutation.mutate(clean)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Torneos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{tournaments.length} torneo{tournaments.length !== 1 ? 's' : ''} en total</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo torneo
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
        </div>
      ) : tournaments.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No hay torneos. Crea el primero.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <ul className="divide-y divide-gray-100">
            {tournaments.map(t => (
              <li key={t.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">{t.name}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[t.status] || STATUS_COLOR.draft}`}>
                      {STATUS_LABEL[t.status] || t.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                    {t.season && <span>{t.season}</span>}
                    {t.start_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(t.start_date)}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {t.teams?.[0]?.count ?? 0} equipos
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(t)}
                    className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleting(t)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <Link
                    to={`/admin/torneo/${t.id}`}
                    className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title="Ver detalle"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Create / Edit Modal */}
      {modal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">{modal === 'create' ? 'Nuevo torneo' : 'Editar torneo'}</h2>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Liga Fut 7 Libre"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Temporada</label>
                  <input
                    value={form.season}
                    onChange={e => setForm(f => ({ ...f, season: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="2026"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="draft">Próximo</option>
                    <option value="active">En curso</option>
                    <option value="finished">Finalizado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha inicio</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha fin</label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  placeholder="Descripción del torneo..."
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pts victoria</label>
                  <input
                    type="number"
                    min="0"
                    value={form.points_win}
                    onChange={e => setForm(f => ({ ...f, points_win: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pts empate</label>
                  <input
                    type="number"
                    min="0"
                    value={form.points_draw}
                    onChange={e => setForm(f => ({ ...f, points_draw: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amarillas susp.</label>
                  <input
                    type="number"
                    min="1"
                    value={form.yellows_for_suspension}
                    onChange={e => setForm(f => ({ ...f, yellows_for_suspension: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="flex-1 border border-gray-300 text-gray-700 font-medium py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-medium py-2 rounded-lg text-sm transition-colors"
                >
                  {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Eliminar torneo</h3>
            <p className="text-sm text-gray-600 mb-6">
              ¿Eliminar <strong>{deleting.name}</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleting(null)}
                className="flex-1 border border-gray-300 text-gray-700 font-medium py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleting.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-medium py-2 rounded-lg text-sm transition-colors"
              >
                {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
