import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Trophy, Calendar, Users, ChevronRight } from 'lucide-react'
import { formatDate } from '../../lib/utils'

const STATUS_LABEL = { active: 'En curso', draft: 'Próximo', finished: 'Finalizado' }
const STATUS_COLOR = {
  active: 'bg-green-100 text-green-800',
  draft: 'bg-blue-100 text-blue-800',
  finished: 'bg-gray-100 text-gray-600',
}

export default function HomePage() {
  const { data: tournaments = [], isLoading } = useQuery({
    queryKey: ['public-tournaments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*, teams(count), categories(id, name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const { data: matchCount = 0 } = useQuery({
    queryKey: ['public-match-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('matches')
        .select('id', { count: 'exact', head: true })
      if (error) return 0
      return count ?? 0
    },
  })

  const active = tournaments.filter(t => t.status === 'active')
  const others = tournaments.filter(t => t.status !== 'active')

  const totalTeams = tournaments.reduce((acc, t) => acc + (t.teams?.[0]?.count ?? 0), 0)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-10 h-10 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* ── Hero ── */}
      <div className="bg-[#14532d] text-white">
        <div className="max-w-6xl mx-auto px-4 py-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/10 ring-1 ring-white/20 mb-5">
            <Trophy className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3 tracking-tight">
            Torneos y Ligas
          </h1>
          <p className="text-green-200 text-base max-w-md mx-auto">
            Consulta standings, resultados y tabla de goleo sin necesidad de registrarte
          </p>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-5 grid grid-cols-3 divide-x divide-gray-200 text-center">
          <div className="px-4">
            <p className="text-2xl font-bold text-green-700">{active.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Ligas activas</p>
          </div>
          <div className="px-4">
            <p className="text-2xl font-bold text-green-700">{totalTeams}</p>
            <p className="text-xs text-gray-500 mt-0.5">Equipos participantes</p>
          </div>
          <div className="px-4">
            <p className="text-2xl font-bold text-green-700">{matchCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Partidos registrados</p>
          </div>
        </div>
      </div>

      {/* ── Tournaments ── */}
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-10">
        {active.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block animate-pulse" />
              En curso
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {active.map(t => <TournamentCard key={t.id} tournament={t} />)}
            </div>
          </section>
        )}

        {others.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-gray-700 mb-4">Otros torneos</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {others.map(t => <TournamentCard key={t.id} tournament={t} />)}
            </div>
          </section>
        )}

        {tournaments.length === 0 && (
          <div className="text-center py-24 text-gray-400">
            <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No hay torneos disponibles aún.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function TournamentCard({ tournament: t }) {
  const teamCount = t.teams?.[0]?.count ?? 0
  const categoryNames = (t.categories || []).map(c => c.name).join(', ')

  return (
    <Link
      to={`/torneo/${t.id}`}
      className="group bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md hover:border-green-300 transition-all flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-gray-900 text-base leading-tight group-hover:text-green-700 transition-colors">
          {t.name}
        </h3>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_COLOR[t.status] || STATUS_COLOR.draft}`}>
          {STATUS_LABEL[t.status] || t.status}
        </span>
      </div>

      {t.season && <p className="text-sm text-gray-500">{t.season}</p>}
      {categoryNames && <p className="text-xs text-gray-400">{categoryNames}</p>}

      <div className="flex items-center gap-4 text-xs text-gray-400 mt-auto pt-2 border-t border-gray-100">
        {t.start_date && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(t.start_date)}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />
          {teamCount} equipos
        </span>
        <ChevronRight className="w-4 h-4 ml-auto text-green-500 group-hover:translate-x-1 transition-transform" />
      </div>
    </Link>
  )
}
