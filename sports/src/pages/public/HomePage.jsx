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

  const active = tournaments.filter(t => t.status === 'active')
  const others = tournaments.filter(t => t.status !== 'active')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-10 h-10 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
          <Trophy className="w-8 h-8 text-green-700" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Torneos y Ligas</h1>
        <p className="text-gray-500 text-base">Consulta standings, resultados y tabla de goleo sin necesidad de registrarte</p>
      </div>

      {/* Torneos activos */}
      {active.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block animate-pulse" />
            En curso
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map(t => <TournamentCard key={t.id} tournament={t} />)}
          </div>
        </section>
      )}

      {/* Otros torneos */}
      {others.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Otros torneos</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {others.map(t => <TournamentCard key={t.id} tournament={t} />)}
          </div>
        </section>
      )}

      {tournaments.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No hay torneos disponibles aún.</p>
        </div>
      )}
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
