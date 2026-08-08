import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Trophy, Lock, CheckCircle, Eye, EyeOff, AlertCircle } from 'lucide-react'

// Estados del flujo de reset
const STATE = {
  LOADING: 'loading',      // Verificando token en URL
  READY: 'ready',          // Token válido, mostrar form
  SAVING: 'saving',        // Guardando nueva contraseña
  SUCCESS: 'success',      // Contraseña actualizada
  ERROR: 'error',          // Token inválido o expirado
}

export default function ResetPassword() {
  const navigate = useNavigate()
  const [state, setState] = useState(STATE.LOADING)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [formError, setFormError] = useState(null)

  useEffect(() => {
    // Supabase pone los tokens en el hash: #access_token=...&type=recovery
    // onAuthStateChange captura el evento PASSWORD_RECOVERY automáticamente
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // Token válido — Supabase ya estableció la sesión temporal
        setState(STATE.READY)
      } else if (event === 'SIGNED_IN' && session) {
        // Por si el token ya fue procesado antes de montar el componente
        // solo activar si venimos del hash de recovery
        const hash = window.location.hash
        if (hash.includes('type=recovery')) {
          setState(STATE.READY)
        }
      }
    })

    // Timeout: si en 4 s no llega el evento, el token es inválido/expirado
    const timeout = setTimeout(() => {
      setState(prev => prev === STATE.LOADING ? STATE.ERROR : prev)
    }, 4000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError(null)

    if (password.length < 8) {
      setFormError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setFormError('Las contraseñas no coinciden.')
      return
    }

    setState(STATE.SAVING)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setFormError(error.message || 'Error al actualizar la contraseña. Intenta de nuevo.')
      setState(STATE.READY)
    } else {
      setState(STATE.SUCCESS)
      // Redirigir al dashboard tras 2.5 s
      setTimeout(() => navigate('/admin/torneos', { replace: true }), 2500)
    }
  }

  // ── Pantalla de carga ──────────────────────────────────────────────────
  if (state === STATE.LOADING) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500">Verificando enlace…</p>
        </div>
      </div>
    )
  }

  // ── Token inválido o expirado ──────────────────────────────────────────
  if (state === STATE.ERROR) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center space-y-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-100">
              <AlertCircle className="w-7 h-7 text-red-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Enlace inválido o expirado</h2>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                Este enlace de recuperación ya fue usado o ha expirado (duración: 1 hora).
                Solicita uno nuevo desde la página de inicio de sesión.
              </p>
            </div>
            <button
              onClick={() => navigate('/admin/forgot-password', { replace: true })}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium text-sm py-2 rounded-lg transition-colors"
            >
              Solicitar nuevo enlace
            </button>
            <button
              onClick={() => navigate('/admin/login', { replace: true })}
              className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Volver al inicio de sesión
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Éxito ──────────────────────────────────────────────────────────────
  if (state === STATE.SUCCESS) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center space-y-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100">
              <CheckCircle className="w-7 h-7 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">¡Contraseña actualizada!</h2>
              <p className="text-sm text-gray-500 mt-2">
                Te estamos redirigiendo al panel…
              </p>
            </div>
            <div className="w-6 h-6 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto" />
          </div>
        </div>
      </div>
    )
  }

  // ── Formulario de nueva contraseña ────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 mb-3">
            <Trophy className="w-7 h-7 text-green-700" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Structa Sports</h1>
          <p className="text-sm text-gray-500 mt-1">Nueva contraseña</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Crea tu nueva contraseña</h2>
            <p className="text-sm text-gray-500 mt-1">Mínimo 8 caracteres.</p>
          </div>

          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nueva contraseña */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  autoFocus
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirmar contraseña */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirmar contraseña
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={state === STATE.SAVING}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-medium py-2 rounded-lg transition-colors text-sm"
            >
              <Lock className="w-4 h-4" />
              {state === STATE.SAVING ? 'Guardando…' : 'Guardar nueva contraseña'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
