import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/utils'
import {
  ArrowLeft, Plus, Pencil, Trash2, X, Users, Calendar, Zap, Link2
} from 'lucide-react'
import { toast } from 'sonner'

const TAB_LABELS = ['Equipos', 'Partidos']

// ─── helpers ────────────────────────────────────────────────────────────────
const EMPTY_TEAM = { name: '', captain_name: '', color: '#16a34a', logo_url: '', status: 'active', group_id: '' }
const EMPTY_MATCH = {
  matchday: 1, home_team_id: '', away_team_id: '',
  field: '', match_date: '', match_time: '',
  status: 'scheduled', home_goals: '', away_goals: '',
  forfait_team_id: '', group_id: '', category_id: '',
}
const EMPTY_EVENT = { match_id: '', team_id: '', player_name: '', minute: '', event_type: 'goal' }


export default function AdminTournamentDetail() {
  const { id } = useParams()
  const qc = useQueryClient()
  const [tab, setTab] = useState(0)

  // ── Tournament ──────────────────────────────────────────────────────────
  const { data: tournament } = useQuery({
    queryKey: ['admin-tournament', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('tournaments').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
  })

  // ── Categories ──────────────────────────────────────────────────────────
  const { data: categories = [] } = useQuery({
    queryKey: ['admin-categories', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').eq('tournament_id', id).order('name')
      if (error) throw error
      return data
    },
  })

  // ── Groups ──────────────────────────────────────────────────────────────
  const { data: groups = [] } = useQuery({
    queryKey: ['admin-groups', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('groups').select('*').eq('tournament_id', id).order('order')
      if (error) throw error
      return data
    },
  })

  // ── Teams ────────────────────────────────────────────────────────────────
  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ['admin-teams', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('*, captain_token')
        .eq('tournament_id', id)
        .order('name')
      if (error) throw error
      return data
    },
  })

  // ── Matches ──────────────────────────────────────────────────────────────
  const { data: matches = [], isLoading: matchesLoading } = useQuery({
    queryKey: ['admin-matches', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('*, home:teams!home_team_id(id,name), away:teams!away_team_id(id,name)')
        .eq('tournament_id', id)
        .order('matchday')
        .order('match_date', { ascending: true, nullsFirst: false })
      if (error) throw error
      return data
    },
  })

  // ── Events ───────────────────────────────────────────────────────────────
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['admin-events', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('match_events')
        .select('*, match:matches(id,matchday,home_team_name,away_team_name)')
        .eq('tournament_id', id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  // ─── Team mutations ──────────────────────────────────────────────────────
  const [teamModal, setTeamModal] = useState(null)
  const [teamForm, setTeamForm] = useState(EMPTY_TEAM)
  const [deletingTeam, setDeletingTeam] = useState(null)

  const saveTeam = useMutation({
    mutationFn: async (values) => {
      const payload = { ...values, tournament_id: id, group_id: values.group_id || null }
      if (teamModal === 'create') {
        const { error } = await supabase.from('teams').insert(payload)
        if (error) throw error
      } else {
        const { error } = await supabase.from('teams').update(payload).eq('id', teamModal.id)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-teams', id] })
      toast.success(teamModal === 'create' ? 'Equipo creado' : 'Equipo actualizado')
      setTeamModal(null)
    },
    onError: () => toast.error('Error al guardar equipo'),
  })

  const deleteTeam = useMutation({
    mutationFn: async (tid) => {
      const { error } = await supabase.from('teams').delete().eq('id', tid)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-teams', id] })
      toast.success('Equipo eliminado')
      setDeletingTeam(null)
    },
    onError: () => toast.error('Error al eliminar'),
  })

  // ─── Match mutations ─────────────────────────────────────────────────────
  const [matchModal, setMatchModal] = useState(null)
  const [matchForm, setMatchForm] = useState(EMPTY_MATCH)
  const [deletingMatch, setDeletingMatch] = useState(null)

  const saveMatch = useMutation({
    mutationFn: async (values) => {
      const payload = {
        ...values,
        tournament_id: id,
        home_goals: values.home_goals === '' ? null : Number(values.home_goals),
        away_goals: values.away_goals === '' ? null : Number(values.away_goals),
        forfait_team_id: values.forfait_team_id || null,
        group_id: values.group_id || null,
        category_id: values.category_id || null,
        field: values.field || null,
        match_date: values.match_date || null,
        match_time: values.match_time || null,
        // denormalize team names
        home_team_name: teams.find(t => t.id === values.home_team_id)?.name || '',
        away_team_name: teams.find(t => t.id === values.away_team_id)?.name || '',
      }
      if (matchModal === 'create') {
        const { error } = await supabase.from('matches').insert(payload)
        if (error) throw error
      } else {
        const { error } = await supabase.from('matches').update(payload).eq('id', matchModal.id)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-matches', id] })
      toast.success(matchModal === 'create' ? 'Partido creado' : 'Partido actualizado')
      setMatchModal(null)
    },
    onError: (e) => toast.error('Error al guardar partido: ' + e.message),
  })

  const deleteMatch = useMutation({
    mutationFn: async (mid) => {
      const { error } = await supabase.from('matches').delete().eq('id', mid)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-matches', id] })
      toast.success('Partido eliminado')
      setDeletingMatch(null)
    },
    onError: () => toast.error('Error al eliminar'),
  })

  // ─── Event mutations ─────────────────────────────────────────────────────
  const [eventModal, setEventModal] = useState(null)
  const [eventForm, setEventForm] = useState(EMPTY_EVENT)
  const [deletingEvent, setDeletingEvent] = useState(null)
  const [matchTeamsFilter, setMatchTeamsFilter] = useState(null) // [home_id, away_id] when opened from a match row
  const [expandedMatch, setExpandedMatch] = useState(null) // match id whose events are shown inline

  const saveEvent = useMutation({
    mutationFn: async (values) => {
      const payload = {
        ...values,
        tournament_id: id,
        minute: values.minute === '' ? null : Number(values.minute),
        team_id: values.team_id || null,
        team_name: teams.find(t => t.id === values.team_id)?.name || null,
      }
      if (eventModal === 'create') {
        const { error } = await supabase.from('match_events').insert(payload)
        if (error) throw error
      } else {
        const { error } = await supabase.from('match_events').update(payload).eq('id', eventModal.id)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-events', id] })
      toast.success(eventModal === 'create' ? 'Evento registrado' : 'Evento actualizado')
      setEventModal(null)
    },
    onError: () => toast.error('Error al guardar evento'),
  })

  const deleteEvent = useMutation({
    mutationFn: async (eid) => {
      const { error } = await supabase.from('match_events').delete().eq('id', eid)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-events', id] })
      toast.success('Evento eliminado')
      setDeletingEvent(null)
    },
    onError: () => toast.error('Error al eliminar'),
  })

  // ── Open event modal pre-filled for a specific match ────────────────────
  function openEventForMatch(m) {
    setEventForm({ ...EMPTY_EVENT, match_id: m.id })
    setMatchTeamsFilter([m.home_team_id, m.away_team_id])
    setEventModal('create')
  }

  // ── Grouped matches by matchday ───────────────────────────────────────────
  const matchesByDay = matches.reduce((acc, m) => {
    const day = m.matchday
    if (!acc[day]) acc[day] = []
    acc[day].push(m)
    return acc
  }, {})

  if (!tournament) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to="/admin/torneos" className="mt-1 text-gray-400 hover:text-green-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 leading-tight">{tournament.name}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
            {tournament.season && <span>{tournament.season}</span>}
            {tournament.start_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(tournament.start_date)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {teams.length} equipos
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TAB_LABELS.map((label, i) => (
          <button
            key={i}
            onClick={() => setTab(i)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === i
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB 0: EQUIPOS ────────────────────────────────────────────────── */}
      {tab === 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">{teams.length} equipo{teams.length !== 1 ? 's' : ''}</p>
            <button
              onClick={() => { setTeamForm(EMPTY_TEAM); setTeamModal('create') }}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" /> Equipo
            </button>
          </div>

          {teamsLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
            </div>
          ) : teams.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay equipos aún</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <ul className="divide-y divide-gray-100">
                {teams.map(t => {
                  const groupName = groups.find(g => g.id === t.group_id)?.name
                  return (
                    <li key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
                      <div
                        className="w-4 h-4 rounded-full shrink-0 border border-white shadow-sm"
                        style={{ backgroundColor: t.color || '#16a34a' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{t.name}</p>
                        <p className="text-xs text-gray-400">
                          {t.captain_name && <span>Capitán: {t.captain_name}</span>}
                          {groupName && <span className="ml-2 text-gray-300">·</span>}
                          {groupName && <span className="ml-2">{groupName}</span>}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {t.status === 'active' ? 'Activo' : 'Inactivo'}
                      </span>
                      {t.captain_token && (
                        <button
                          onClick={() => {
                            const url = `${window.location.origin}/capitan/${t.captain_token}`
                            navigator.clipboard.writeText(url)
                            toast.success('Enlace del capitán copiado')
                          }}
                          title="Copiar enlace del capitán"
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg transition-colors"
                        >
                          <Link2 className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => { setTeamForm({ name: t.name, captain_name: t.captain_name || '', color: t.color || '#16a34a', logo_url: t.logo_url || '', status: t.status || 'active', group_id: t.group_id || '' }); setTeamModal(t) }} className="p-1.5 text-gray-400 hover:text-green-600 rounded-lg transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeletingTeam(t)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 1: PARTIDOS ──────────────────────────────────────────────── */}
      {tab === 1 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">{matches.length} partido{matches.length !== 1 ? 's' : ''}</p>
            <button
              onClick={() => { setMatchForm(EMPTY_MATCH); setMatchModal('create') }}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" /> Partido
            </button>
          </div>

          {matchesLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
            </div>
          ) : matches.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay partidos aún</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.keys(matchesByDay).sort((a, b) => Number(a) - Number(b)).map(day => (
                <div key={day}>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Jornada {day}</h3>
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <ul className="divide-y divide-gray-100">
                      {matchesByDay[day].map(m => {
                        const isPlayed = m.status === 'completed'
                        const hWin = isPlayed && m.home_goals > m.away_goals
                        const aWin = isPlayed && m.away_goals > m.home_goals
                        const matchEvents = events.filter(ev => ev.match_id === m.id)
                        const goalCount = matchEvents.filter(ev => ev.event_type === 'goal').length
                        const yellowCount = matchEvents.filter(ev => ev.event_type === 'yellow_card').length
                        const redCount = matchEvents.filter(ev => ev.event_type === 'red_card').length
                        const hasEvents = matchEvents.length > 0
                        const isExpanded = expandedMatch === m.id

                        return (
                          <li key={m.id} className="px-5 py-3 hover:bg-gray-50">
                            {/* Fila principal */}
                            <div className="flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 text-sm">
                                  <span className={`font-medium truncate ${hWin ? 'text-green-700' : 'text-gray-900'}`}>
                                    {m.home_team_name}
                                  </span>
                                  <span className="shrink-0 text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">
                                    {isPlayed ? `${m.home_goals} - ${m.away_goals}` : 'vs'}
                                  </span>
                                  <span className={`font-medium truncate ${aWin ? 'text-green-700' : 'text-gray-900'}`}>
                                    {m.away_team_name}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {m.match_date ? formatDate(m.match_date) : 'Fecha TBD'}
                                  {m.match_time ? ` · ${m.match_time.slice(0, 5)}` : ''}
                                  {m.field ? ` · ${m.field}` : ''}
                                  {m.forfait_team_id && <span className="ml-1 text-red-500">· FORFAIT</span>}
                                </p>
                              </div>
                              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                                m.status === 'completed' ? 'bg-green-100 text-green-700'
                                : m.status === 'in_progress' ? 'bg-blue-100 text-blue-700'
                                : m.status === 'forfait' || m.status === 'cancelled' ? 'bg-red-100 text-red-600'
                                : 'bg-gray-100 text-gray-500'
                              }`}>
                                {m.status === 'completed' ? 'Jugado'
                                  : m.status === 'in_progress' ? 'En curso'
                                  : m.status === 'forfait' ? 'Forfait'
                                  : m.status === 'cancelled' ? 'Cancelado'
                                  : 'Programado'}
                              </span>
                              <button
                                onClick={() => openEventForMatch(m)}
                                title="Registrar evento (gol, tarjeta…)"
                                className="p-1.5 text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 rounded-lg transition-colors"
                              >
                                <Zap className="w-4 h-4" />
                              </button>
                              <button onClick={() => {
                                setMatchForm({
                                  matchday: m.matchday,
                                  home_team_id: m.home_team_id,
                                  away_team_id: m.away_team_id,
                                  field: m.field || '',
                                  match_date: m.match_date || '',
                                  match_time: m.match_time ? m.match_time.slice(0, 5) : '',
                                  status: m.status || 'scheduled',
                                  home_goals: m.home_goals ?? '',
                                  away_goals: m.away_goals ?? '',
                                  forfait_team_id: m.forfait_team_id || '',
                                  group_id: m.group_id || '',
                                  category_id: m.category_id || '',
                                })
                                setMatchModal(m)
                              }} className="p-1.5 text-gray-400 hover:text-green-600 rounded-lg transition-colors">
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button onClick={() => setDeletingMatch(m)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Contador de eventos — clickeable para expandir */}
                            {hasEvents && (
                              <button
                                onClick={() => setExpandedMatch(isExpanded ? null : m.id)}
                                className="mt-2 ml-0 flex items-center gap-3 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                              >
                                {goalCount > 0 && <span>⚽ {goalCount} {goalCount === 1 ? 'gol' : 'goles'}</span>}
                                {yellowCount > 0 && <span>🟨 {yellowCount} amarilla{yellowCount !== 1 ? 's' : ''}</span>}
                                {redCount > 0 && <span>🟥 {redCount} roja{redCount !== 1 ? 's' : ''}</span>}
                                <span className="text-gray-300 ml-1">{isExpanded ? '▲' : '▼'}</span>
                              </button>
                            )}

                            {/* Lista de eventos expandida */}
                            {isExpanded && (
                              <ul className="mt-2 ml-1 space-y-1 border-l-2 border-gray-100 pl-3">
                                {matchEvents.map(ev => (
                                  <li key={ev.id} className="flex items-center gap-2 text-xs text-gray-600">
                                    <span>
                                      {ev.event_type === 'goal' ? '⚽' : ev.event_type === 'yellow_card' ? '🟨' : '🟥'}
                                    </span>
                                    <span className="font-medium">{ev.player_name || '—'}</span>
                                    {ev.minute && <span className="text-gray-400">{ev.minute}'</span>}
                                    {ev.team_name && <span className="text-gray-400">· {ev.team_name}</span>}
                                    <button
                                      onClick={() => setDeletingEvent(ev)}
                                      className="ml-auto p-0.5 text-gray-300 hover:text-red-500 transition-colors"
                                      title="Eliminar evento"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TEAM MODAL ───────────────────────────────────────────────────── */}
      {teamModal !== null && (
        <Modal title={teamModal === 'create' ? 'Nuevo equipo' : 'Editar equipo'} onClose={() => setTeamModal(null)}>
          <form onSubmit={e => { e.preventDefault(); saveTeam.mutate(teamForm) }} className="space-y-4">
            <Field label="Nombre *">
              <input required value={teamForm.name} onChange={e => setTeamForm(f => ({ ...f, name: e.target.value }))} className={INPUT} placeholder="Nombre del equipo" />
            </Field>
            <Field label="Capitán">
              <input value={teamForm.captain_name} onChange={e => setTeamForm(f => ({ ...f, captain_name: e.target.value }))} className={INPUT} placeholder="Nombre del capitán" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Color">
                <div className="flex gap-2 items-center">
                  <input type="color" value={teamForm.color} onChange={e => setTeamForm(f => ({ ...f, color: e.target.value }))} className="w-10 h-9 rounded border border-gray-300 cursor-pointer" />
                  <input value={teamForm.color} onChange={e => setTeamForm(f => ({ ...f, color: e.target.value }))} className={INPUT + ' flex-1'} />
                </div>
              </Field>
              <Field label="Estado">
                <select value={teamForm.status} onChange={e => setTeamForm(f => ({ ...f, status: e.target.value }))} className={INPUT}>
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                </select>
              </Field>
            </div>
            {groups.length > 0 && (
              <Field label="Grupo">
                <select value={teamForm.group_id} onChange={e => setTeamForm(f => ({ ...f, group_id: e.target.value }))} className={INPUT}>
                  <option value="">Sin grupo</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </Field>
            )}
            <Field label="URL Logo">
              <input value={teamForm.logo_url} onChange={e => setTeamForm(f => ({ ...f, logo_url: e.target.value }))} className={INPUT} placeholder="https://..." />
            </Field>
            <ModalActions onCancel={() => setTeamModal(null)} pending={saveTeam.isPending} />
          </form>
        </Modal>
      )}

      {/* ── MATCH MODAL ──────────────────────────────────────────────────── */}
      {matchModal !== null && (
        <Modal title={matchModal === 'create' ? 'Nuevo partido' : 'Editar partido'} onClose={() => setMatchModal(null)}>
          <form onSubmit={e => { e.preventDefault(); saveMatch.mutate(matchForm) }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Jornada *">
                <input required type="number" min="1" value={matchForm.matchday} onChange={e => setMatchForm(f => ({ ...f, matchday: Number(e.target.value) }))} className={INPUT} />
              </Field>
              <Field label="Estado">
                <select value={matchForm.status} onChange={e => setMatchForm(f => ({ ...f, status: e.target.value }))} className={INPUT}>
                  <option value="scheduled">Programado</option>
                  <option value="in_progress">En curso</option>
                  <option value="completed">Jugado</option>
                  <option value="forfait">Forfait</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </Field>
            </div>
            <Field label="Equipo local *">
              <select required value={matchForm.home_team_id} onChange={e => setMatchForm(f => ({ ...f, home_team_id: e.target.value }))} className={INPUT}>
                <option value="">Seleccionar...</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Equipo visitante *">
              <select required value={matchForm.away_team_id} onChange={e => setMatchForm(f => ({ ...f, away_team_id: e.target.value }))} className={INPUT}>
                <option value="">Seleccionar...</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            {matchForm.status === 'completed' && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Goles local">
                  <input type="number" min="0" value={matchForm.home_goals} onChange={e => setMatchForm(f => ({ ...f, home_goals: e.target.value }))} className={INPUT} />
                </Field>
                <Field label="Goles visitante">
                  <input type="number" min="0" value={matchForm.away_goals} onChange={e => setMatchForm(f => ({ ...f, away_goals: e.target.value }))} className={INPUT} />
                </Field>
              </div>
            )}
            {matchForm.status === 'completed' && (
              <Field label="Forfait (equipo que no se presentó)">
                <select value={matchForm.forfait_team_id} onChange={e => setMatchForm(f => ({ ...f, forfait_team_id: e.target.value }))} className={INPUT}>
                  <option value="">Ninguno</option>
                  {teams.filter(t => t.id === matchForm.home_team_id || t.id === matchForm.away_team_id).map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fecha">
                <input type="date" value={matchForm.match_date} onChange={e => setMatchForm(f => ({ ...f, match_date: e.target.value }))} className={INPUT} />
              </Field>
              <Field label="Hora">
                <input type="time" value={matchForm.match_time} onChange={e => setMatchForm(f => ({ ...f, match_time: e.target.value }))} className={INPUT} />
              </Field>
            </div>
            <Field label="Campo">
              <input value={matchForm.field} onChange={e => setMatchForm(f => ({ ...f, field: e.target.value }))} className={INPUT} placeholder="Cancha principal" />
            </Field>
            {groups.length > 0 && (
              <Field label="Grupo">
                <select value={matchForm.group_id} onChange={e => setMatchForm(f => ({ ...f, group_id: e.target.value }))} className={INPUT}>
                  <option value="">Sin grupo</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </Field>
            )}
            <ModalActions onCancel={() => setMatchModal(null)} pending={saveMatch.isPending} />
          </form>
        </Modal>
      )}

      {/* ── EVENT MODAL ──────────────────────────────────────────────────── */}
      {eventModal !== null && (() => {
        const selectedMatch = matches.find(m => m.id === eventForm.match_id)
        const availableTeams = selectedMatch
          ? teams.filter(t => t.id === selectedMatch.home_team_id || t.id === selectedMatch.away_team_id)
          : teams
        function closeEventModal() {
          setEventModal(null)
          setMatchTeamsFilter(null)
        }
        return (
          <Modal title={eventModal === 'create' ? 'Registrar evento' : 'Editar evento'} onClose={closeEventModal}>
            <form onSubmit={e => { e.preventDefault(); saveEvent.mutate(eventForm) }} className="space-y-4">
              {/* Partido — bloqueado si viene de una fila, seleccionable si es manual */}
              <Field label="Partido *">
                {matchTeamsFilter && selectedMatch ? (
                  <div className={INPUT + ' bg-gray-50 text-gray-700 cursor-not-allowed'}>
                    J{selectedMatch.matchday}: {selectedMatch.home_team_name} vs {selectedMatch.away_team_name}
                  </div>
                ) : (
                  <select required value={eventForm.match_id} onChange={e => setEventForm(f => ({ ...f, match_id: e.target.value, team_id: '' }))} className={INPUT}>
                    <option value="">Seleccionar...</option>
                    {matches.map(m => (
                      <option key={m.id} value={m.id}>J{m.matchday}: {m.home_team_name} vs {m.away_team_name}</option>
                    ))}
                  </select>
                )}
              </Field>

              {/* Tipo de evento — visual con colores */}
              <Field label="Tipo de evento *">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'goal', label: '⚽ Gol', active: 'bg-green-600 text-white border-green-600' },
                    { value: 'yellow_card', label: '🟨 Amarilla', active: 'bg-yellow-400 text-white border-yellow-400' },
                    { value: 'red_card', label: '🟥 Roja', active: 'bg-red-600 text-white border-red-600' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setEventForm(f => ({ ...f, event_type: opt.value }))}
                      className={`py-2 px-3 text-sm font-medium rounded-lg border-2 transition-all ${
                        eventForm.event_type === opt.value
                          ? opt.active
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Equipo">
                <select value={eventForm.team_id} onChange={e => setEventForm(f => ({ ...f, team_id: e.target.value }))} className={INPUT}>
                  <option value="">Seleccionar...</option>
                  {availableTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Nombre del jugador">
                  <input value={eventForm.player_name} onChange={e => setEventForm(f => ({ ...f, player_name: e.target.value }))} className={INPUT} placeholder="Ej. J. García" />
                </Field>
                <Field label="Minuto">
                  <input type="number" min="1" max="120" value={eventForm.minute} onChange={e => setEventForm(f => ({ ...f, minute: e.target.value }))} className={INPUT} placeholder="45" />
                </Field>
              </div>

              <ModalActions onCancel={closeEventModal} pending={saveEvent.isPending} />
            </form>
          </Modal>
        )
      })()}

      {/* ── DELETE CONFIRMS ───────────────────────────────────────────────── */}
      {deletingTeam && <DeleteConfirm name={deletingTeam.name} onCancel={() => setDeletingTeam(null)} onConfirm={() => deleteTeam.mutate(deletingTeam.id)} pending={deleteTeam.isPending} />}
      {deletingMatch && <DeleteConfirm name={`J${deletingMatch.matchday}: ${deletingMatch.home_team_name} vs ${deletingMatch.away_team_name}`} onCancel={() => setDeletingMatch(null)} onConfirm={() => deleteMatch.mutate(deletingMatch.id)} pending={deleteMatch.isPending} />}
      {deletingEvent && <DeleteConfirm name={`Evento de ${deletingEvent.player_name || 'jugador'}`} onCancel={() => setDeletingEvent(null)} onConfirm={() => deleteEvent.mutate(deletingEvent.id)} pending={deleteEvent.isPending} />}
    </div>
  )
}

// ── Shared UI components ────────────────────────────────────────────────────
const INPUT = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

function ModalActions({ onCancel, pending }) {
  return (
    <div className="flex gap-3 pt-2">
      <button type="button" onClick={onCancel} className="flex-1 border border-gray-300 text-gray-700 font-medium py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors">Cancelar</button>
      <button type="submit" disabled={pending} className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-medium py-2 rounded-lg text-sm transition-colors">
        {pending ? 'Guardando...' : 'Guardar'}
      </button>
    </div>
  )
}

function DeleteConfirm({ name, onCancel, onConfirm, pending }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-2">Confirmar eliminación</h3>
        <p className="text-sm text-gray-600 mb-6">¿Eliminar <strong>{name}</strong>? Esta acción no se puede deshacer.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 border border-gray-300 text-gray-700 font-medium py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors">Cancelar</button>
          <button onClick={onConfirm} disabled={pending} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-medium py-2 rounded-lg text-sm transition-colors">
            {pending ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}
