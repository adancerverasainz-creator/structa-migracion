import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

// Public pages
import PublicLayout from './pages/public/PublicLayout'
import HomePage from './pages/public/HomePage'
import TournamentPage from './pages/public/TournamentPage'

// Admin pages
import LoginPage from './pages/admin/LoginPage'
import AdminLayout from './pages/admin/AdminLayout'
import AdminTournaments from './pages/admin/AdminTournaments'
import AdminTournamentDetail from './pages/admin/AdminTournamentDetail'

function RequireAuth({ children }) {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
      </div>
    )
  }

  return session ? children : <Navigate to="/admin/login" replace />
}

export default function App() {
  return (
    <Routes>
      {/* Rutas públicas */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/torneo/:id" element={<TournamentPage />} />
      </Route>

      {/* Login admin */}
      <Route path="/admin/login" element={<LoginPage />} />

      {/* Rutas admin protegidas */}
      <Route path="/admin" element={<RequireAuth><AdminLayout /></RequireAuth>}>
        <Route index element={<Navigate to="/admin/torneos" replace />} />
        <Route path="torneos" element={<AdminTournaments />} />
        <Route path="torneo/:id" element={<AdminTournamentDetail />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
