import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Trophy, List, LogOut, Shield } from 'lucide-react'

export default function AdminLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/admin/login', { replace: true })
  }

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
              <Link
                to="/admin/torneos"
                className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors ${
                  pathname.startsWith('/admin/torneo') || pathname === '/admin/torneos'
                    ? 'bg-green-50 text-green-700 font-medium'
                    : 'text-gray-600 hover:text-green-700 hover:bg-gray-100'
                }`}
              >
                <List className="w-4 h-4" />
                Torneos
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:flex items-center gap-1 text-xs text-gray-400">
              <Shield className="w-3.5 h-3.5" />
              Admin
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
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
