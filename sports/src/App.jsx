import { Routes, Route, Navigate } from 'react-router-dom'
import { ShieldOff } from 'lucide-react'
import { supabase } from './lib/supabase'
import { ProfileProvider, useProfile } from './context/ProfileContext'

// Public pages
import PublicLayout from './pages/public/PublicLayout'
import HomePage from './pages/public/HomePage'
import TournamentPage from './pages/public/TournamentPage'
import CaptainPortal from './pages/public/CaptainPortal'

// Admin pages
import LoginPage from './pages/admin/LoginPage'
import ForgotPassword from './pages/admin/ForgotPassword'
import ResetPassword from './pages/admin/ResetPassword'
import AdminLayout from './pages/admin/AdminLayout'
import AdminTournaments from './pages/admin/AdminTournaments'
import AdminTournamentDetail from './pages/admin/AdminTournamentDetail'
import ProfilePage from './pages/admin/ProfilePage'
import AdminUsers from './pages/admin/AdminUsers'

// Self-service pages
import RegistroPage from './pages/public/RegistroPage'
import OnboardingPage from './pages/admin/OnboardingPage'

// Print / PDF pages
import TournamentPrint from './pages/admin/TournamentPrint'

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

// CRÍTICO-1: allowlist en lugar de deny-list — null/undefined quedan bloqueados por defecto
const ALLOWED_ROLES = ['admin', 'editor', 'org_admin']

function RequireAuth({ children, allowOnboarding = false }) {
  const { profile, session, role, organizationId, isLoading, profileError } = useProfile()

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) return <Navigate to="/admin/login" replace />

  // Error cargando perfil — no tratar como "sin perfil", mostrar mensaje
  if (profileError) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-sm text-center space-y-3">
          <p className="text-sm text-gray-700 font-medium">No pudimos cargar tu perfil.</p>
          <p className="text-xs text-gray-500">Intenta recargar la página o contacta soporte.</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-green-700 text-white text-sm py-2 rounded-lg"
          >
            Recargar
          </button>
        </div>
      </div>
    )
  }

  // Nuevo usuario sin org: redirigir a onboarding (excepto rutas que no lo necesitan)
  if (!allowOnboarding && profile && !organizationId && role === 'visitante') {
    return <Navigate to="/admin/onboarding" replace />
  }

  // Allowlist: solo roles explícitamente permitidos pasan
  if (!ALLOWED_ROLES.includes(role)) return <AccessDenied />

  return children
}

export default function App() {
  return (
    <ProfileProvider>
      <Routes>
        {/* Rutas públicas */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/torneo/:id" element={<TournamentPage />} />
        </Route>

        {/* Registro self-service */}
        <Route path="/registro" element={<RegistroPage />} />

        {/* Portal del capitán (público, sin auth) */}
        <Route path="/capitan/:token" element={<CaptainPortal />} />

        {/* Login admin */}
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin/forgot-password" element={<ForgotPassword />} />
        <Route path="/admin/reset-password" element={<ResetPassword />} />

        {/* Onboarding (requiere sesión, sin org todavía) */}
        <Route path="/admin/onboarding" element={<OnboardingPage />} />

        {/* Print / PDF — allowOnboarding=true: no redirige a onboarding si org aún no está */}
        <Route
          path="/admin/torneo/:id/print/:type"
          element={<RequireAuth allowOnboarding={true}><TournamentPrint /></RequireAuth>}
        />

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
    </ProfileProvider>
  )
}
