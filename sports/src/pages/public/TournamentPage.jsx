import { useQuery } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { calcStandings, calcScorers, formatDate } from '../../lib/utils'
import { ArrowLeft, Trophy, Calendar, Users, Target, ClipboardList } from 'lucide-react'
import { useState } from 'react'

const TABS = [
  { key: 'posiciones', label: 'Posiciones', icon: ClipboardList },
  { key: 'jornadas', label: 'Jornadas', icon: Calendar },
  { key: 'goleadores', label: 'Goleadores', icon: Target },
  { key: 'equipos', label: 'Equipos', icon: Users },
]

export default function TournamentPage() {
  const { id } = useParams()
  const [tab, setTab] = useState('posiciones')
  const [selectedCategory, setSelectedCategory] = useState(null)

  const { data: tournament, isLoading: tLoading } = useQuery({
    queryKey: ['tournament', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('tournaments').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').eq('tournament_id', id).order('name')
      if (error) throw error
      return data
    },
    enabled: !!id,
    onSuccess: (data) => {
      if (data.length > 0 && !selectedCategory) setSelectedCategory(data[0].id)
    },
  })

  const activeCategory = selectedCategory || (categories[0]?.id ?? null)

  const { data: groups = [] } = useQuery({
    queryKey: ['groups', id, activeCategory],
    queryFn: async () => {
      let q = supabase.from('groups').select('*').eq('tournament_id', id)
      if (activeCategory) q = q.eq('category_id', activeCategory)
      const { data, error } = await q.order('order', { ascending: true, nullsFirst: false })
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  const { data: teams = [] } = useQuery({
    queryKey: ['teams', id, activeCategory],
    queryFn: async () => {
      let q = supabase.from('teams').select('*').eq('tournament_id', id).eq('status', 'active')
      if (activeCategory) q = q.eq('category_id', activeCategory)
      const { data, error } = await q.order('name')
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  const { data: matches = [] } = useQuery({
    queryKey: ['matches', id, activeCategory],
    queryFn: async () => {
      let q = supabase.from('matches').select('*, home_team:home_team_id(name,color,logo_url), away_team:away_team_id(name,color,logo_url)').eq('tournament_id', id)
      if (activeCategory) q = q.eq('category_id', activeCategory)
      const { data, error } = await q.order('matchday').order('match_date', { ascending: true, nullsFirst: false })
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  const { data: events = [] } = useQuery({
    queryKey: ['events', id, activeCategory],
    queryFn: async () => {
      let q = supabase.from('match_events').select('*').eq('tournament_id', id)
      if (activeCategory) q = q.eq('category_id', activeCategory)
      const { data, error } = await q
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  if (tLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-10 h-10 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!tournament) {
    return <div className="text-center py-16 text-gray-400">Torneo no encontrado.</div>
  }

  const standings = calcStandings(teams, matches)
  const scorers = calcScorers(events)

  // Group matches by matchday
  const matchdays = [...new Set(matches.map(m => m.matchday))].sort((a, b) => a - b)

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-green-700 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Todos los torneos
        </Link>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{tournament.name}</h1>
              {tournament.season && <p className="text-gray-500 mt-1">{tournament.season}</p>}
              <div className="flex gap-4 mt-3 text-sm text-gray-400 flex-wrap">
                {tournament.start_date && <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{formatDate(tournament.start_date)}{tournament.end_date ? ` — ${formatDate(tournament.end_date)}` : ''}</span>}
                <span className="flex items-center gap-1"><Users className="w-4 h-4" />{teams.length} equipos</span>
              </div>
            </div>
            <Trophy className="w-10 h-10 text-green-600 opacity-30 flex-shrink-0" />
          </div>
        </div>
      </div>

      {/* Category selector */}
      {categories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeCategory === c.id
                  ? 'bg-green-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-green-400'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 flex gap-1 overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === t.key
                  ? 'border-green-600 text-green-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === 'posiciones' && (
        <StandingsTab standings={standings} groups={groups} teams={teams} matches={matches} />
      )}
      {tab === 'jornadas' && (
        <JornadasTab matchdays={matchdays} matches={matches} />
      )}
      {tab === 'goleadores' && (
        <GoleadoresTab scorers={scorers} />
      )}
      {tab === 'equipos' && (
        <EquiposTab teams={teams} />
      )}
    </div>
  )
}

// ── Standings ──────────────────────────────────────────────────
function StandingsTab({ standings, groups, teams, matches }) {
  if (groups.length > 1) {
    return (
      <div className="space-y-6">
        {groups.map(g => {
          const groupTeams = teams.filter(t => t.group_id === g.id)
          const groupMatches = matches.filter(m => m.group_id === g.id)
          const gs = calcStandings(groupTeams, groupMatches)
          return (
            <div key={g.id}>
              <h3 className="font-semibold text-gray-700 mb-2 text-sm uppercase tracking-wide">{g.name}</h3>
              <StandingsTable rows={gs} />
            </div>
          )
        })}
      </div>
    )
  }
  return <StandingsTable rows={standings} />
}

function StandingsTable({ rows }) {
  if (rows.length === 0) return <p className="text-gray-400 text-sm py-4">Sin equipos registrados.</p>
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
          <tr>
            <th className="text-left px-4 py-3 font-medium">#</th>
            <th className="text-left px-4 py-3 font-medium">Equipo</th>
            <th className="text-center px-2 py-3 font-medium">PJ</th>
            <th className="text-center px-2 py-3 font-medium">PG</th>
            <th className="text-center px-2 py-3 font-medium">PE</th>
            <th className="text-center px-2 py-3 font-medium">PP</th>
            <th className="text-center px-2 py-3 font-medium">GF</th>
            <th className="text-center px-2 py-3 font-medium">GC</th>
            <th className="text-center px-2 py-3 font-medium">DG</th>
            <th className="text-center px-3 py-3 font-medium text-green-700">PTS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r, i) => (
            <tr key={r.id} className={i === 0 ? 'bg-green-50' : 'hover:bg-gray-50'}>
              <td className="px-4 py-3 text-gray-400 font-medium">{i + 1}</td>
              <td className="px-4 py-3 font-medium text-gray-900 flex items-center gap-2">
                {r.color && <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: r.color }} />}
                {r.name}
              </td>
              <td className="text-center px-2 py-3 text-gray-600">{r.pj}</td>
              <td className="text-center px-2 py-3 text-green-700 font-medium">{r.pg}</td>
              <td className="text-center px-2 py-3 text-gray-500">{r.pe}</td>
              <td className="text-center px-2 py-3 text-red-500">{r.pp}</td>
              <td className="text-center px-2 py-3 text-gray-600">{r.gf}</td>
              <td className="text-center px-2 py-3 text-gray-600">{r.gc}</td>
              <td className="text-center px-2 py-3 text-gray-600">{r.gf - r.gc}</td>
              <td className="text-center px-3 py-3 font-bold text-green-700 text-base">{r.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Jornadas ───────────────────────────────────────────────────
function JornadasTab({ matchdays, matches }) {
  const [openDay, setOpenDay] = useState(matchdays[0] ?? null)

  if (matches.length === 0) return <p className="text-gray-400 text-sm py-4">Sin partidos registrados.</p>

  return (
    <div className="space-y-3">
      {matchdays.map(day => {
        const dayMatches = matches.filter(m => m.matchday === day)
        const isOpen = openDay === day
        return (
          <div key={day} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <button
              onClick={() => setOpenDay(isOpen ? null : day)}
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
            >
              <span className="font-semibold text-gray-700">Jornada {day}</span>
              <span className="text-xs text-gray-400">{dayMatches.length} partidos</span>
            </button>
            {isOpen && (
              <div className="divide-y divide-gray-100">
                {dayMatches.map(m => <MatchRow key={m.id} match={m} />)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function MatchRow({ match: m }) {
  const isPlayed = m.status === 'completed' || m.status === 'forfait'
  const homeColor = m.home_team?.color
  const awayColor = m.away_team?.color
  const homeName = m.home_team_name || m.home_team?.name || '—'
  const awayName = m.away_team_name || m.away_team?.name || '—'

  return (
    <div className="px-5 py-3 flex items-center gap-3 text-sm">
      <div className="flex-1 text-right flex items-center justify-end gap-2">
        {homeColor && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: homeColor }} />}
        <span className={`font-medium ${isPlayed && m.home_goals > m.away_goals ? 'text-green-700' : 'text-gray-800'}`}>{homeName}</span>
      </div>

      <div className="flex items-center gap-1.5 min-w-[72px] justify-center">
        {isPlayed ? (
          <span className="font-bold text-base tabular-nums">
            {m.status === 'forfait' ? (
              <span className="text-xs text-gray-400">Forfait</span>
            ) : (
              `${m.home_goals} - ${m.away_goals}`
            )}
          </span>
        ) : (
          <span className="text-gray-300 text-xs">{m.match_date ? formatDate(m.match_date) : 'vs'}</span>
        )}
      </div>

      <div className="flex-1 flex items-center gap-2">
        <span className={`font-medium ${isPlayed && m.away_goals > m.home_goals ? 'text-green-700' : 'text-gray-800'}`}>{awayName}</span>
        {awayColor && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: awayColor }} />}
      </div>

      {m.field && <span className="text-xs text-gray-400 hidden sm:block">{m.field}</span>}
    </div>
  )
}

// ── Goleadores ─────────────────────────────────────────────────
function GoleadoresTab({ scorers }) {
  if (scorers.length === 0) return <p className="text-gray-400 text-sm py-4">Sin goles registrados aún.</p>
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
          <tr>
            <th className="text-left px-4 py-3 font-medium">#</th>
            <th className="text-left px-4 py-3 font-medium">Jugador</th>
            <th className="text-left px-4 py-3 font-medium">Equipo</th>
            <th className="text-center px-4 py-3 font-medium text-green-700">Goles</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {scorers.map((s, i) => (
            <tr key={i} className={i === 0 ? 'bg-yellow-50' : 'hover:bg-gray-50'}>
              <td className="px-4 py-3 text-gray-400 font-medium">{i + 1}</td>
              <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
              <td className="px-4 py-3 text-gray-500">{s.team}</td>
              <td className="text-center px-4 py-3 font-bold text-green-700 text-base">{s.goals}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Equipos ────────────────────────────────────────────────────
function EquiposTab({ teams }) {
  if (teams.length === 0) return <p className="text-gray-400 text-sm py-4">Sin equipos registrados.</p>
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {teams.map(t => (
        <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex items-center gap-3">
          {t.logo_url ? (
            <img src={t.logo_url} alt={t.name} className="w-10 h-10 rounded-full object-cover border border-gray-200" />
          ) : (
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ background: t.color || '#16a34a' }}>
              {t.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{t.name}</p>
            {t.captain_name && <p className="text-xs text-gray-400 truncate">Cap: {t.captain_name}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}
