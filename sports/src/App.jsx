import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ShieldOff } from 'lucide-react'
import { supabase } from './lib/supabase'

// Public pages
import PublicLayout from './pages/public/PublicLayout'
import HomePage from './pages/public/HomePage'
import TournamentPage from './pages/public/TournamentPage'
import CaptainPortal from './pages/public/CaptainPortal'

// Admin pages
import LoginPage from './pages/admin/LoginPage'
import AdminLayout from './pages/admin/AdminLayout'
import AdminTournaments from './pages/admin/AdminTournaments'
import AdminTournamentDetail from './pages/admin/AdminTournamentDetail'
import ProfilePage from './pages/admin/ProfilePage'
import AdminUsers from './pages/admin/AdminUsers'

function AccessDenied() {
  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/admin/login'
  }

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-gray-50 gap-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 flex flex-col items-center gap-4 max-w-sm w-full mx-4">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
          <ShieldOff className="w-7 h-7 text-red-500" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900">Sin acceso</h2>
          <p className="text-sm text-gray-500 mt-1">
            Tu cuenta no tiene permisos para acceder al panel de administración. Contacta al administrador.
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm py-2 rounded-lg transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

function RequireAuth({ children }) {
  const [session, setSession] = useState(undefined)
  const [role, setRole] = useState(undefined)

  useEffect(() => {
    async function loadSession(s) {
      setSession(s)
      if (s) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', s.user.id)
          .single()
        setRole(profile?.role ?? 'user')
      } else {
        setRole(null)
      }
    }

    supabase.auth.getSession().then(({ data }) => loadSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => loadSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined || (session && role === undefined)) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) return <Navigate to="/admin/login" replace />

  if (role === 'user') return <AccessDenied />

  return children
}

export default function App() {
  return (
    <Routes>
      {/* Rutas públicas */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/torneo/:id" element={<TournamentPage />} />
      </Route>

      {/* Portal del capitán (público, sin auth) */}
      <Route path="/capitan/:token" element={<CaptainPortal />} />

      {/* Login admin */}
      <Route path="/admin/login" element={<LoginPage />} />

      {/* Rutas admin protegidas */}
      <Route path="/admin" element={<RequireAuth><AdminLayout /></RequireAuth>}>
        <Route index element={<Navigate to="/admin/torneos" replace />} />
        <Route path="torneos" element={<AdminTournaments />} />
        <Route path="torneo/:id" element={<AdminTournamentDetail />} />
        <Route path="perfil" element={<ProfilePage />} />
        <Route path="usuarios" element={<AdminUsers />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
