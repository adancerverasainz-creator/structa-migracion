import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Trophy, Eye, EyeOff, AlertCircle, CheckCircle, Mail } from 'lucide-react'

export default function RegistroPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ full_name: '', email: '', password: '', org_name: '', contact_phone: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [status, setStatus] = useState('idle') // idle | loading | error | success | confirm_email
  const [errorMsg, setErrorMsg] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false) // BAJO: prevenir doble submit

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    setStatus('loading')
    setErrorMsg('')

    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: {
            full_name: form.full_name.trim(),
            org_name: form.org_name.trim(),
            contact_phone: form.contact_phone.trim(),
          },
        },
      })

      if (error) {
        setStatus('error')
        if (error.message.includes('already registered')) {
          setErrorMsg('Este correo ya tiene una cuenta. ¿Quieres iniciar sesión?')
        } else if (error.message.includes('Password')) {
          setErrorMsg('La contraseña debe tener al menos 6 caracteres.')
        } else {
          setErrorMsg(error.message)
        }
        return
      }

      // CRÍTICO-2: detectar si Supabase requiere confirmación de email
      // Si session es null, el proyecto tiene "Confirm email" activado
      if (!data.session) {
        setStatus('confirm_email')
        return
      }

      // Auto-confirm activo: hay sesión, ir directo a onboarding
      setStatus('success')
      setTimeout(() => navigate('/admin/onboarding'), 1200)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Estado: esperando confirmación de email
  if (status === 'confirm_email') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 max-w-sm w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
            <Mail className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Revisa tu correo</h2>
          <p className="text-sm text-gray-500">
            Te enviamos un enlace de confirmación a <strong>{form.email}</strong>.
            Haz clic en el enlace para activar tu cuenta y configurar tu liga.
          </p>
          <p className="text-xs text-gray-400">
            ¿No llegó? Revisa tu carpeta de spam o{' '}
            <button
              onClick={handleSubmit}
              className="text-green-700 font-medium hover:underline"
            >
              reenviar correo
            </button>
          </p>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 max-w-sm w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">¡Cuenta creada!</h2>
          <p className="text-sm text-gray-500">Redirigiendo a la configuración de tu liga…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 mb-8">
        <div className="w-9 h-9 rounded-xl bg-[#14532d] flex items-center justify-center">
          <Trophy className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-gray-900 text-lg">Structa Sports</span>
      </Link>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Crea tu cuenta</h1>
          <p className="text-sm text-gray-500 mt-1">Empieza gratis. Sin tarjeta de crédito.</p>
        </div>

        {status === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tu nombre</label>
            <input
              type="text"
              required
              minLength={2}
              value={form.full_name}
              onChange={e => set('full_name', e.target.value)}
              placeholder="Juan García"
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de tu liga / academia</label>
            <input
              type="text"
              required
              minLength={2}
              value={form.org_name}
              onChange={e => set('org_name', e.target.value)}
              placeholder="Liga Futbol Mérida"
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="tu@correo.com"
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                required
                minLength={6}
                value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono (opcional)</label>
            <input
              type="tel"
              value={form.contact_phone}
              onChange={e => set('contact_phone', e.target.value)}
              placeholder="+52 999 123 4567"
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#14532d] hover:bg-green-900 text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-60"
          >
            {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta gratis'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          ¿Ya tienes cuenta?{' '}
          <Link to="/admin/login" className="text-green-700 font-medium hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
