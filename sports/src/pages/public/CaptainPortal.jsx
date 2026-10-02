import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Trophy, Plus, Trash2, Save, CheckCircle, AlertCircle, Loader, Upload, Lock, ImageIcon } from 'lucide-react'

const EDGE_URL = 'https://wzzdwsggsefxeoniafhb.supabase.co/functions/v1/captain-portal'

const EMPTY_PLAYER = { name: '', number: '', position: '' }

// Posiciones en minúscula para coincidir con el CHECK constraint de la DB
const POSITIONS = [
  { value: '',              label: 'Posición' },
  { value: 'portero',       label: 'Portero' },
  { value: 'defensa',       label: 'Defensa' },
  { value: 'mediocampista', label: 'Mediocampista' },
  { value: 'delantero',     label: 'Delantero' },
]

export default function CaptainPortal() {
  const { token } = useParams()
  const fileInputRef = useRef(null)

  const [status, setStatus]           = useState('loading') // loading | ready | invalid | saving | saved | error
  const [team, setTeam]               = useState(null)
  const [logoUrl, setLogoUrl]         = useState('')
  const [players, setPlayers]         = useState([{ ...EMPTY_PLAYER }])
  const [isLocked, setIsLocked]       = useState(false)
  const [lockReason, setLockReason]   = useState('')
  const [maxPlayers, setMaxPlayers]   = useState(20)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoError, setLogoError]     = useState(false)

  // ── Cargar datos del equipo ──────────────────────────────────────────────
  useEffect(() => {
    fetch(`${EDGE_URL}?token=${token}`)
      .then(r => r.json())
      .then(({ team, players: pl, is_locked, lock_reason, max_players, error }) => {
        if (error || !team) { setStatus('invalid'); return }
        setTeam(team)
        setLogoUrl(team.logo_url || '')
        setIsLocked(is_locked ?? false)
        setLockReason(lock_reason ?? '')
        setMaxPlayers(max_players ?? 20)
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

  // ── Subir logo ────────────────────────────────────────────────────────────
  async function handleLogoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no puede pesar más de 5 MB.')
      return
    }
    setUploadingLogo(true)
    setLogoError(false)
    try {
      const formData = new FormData()
      formData.append('token', token)
      formData.append('file', file)
      const res = await fetch(`${EDGE_URL}?action=upload-logo`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Error al subir imagen')
      setLogoUrl(data.url)
    } catch (err) {
      setLogoError(true)
      setTimeout(() => setLogoError(false), 3000)
    } finally {
      setUploadingLogo(false)
      // Limpiar el input para permitir volver a seleccionar el mismo archivo
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ── Guardar ───────────────────────────────────────────────────────────────
  async function handleSave() {
    if (isLocked) return
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

      {/* Aviso de plantilla bloqueada */}
      {isLocked && (
        <div className="max-w-lg mx-auto px-4 pt-6">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Plantilla bloqueada</p>
              <p className="text-sm text-amber-700 mt-0.5">
                {lockReason || 'El plazo para modificar la plantilla ha vencido (Jornada 3 completada).'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">

        {/* Logo */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-900 text-sm">Logo del equipo</h2>
          <div className="flex items-start gap-4">
            {/* Preview */}
            <div
              className="w-20 h-20 rounded-full border-2 flex items-center justify-center overflow-hidden shrink-0 bg-gray-50 relative"
              style={{ borderColor: team?.color || '#e5e7eb' }}
            >
              {uploadingLogo ? (
                <Loader className="w-6 h-6 text-gray-400 animate-spin" />
              ) : logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none' }} />
              ) : (
                <Trophy className="w-7 h-7 text-gray-300" />
              )}
            </div>

            <div className="flex-1 space-y-3">
              {/* Botón de subida de imagen — ideal para celular */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleLogoUpload}
                  disabled={isLocked || uploadingLogo}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLocked || uploadingLogo}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-3 text-sm text-gray-600 hover:border-green-400 hover:text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadingLogo ? (
                    <><Loader className="w-4 h-4 animate-spin" /> Subiendo...</>
                  ) : logoError ? (
                    <><AlertCircle className="w-4 h-4 text-red-500" /> Error — intenta de nuevo</>
                  ) : (
                    <><Upload className="w-4 h-4" /> Subir imagen desde galería o cámara</>
                  )}
                </button>
              </div>

              {/* Alternativa: URL directa */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                  <ImageIcon className="w-3 h-3" /> O pega un enlace de imagen
                </label>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={e => setLogoUrl(e.target.value)}
                  placeholder="https://..."
                  disabled={isLocked}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Jugadores */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          {(() => {
            const playerCount = players.filter(p => p.name.trim()).length
            const overLimit = playerCount > maxPlayers
            return (
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 text-sm">
                  Jugadores{' '}
                  <span className={`font-normal ${overLimit ? 'text-red-600' : 'text-gray-400'}`}>
                    ({playerCount} / {maxPlayers})
                  </span>
                  {overLimit && (
                    <span className="ml-2 text-xs font-medium text-red-600">¡Límite superado!</span>
                  )}
                </h2>
                {!isLocked && (
                  <button
                    onClick={addPlayer}
                    className="flex items-center gap-1.5 text-xs text-green-700 font-medium hover:text-green-800 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar
                  </button>
                )}
              </div>
            )
          })()}

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
                  disabled={isLocked}
                  className="w-12 rounded-lg border border-gray-300 px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50 disabled:text-gray-400"
                />
                {/* Nombre */}
                <input
                  type="text"
                  value={p.name}
                  onChange={e => updatePlayer(i, 'name', e.target.value)}
                  placeholder="Nombre del jugador *"
                  disabled={isLocked}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50 disabled:text-gray-400"
                />
                {/* Posición */}
                <select
                  value={p.position}
                  onChange={e => updatePlayer(i, 'position', e.target.value)}
                  disabled={isLocked}
                  className="w-28 rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-600 disabled:bg-gray-50 disabled:text-gray-400"
                >
                  {POSITIONS.map(pos => (
                    <option key={pos.value} value={pos.value}>{pos.label}</option>
                  ))}
                </select>
                {/* Eliminar */}
                {!isLocked && (
                  <button onClick={() => removePlayer(i)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400">
            {isLocked
              ? 'La plantilla está bloqueada. Solo el administrador de la liga puede hacer cambios.'
              : 'Solo puedes modificar la plantilla hasta que comience la Jornada 3.'}
          </p>
        </section>

        {/* Botón guardar — oculto si la plantilla está bloqueada */}
        {!isLocked && (() => {
          const playerCount = players.filter(p => p.name.trim()).length
          const overLimit = playerCount > maxPlayers
          return (
            <>
              {overLimit && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">Límite de jugadores superado</p>
                    <p className="text-sm text-red-700 mt-0.5">
                      Tienes {playerCount} jugadores pero el máximo es {maxPlayers}. Elimina {playerCount - maxPlayers} antes de guardar.
                    </p>
                  </div>
                </div>
              )}
              <button
                onClick={handleSave}
                disabled={isBusy || overLimit}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all ${
                  overLimit
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : status === 'saved'
                    ? 'bg-green-100 text-green-700'
                    : status === 'error'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-[#14532d] hover:bg-green-900 text-white disabled:opacity-60'
                }`}
              >
                {status === 'saving' && <Loader className="w-4 h-4 animate-spin" />}
                {status === 'saved'  && <CheckCircle className="w-4 h-4" />}
                {status === 'error'  && <AlertCircle className="w-4 h-4" />}
                {(status === 'ready' && !overLimit) && <Save className="w-4 h-4" />}
                {status === 'saving' ? 'Guardando...'
                  : status === 'saved'  ? '¡Guardado correctamente!'
                  : status === 'error'  ? 'Error al guardar — intenta de nuevo'
                  : overLimit           ? `Elimina ${playerCount - maxPlayers} jugador${playerCount - maxPlayers > 1 ? 'es' : ''} para continuar`
                  : 'Guardar información'}
              </button>
            </>
          )
        })()}

        <p className="text-center text-xs text-gray-400">
          Guarda el enlace de esta página para volver cuando necesites actualizar tu plantilla.
        </p>
      </div>
    </div>
  )
}
