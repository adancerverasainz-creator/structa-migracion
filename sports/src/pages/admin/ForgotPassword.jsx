import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, Mail, ArrowLeft, CheckCircle } from 'lucide-react'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })

      const data = await res.json()

      if (!data.success) {
        // Solo mostramos error cuando es falla técnica real (no revelar si el email existe)
        if (data.code === 'EMAIL_ERROR' || data.code === 'LINK_ERROR') {
          setError('Ocurrió un problema técnico. Intenta de nuevo en unos minutos.')
        } else {
          // Rate limit, email inexistente, etc. → éxito genérico siempre
          setSent(true)
        }
      } else {
        setSent(true)
      }
    } catch {
      setError('Error de conexión. Verifica tu internet e intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center space-y-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100">
              <CheckCircle className="w-7 h-7 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Revisa tu correo</h2>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                Si <span className="font-medium text-gray-700">{email}</span> está registrado,
                recibirás un enlace para restablecer tu contraseña desde{' '}
                <code className="text-xs bg-gray-100 px-1 rounded">noreply@structa.mx</code>.
              </p>
              <p className="text-xs text-gray-400 mt-3">
                El enlace expira en 1 hora. Si no ves el correo, revisa la carpeta de spam.
              </p>
            </div>
            <Link
              to="/admin/login"
              className="inline-flex items-center gap-2 text-sm text-green-600 hover:text-green-700 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al inicio de sesión
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 mb-3">
            <Trophy className="w-7 h-7 text-green-700" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Structa Sports</h1>
          <p className="text-sm text-gray-500 mt-1">Recuperar contraseña</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">¿Olvidaste tu contraseña?</h2>
            <p className="text-sm text-gray-500 mt-1">
              Ingresa tu correo y te enviaremos un enlace para crear una nueva.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Correo electrónico
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="tu@ejemplo.com"
                autoComplete="email"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-medium py-2 rounded-lg transition-colors text-sm"
            >
              <Mail className="w-4 h-4" />
              {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
            </button>
          </form>

          <div className="pt-1 border-t border-gray-100">
            <Link
              to="/admin/login"
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Volver al inicio de sesión
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
