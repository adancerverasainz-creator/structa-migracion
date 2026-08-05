import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  Trophy, Calendar, Users, ChevronRight,
  MessageCircle, BarChart3, DollarSign,
  Eye, ArrowDown,
} from 'lucide-react'
import { formatDate } from '../../lib/utils'

// ── Configura el contacto aquí ────────────────────────────────────────────
const WHATSAPP_NUMBER = '529991131632'
const WHATSAPP_MSG = encodeURIComponent(
  'Hola! Me interesa Structa Sports para gestionar mi liga/torneo. ¿Me pueden dar información?'
)
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MSG}`
// ─────────────────────────────────────────────────────────────────────────

const STATUS_LABEL = { active: 'En curso', draft: 'Próximo', finished: 'Finalizado' }
const STATUS_COLOR = {
  active: 'bg-green-100 text-green-800',
  draft:  'bg-blue-100 text-blue-800',
  finished: 'bg-gray-100 text-gray-600',
}

const FEATURES = [
  {
    Icon: BarChart3,
    title: 'Standings en tiempo real',
    desc: 'Tabla de posiciones y goleo actualizada automáticamente al registrar cada partido. Tus jugadores la ven al instante, sin que hagas nada extra.',
  },
  {
    Icon: DollarSign,
    title: 'Control financiero',
    desc: 'Registro de arbitraje, inscripciones y pagos con reportes automáticos. Siempre sabes cuánto se cobró, cuánto falta y cuánto toca entregar.',
  },
  {
    Icon: Eye,
    title: 'Público sin registro',
    desc: 'Jugadores y fans consultan resultados, standings y tabla de goleo con solo compartir un link. Sin app, sin cuenta, sin fricción.',
  },
]

const STEPS = [
  {
    n: '01',
    title: 'Nos contactas',
    desc: 'Cuéntanos los detalles de tu liga — equipos, categorías, fechas. Sin formularios largos, directo por WhatsApp.',
  },
  {
    n: '02',
    title: 'Configuramos todo',
    desc: 'En 24–48 horas tu liga está lista: equipos, calendario, árbitros y cobros configurados a tu medida.',
  },
  {
    n: '03',
    title: 'Arranca tu liga',
    desc: 'Registras partidos, los standings se actualizan solos. Tus jugadores entran con un link, sin descargarse nada.',
  },
]

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
  const others  = tournaments.filter(t => t.status !== 'active')
  const totalTeams = tournaments.reduce((acc, t) => acc + (t.teams?.[0]?.count ?? 0), 0)

  return (
    <div className="bg-gray-50">

      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <div className="bg-[#14532d] text-white">
        <div className="max-w-6xl mx-auto px-4 py-20 sm:py-28 text-center">
          <span className="inline-block text-xs font-semibold tracking-widest text-green-300 uppercase mb-5">
            Plataforma de gestión deportiva
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold mb-5 leading-tight tracking-tight max-w-3xl mx-auto">
            Tu liga, profesional<br className="hidden sm:block" /> y en línea
          </h1>
          <p className="text-green-200 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
            Gestiona equipos, partidos y cobros de arbitraje. Tus jugadores consultan
            standings en tiempo real sin registrarse.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-white text-green-800 font-semibold px-6 py-3 rounded-xl hover:bg-green-50 transition-colors shadow-sm"
            >
              <MessageCircle className="w-5 h-5" />
              Contáctanos por WhatsApp
            </a>
            <a
              href="#torneos"
              className="inline-flex items-center gap-2 text-green-200 hover:text-white font-medium px-4 py-3 rounded-xl transition-colors"
            >
              Ver torneos activos
              <ArrowDown className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* ── STATS STRIP ───────────────────────────────────────────────── */}
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

      {/* ── FEATURES ──────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 py-16 sm:py-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Todo lo que necesita tu liga
          </h2>
          <p className="text-gray-500 mt-2 max-w-lg mx-auto">
            Sin hojas de Excel, sin grupos de WhatsApp llenos de capturas. Todo en un solo lugar.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {FEATURES.map(({ Icon, title, desc }) => (
            <div key={title} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-green-700" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────── */}
      <div className="bg-white border-t border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-16 sm:py-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">¿Cómo funciona?</h2>
            <p className="text-gray-500 mt-2">Tu liga lista en 48 horas, sin complicaciones.</p>
          </div>
          <div className="grid gap-10 sm:grid-cols-3">
            {STEPS.map(({ n, title, desc }) => (
              <div key={n} className="flex flex-col items-start">
                <span className="text-6xl font-black text-green-100 leading-none mb-3 select-none">{n}</span>
                <h3 className="font-bold text-gray-900 text-lg mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── LIVE TOURNAMENTS ──────────────────────────────────────────── */}
      <div id="torneos" className="max-w-6xl mx-auto px-4 py-16 sm:py-20 space-y-10">
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-1.5 text-green-700 text-sm font-semibold mb-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            En vivo ahora
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Ligas que gestionamos hoy
          </h2>
          <p className="text-gray-500 mt-2 max-w-lg mx-auto">
            Esto es exactamente lo que verán tus jugadores cuando tu liga esté aquí.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  En curso
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {active.map(t => <TournamentCard key={t.id} tournament={t} />)}
                </div>
              </section>
            )}
            {others.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
                  Otros torneos
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {others.map(t => <TournamentCard key={t.id} tournament={t} />)}
                </div>
              </section>
            )}
            {tournaments.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No hay torneos disponibles aún.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── CTA FINAL ─────────────────────────────────────────────────── */}
      <div className="bg-[#14532d]">
        <div className="max-w-3xl mx-auto px-4 py-16 sm:py-20 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            ¿Listo para digitalizar tu liga?
          </h2>
          <p className="text-green-200 mb-8 text-lg max-w-xl mx-auto">
            Escríbenos y en menos de 48 horas tu liga estará en línea, sin costo inicial.
          </p>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-white text-green-800 font-bold px-8 py-4 rounded-xl hover:bg-green-50 transition-colors shadow-sm text-lg"
          >
            <MessageCircle className="w-6 h-6" />
            Contáctanos por WhatsApp
          </a>
        </div>
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
