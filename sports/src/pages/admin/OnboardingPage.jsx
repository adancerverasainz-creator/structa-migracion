import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useProfile } from '../../context/ProfileContext'
import { Trophy, AlertCircle, CheckCircle, Loader } from 'lucide-react'

const EDGE_URL = 'https://wzzdwsggsefxeoniafhb.supabase.co/functions/v1/create-org'

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { profile, organizationId, isLoading, refreshProfile } = useProfile()
  const [orgName, setOrgName] = useState('')
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | error | success
  const [errorMsg, setErrorMsg] = useState('')

  // Pre-fill org name from signup metadata if available
  useEffect(() => {
    const meta = profile?.raw_user_meta_data
    if (meta?.org_name) setOrgName(meta.org_name)
    if (meta?.contact_phone) setPhone(meta.contact_phone)
  }, [profile])

  // If user already has an org, redirect to admin
  useEffect(() => {
    if (!isLoading && organizationId) {
      navigate('/admin/torneos', { replace: true })
    }
  }, [isLoading, organizationId, navigate])

  // If not logged in at all
  useEffect(() => {
    if (!isLoading && !profile) {
      navigate('/admin/login', { replace: true })
    }
  }, [isLoading, profile, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No session')

      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ org_name: orgName.trim(), contact_phone: phone.trim() }),
      })

      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Error al crear la organización')

      setStatus('success')
      await refreshProfile()
      setTimeout(() => navigate('/admin/torneos', { replace: true }), 1200)
    } catch (err) {
      setStatus('error')
      setErrorMsg(err.message || 'Error inesperado. Intenta de nuevo.')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
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
          <h2 className="text-xl font-bold text-gray-900">¡Liga configurada!</h2>
          <p className="text-sm text-gray-500">Redirigiendo a tu panel…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <div className="w-9 h-9 rounded-xl bg-[#14532d] flex items-center justify-center">
          <Trophy className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-gray-900 text-lg">Structa Sports</span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configura tu liga</h1>
          <p className="text-sm text-gray-500 mt-1">Un paso más y tu panel estará listo.</p>
        </div>

        {status === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de tu liga o academia</label>
            <input
              type="text"
              required
              minLength={2}
              value={orgName}
              onChange={e => setOrgName(e.target.value)}
              placeholder="Liga Futbol Mérida"
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono de contacto (opcional)</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+52 999 123 4567"
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full bg-[#14532d] hover:bg-green-900 text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {status === 'loading' && <Loader className="w-4 h-4 animate-spin" />}
            {status === 'loading' ? 'Creando tu liga…' : 'Empezar'}
          </button>
        </form>
      </div>
    </div>
  )
}
