import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Trophy, List, LogOut, User, Users } from 'lucide-react'

export default function AdminLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user
      if (!user) return
      setEmail(user.email ?? '')
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      setRole(profile?.role ?? '')
    })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/admin/login', { replace: true })
  }

  const navLink = (to, label, Icon, match) => (
    <Link
      to={to}
      className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors ${
        match
          ? 'bg-green-50 text-green-700 font-medium'
          : 'text-gray-600 hover:text-green-700 hover:bg-gray-100'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </Link>
  )

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 font-bold text-green-700 text-lg hover:text-green-800 transition-colors">
              <Trophy className="w-6 h-6" />
              <span>Structa Sports</span>
            </Link>
            <nav className="hidden sm:flex items-center gap-1">
              {navLink(
                '/admin/torneos',
                'Torneos',
                List,
                pathname.startsWith('/admin/torneo') || pathname === '/admin/torneos'
              )}
              {role === 'admin' && navLink(
                '/admin/usuarios',
                'Usuarios',
                Users,
                pathname === '/admin/usuarios'
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {/* Avatar / Perfil */}
            <Link
              to="/admin/perfil"
              className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg transition-colors ${
                pathname === '/admin/perfil'
                  ? 'bg-green-50 text-green-700 font-medium'
                  : 'text-gray-500 hover:text-green-700 hover:bg-gray-100'
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-green-700" />
              </div>
              <span className="hidden sm:inline max-w-[140px] truncate">{email}</span>
            </Link>

            <div className="w-px h-5 bg-gray-200" />

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-gray-200 bg-white mt-8">
        <div className="max-w-6xl mx-auto px-4 py-4 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} Structa Sports — Panel Administrador
        </div>
      </footer>
    </div>
  )
}
