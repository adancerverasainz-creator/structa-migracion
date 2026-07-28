import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { User, Lock, Eye, EyeOff, CheckCircle2, Mail } from 'lucide-react'

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  )
}

function PasswordInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )
}

function PasswordStrength({ password }) {
  if (!password) return null
  const checks = [
    { label: 'Mínimo 8 caracteres', ok: password.length >= 8 },
    { label: 'Al menos una mayúscula', ok: /[A-Z]/.test(password) },
    { label: 'Al menos un número', ok: /\d/.test(password) },
  ]
  return (
    <ul className="mt-2 space-y-1">
      {checks.map(c => (
        <li key={c.label} className={`flex items-center gap-1.5 text-xs ${c.ok ? 'text-green-600' : 'text-gray-400'}`}>
          <CheckCircle2 className={`w-3.5 h-3.5 ${c.ok ? 'text-green-500' : 'text-gray-300'}`} />
          {c.label}
        </li>
      ))}
    </ul>
  )
}

export default function ProfilePage() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [passwords, setPasswords] = useState({ new: '', confirm: '' })

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  const isValid =
    passwords.new.length >= 8 &&
    /[A-Z]/.test(passwords.new) &&
    /\d/.test(passwords.new) &&
    passwords.new === passwords.confirm

  async function handleSubmit(e) {
    e.preventDefault()
    if (passwords.new !== passwords.confirm) {
      toast.error('Las contraseñas no coinciden')
      return
    }
    if (!isValid) {
      toast.error('La contraseña no cumple los requisitos')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: passwords.new })
    setLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Contraseña actualizada correctamente')
      setPasswords({ new: '', confirm: '' })
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mi perfil</h1>
        <p className="text-sm text-gray-500 mt-1">Administra tu cuenta y seguridad</p>
      </div>

      {/* Info de cuenta */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
            <User className="w-5 h-5 text-green-700" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Información de cuenta</p>
            <p className="text-xs text-gray-400">Datos de tu sesión activa</p>
          </div>
        </div>

        <Field label="Correo electrónico">
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50">
            <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-600">{user?.email ?? '—'}</span>
          </div>
        </Field>

        <Field label="Proveedor de autenticación">
          <div className="flex flex-wrap gap-2">
            {(user?.app_metadata?.providers ?? ['email']).map(p => (
              <span
                key={p}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-green-50 text-green-700 font-medium border border-green-100 capitalize"
              >
                {p}
              </span>
            ))}
          </div>
        </Field>

        {user?.created_at && (
          <Field label="Cuenta creada">
            <p className="text-sm text-gray-500">
              {new Date(user.created_at).toLocaleDateString('es-MX', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </p>
          </Field>
        )}
      </div>

      {/* Cambiar contraseña */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-full bg-yellow-50 flex items-center justify-center">
            <Lock className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Cambiar contraseña</p>
            <p className="text-xs text-gray-400">Se cerrará tu sesión en otros dispositivos</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Nueva contraseña">
            <PasswordInput
              value={passwords.new}
              onChange={e => setPasswords(p => ({ ...p, new: e.target.value }))}
              placeholder="Mínimo 8 caracteres"
            />
            <PasswordStrength password={passwords.new} />
          </Field>

          <Field label="Confirmar contraseña">
            <PasswordInput
              value={passwords.confirm}
              onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))}
              placeholder="Repite la contraseña"
            />
            {passwords.confirm && passwords.new !== passwords.confirm && (
              <p className="text-xs text-red-500 mt-1">Las contraseñas no coinciden</p>
            )}
            {passwords.confirm && passwords.new === passwords.confirm && passwords.confirm.length > 0 && (
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Las contraseñas coinciden
              </p>
            )}
          </Field>

          <button
            type="submit"
            disabled={loading || !isValid}
            className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {loading ? 'Guardando…' : 'Actualizar contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}
