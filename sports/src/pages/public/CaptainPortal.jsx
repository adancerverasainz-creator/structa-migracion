import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Trophy, Plus, Trash2, Save, CheckCircle, AlertCircle, Loader } from 'lucide-react'

const EDGE_URL = 'https://wzzdwsggsefxeoniafhb.supabase.co/functions/v1/captain-portal'

const EMPTY_PLAYER = { name: '', number: '', position: '' }

export default function CaptainPortal() {
  const { token } = useParams()

  const [status, setStatus]   = useState('loading') // loading | ready | invalid | saving | saved | error
  const [team, setTeam]       = useState(null)
  const [logoUrl, setLogoUrl] = useState('')
  const [players, setPlayers] = useState([{ ...EMPTY_PLAYER }])

  // ── Cargar datos del equipo ──────────────────────────────────────────────
  useEffect(() => {
    fetch(`${EDGE_URL}?token=${token}`)
      .then(r => r.json())
      .then(({ team, players: pl, error }) => {
        if (error || !team) { setStatus('invalid'); return }
        setTeam(team)
        setLogoUrl(team.logo_url || '')
        setPlayers(pl.length > 0 ? pl.map(p => ({ name: p.name, number: p.number ?? '', position: p.position ?? '' })) : [{ ...EMPTY_PLAYER }])
        setStatus('ready')
      })
      .catch(() => setStatus('invalid'))
  }, [token])

  // ── Jugadores ─────────────────────────────────────────────────────────────
  function updatePlayer(i, field, value) {
    setPlayers(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p))
  }
  function addPlayer() {
    setPlayers(prev => [...prev, { ...EMPTY_PLAYER }])
  }
  function removePlayer(i) {
    setPlayers(prev => prev.length === 1 ? [{ ...EMPTY_PLAYER }] : prev.filter((_, idx) => idx !== i))
  }

  // ── Guardar ───────────────────────────────────────────────────────────────
  async function handleSave() {
    setStatus('saving')
    try {
      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, logo_url: logoUrl, players }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error)
      setStatus('saved')
      setTimeout(() => setStatus('ready'), 3000)
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('ready'), 3000)
    }
  }

  // ── Estados de carga ─────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 max-w-sm w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Enlace inválido</h2>
          <p className="text-sm text-gray-500">Este enlace no es válido o ha expirado. Solicita uno nuevo al administrador de la liga.</p>
        </div>
      </div>
    )
  }

  const isBusy = status === 'saving'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#14532d] text-white">
        <div className="max-w-lg mx-auto px-4 py-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-green-300 text-xs font-medium uppercase tracking-wide">Portal del capitán</p>
            <h1 className="text-lg font-bold leading-tight">{team?.name}</h1>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

        {/* Logo */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-900 text-sm">Logo del equipo</h2>
          <div className="flex items-center gap-4">
            {/* Preview */}
            <div
              className="w-16 h-16 rounded-full border-2 border-gray-200 flex items-center justify-center overflow-hidden shrink-0 bg-gray-50"
              style={{ borderColor: team?.color || '#e5e7eb' }}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none' }} />
              ) : (
                <Trophy className="w-6 h-6 text-gray-300" />
              )}
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">URL del logo</label>
              <input
                type="url"
                value={logoUrl}
                onChange={e => setLogoUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-400 mt-1">Pega el enlace de una imagen (JPG, PNG, SVG)</p>
            </div>
          </div>
        </section>

        {/* Jugadores */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-sm">Jugadores <span className="text-gray-400 font-normal">({players.filter(p => p.name.trim()).length})</span></h2>
            <button
              onClick={addPlayer}
              className="flex items-center gap-1.5 text-xs text-green-700 font-medium hover:text-green-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar
            </button>
          </div>

          <div className="space-y-3">
            {players.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                {/* Número */}
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={p.number}
                  onChange={e => updatePlayer(i, 'number', e.target.value)}
                  placeholder="#"
                  className="w-12 rounded-lg border border-gray-300 px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                {/* Nombre */}
                <input
                  type="text"
                  value={p.name}
                  onChange={e => updatePlayer(i, 'name', e.target.value)}
                  placeholder="Nombre del jugador *"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                {/* Posición */}
                <select
                  value={p.position}
                  onChange={e => updatePlayer(i, 'position', e.target.value)}
                  className="w-24 rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-600"
                >
                  <option value="">Pos.</option>
                  <option value="Portero">Portero</option>
                  <option value="Defensa">Defensa</option>
                  <option value="Medio">Medio</option>
                  <option value="Delantero">Delantero</option>
                </select>
                {/* Eliminar */}
                <button onClick={() => removePlayer(i)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400">Agrega a todos los jugadores de tu plantilla. Puedes editarlos cuando quieras con este mismo enlace.</p>
        </section>

        {/* Botón guardar */}
        <button
          onClick={handleSave}
          disabled={isBusy}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all ${
            status === 'saved'
              ? 'bg-green-100 text-green-700'
              : status === 'error'
              ? 'bg-red-100 text-red-700'
              : 'bg-[#14532d] hover:bg-green-900 text-white disabled:opacity-60'
          }`}
        >
          {status === 'saving' && <Loader className="w-4 h-4 animate-spin" />}
          {status === 'saved'  && <CheckCircle className="w-4 h-4" />}
          {status === 'error'  && <AlertCircle className="w-4 h-4" />}
          {status === 'ready'  && <Save className="w-4 h-4" />}
          {status === 'saving' ? 'Guardando...'
            : status === 'saved'  ? '¡Guardado correctamente!'
            : status === 'error'  ? 'Error al guardar — intenta de nuevo'
            : 'Guardar información'}
        </button>

        <p className="text-center text-xs text-gray-400">
          Solo puedes editar la información de tu equipo. Guarda el enlace de esta página para volver cuando necesites actualizar tu plantilla.
        </p>
      </div>
    </div>
  )
}
