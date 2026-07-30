import { Outlet, Link } from 'react-router-dom'
import { Trophy, Shield } from 'lucide-react'

export default function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-green-700 text-lg hover:text-green-800 transition-colors">
            <Trophy className="w-6 h-6" />
            <span>Structa Sports</span>
          </Link>
          <Link
            to="/admin"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-green-700 transition-colors"
          >
            <Shield className="w-4 h-4" />
            Panel admin
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-gray-200 bg-white mt-8">
        <div className="max-w-6xl mx-auto px-4 py-4 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} Structa Sports — Plataforma de torneos y ligas
        </div>
      </footer>
    </div>
  )
}
